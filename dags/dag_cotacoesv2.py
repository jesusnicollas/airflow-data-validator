#!/usr/bin/env python
# coding: utf-8
#IMPORT LIBS --> AIRFLOW + PYSPARK SESSION
from airflow import DAG
from datetime import datetime
from airflow.operators.python import PythonOperator, BranchPythonOperator
from airflow.providers.postgres.operators.postgres import PostgresOperator
from airflow.providers.mysql.hooks.mysql import MySqlHook
from airflow.providers.mysql.operators.mysql import MySqlOperator
from pyspark.sql import SparkSession
from pyspark.sql import functions as F
from pyspark.sql.functions import *
import requests
import logging
import os
import tempfile
from datetime import datetime
from pyspark.sql.functions import current_timestamp
import mysql.connector
from pyspark.sql.types import StructType, StructField, StringType, IntegerType, FloatType, DoubleType, DateType

# Dados pré processamento

schema = StructType([
    StructField("dtReferencia", StringType(), True),
    StructField("coMoeda", IntegerType(), True),
    StructField("tpMoeda", StringType(), True),
    StructField("noMoeda", StringType(), True),
    StructField("txCompra", StringType(), True),
    StructField("txVenda", StringType(), True),
    StructField("parCompra", StringType(), True),
    StructField("parVenda", StringType(), True)
])


def variables_execution(**kwargs):
    ds_nodash = kwargs['ds_nodash']  # guarantee the ds_nodash is defined like '20251110'
    data_str_1 = ds_nodash
    data_bar_1 = datetime.strptime(ds_nodash, '%Y%m%d').strftime('%Y-%m-%d')
    logging.info(f"Data sem separador: {data_str_1}")
    logging.info(f"Data com separador: {data_bar_1}")
    file_path = data_str_1 + ".csv"
    url = "https://www4.bcb.gov.br/Download/fechamento/"
    full_url = url + file_path
    return data_bar_1, data_str_1, file_path, full_url


def get_spark():
    spark = (SparkSession
             .builder
             .appName("Spark cotacao")
             .master("local[*]")
             .config("spark.jars.packages", "mysql:mysql-connector-java:8.0.33")
             .getOrCreate())
    return spark


#Extract
def extract_func(ti):
    data_bar_1, data_str_1, file_path, full_url = ti.xcom_pull(task_ids='variables_execution')
    spark = get_spark()
    try:
        response = requests.get(full_url)
        if response.status_code == 404:
            logging.warning(f'Arquivo {file_path} não encontrado (404)')
            return None
        if response.status_code != 200:
            logging.error(f'Erro ao baixar arquivo. Status: {response.status_code} - URL: {full_url}')
            return None
        logging.info('Arquivo baixado com sucesso')

        with open(file_path, "wb") as f:
            f.write(response.content)
            df = spark.read.csv(
                f"{data_str_1}.csv",
                header=False,
                schema=schema,
                sep=';',
                encoding='latin1'
            )
        temp_file = tempfile.NamedTemporaryFile(mode='w', suffix='.parquet', delete=False)
        temp_path = temp_file.name
        temp_file.close()
        df.write.parquet(temp_path, mode='overwrite')
        logging.info(f"Dados salvos em: {temp_path}")
        return temp_path
    except Exception as e:
        logging.error(e)
        raise e


#Transform
def transform_cotacao_func(ti):
    temp_path = ti.xcom_pull(task_ids='extract')
    if temp_path is None:
        return None
    spark = get_spark()
    df = spark.read.parquet(temp_path)
    df.createOrReplaceTempView("cotacoes")

    df_transformado = spark.sql("""
                                SELECT coMoeda,
                                       TO_DATE(dtReferencia, 'dd/MM/yyyy')         as dtReferencia,
                                       cast(current_timestamp() as timestamp) - interval 3 hour                        as dtExecucaoDag,
                                       tpMoeda,
                                       noMoeda,
                                       CAST(REPLACE(txCompra, ',', '.') AS FLOAT)  as txCompra,
                                       CAST(REPLACE(txVenda, ',', '.') AS FLOAT)   as txVenda,
                                       CAST(REPLACE(parCompra, ',', '.') AS FLOAT) as parCompra,
                                       CAST(REPLACE(parVenda, ',', '.') AS FLOAT)  as parVenda
                                FROM cotacoes
                                """)
    temp_file_treated = tempfile.NamedTemporaryFile(mode='w', suffix='.parquet', delete=False)
    temp_path_treated = temp_file_treated.name
    temp_file_treated.close()
    df_transformado.write.parquet(temp_path_treated, mode='overwrite')
    logging.info(f"Dados salvos em: {temp_path_treated}")
    return temp_path_treated


def staging_cotacao_func(ti):
    spark = get_spark()
    temp_path_treated = ti.xcom_pull(task_ids='transform_cotacao')
    if temp_path_treated is None:
        return None
    df_transformado = spark.read.parquet(temp_path_treated)
    df_transformado.write.jdbc(
        url="jdbc:mysql://mysql:3306/appdb",
        table="tb_cotacoes_staging",
        mode="overwrite",
        properties={"user": "airflow", "password": "airflow", "driver": "com.mysql.cj.jdbc.Driver"}
    )
    logging.info("Dados carregados na staging com sucesso!")


def delete_data_func(ti):
    data_bar_1, data_str_1, file_path, full_url = ti.xcom_pull(task_ids='variables_execution')
    temp_path_treated = ti.xcom_pull(task_ids='transform_cotacao')
    if temp_path_treated is None:
        return None
    conn = None
    try:
        conn = mysql.connector.connect(
            user='airflow',
            password='airflow',
            host='mysql',
            database='appdb',
            autocommit=False
        )
        cursor = conn.cursor(buffered=True)
        conn.start_transaction(isolation_level='READ COMMITTED')
        cursor.execute(f"""
            DELETE FROM tb_cotacoes
            WHERE date(dtReferencia) = '{data_bar_1}'
        """)
        deleted = cursor.rowcount
        conn.commit()
        logging.info(f"{deleted} registros deletados")
        return deleted

    except Exception as e:
        logging.error(f"Erro ao deletar dados: {e}")
        if conn:
            conn.rollback()
        raise

    finally:
        if conn:
            conn.close()

def load_data_func(ti):
    data_bar_1, data_str_1, file_path, full_url = ti.xcom_pull(task_ids='variables_execution')
    deleted = ti.xcom_pull(task_ids='delete_data')
    temp_path_treated = ti.xcom_pull(task_ids='transform_cotacao')
    if temp_path_treated is None:
        logging.info("Nenhum dado para carregar")
        # Registrar arquivo não encontrado na tabela de controle
        conn = mysql.connector.connect(
            user='airflow',
            password='airflow',
            host='mysql',
            database='appdb',
            autocommit=False
        )
        cursor = conn.cursor(buffered=True)
        cursor.execute(f'''
            INSERT INTO tb_controle_execucao (dtExecucao, noArquivo, dsObservacao)
            VALUES (NOW(), '{data_str_1}.csv', 'Arquivo não encontrado no Banco Central')
        ''')
        logging.info("Nenhum dado para carregar (arquivo não encontrado)")
        return None
    conn = None
    try:
        conn = mysql.connector.connect(
            user='airflow',
            password='airflow',
            host='mysql',
            database='appdb',
            autocommit=False
        )
        cursor = conn.cursor(buffered=True)
        conn.start_transaction(isolation_level='READ COMMITTED')
        cursor.execute("""
            INSERT INTO tb_cotacoes(coMoeda, dtReferencia, dtExecucaoDag, tpMoeda, noMoeda, txCompra, txVenda, parCompra, parVenda)
            SELECT * FROM tb_cotacoes_staging
        """)
        affected = cursor.rowcount
        cursor.execute(f"""
            INSERT INTO tb_controle_execucao(dtExecucao, noArquivo, dsObservacao)
            VALUES (NOW(), '{file_path}', '{deleted} registros deletados, {affected} carregados')
        """)
        conn.commit()
        logging.info(f"{affected} registros carregados com sucesso")
    except Exception as e:
        logging.error(f"Erro ao inserir dados: {e}")
        if conn:
            conn.rollback()
        raise
    finally:
        if conn:
            conn.close()


#construção de tasks
with DAG('dag_cotacoesv2', start_date=datetime(2025, 10, 28, 11, 00, 00, 00), schedule_interval='0 20 * * *',
         catchup=False) as dag:

    #TASK ENVIRONMENT
    variables_execution = PythonOperator(
        task_id='variables_execution',
        python_callable=variables_execution
    )
    #TASK EXTRACT
    extract = PythonOperator(
        task_id='extract',
        python_callable=extract_func
    )
    #TASK TRANSFORM
    transform_cotacao = PythonOperator(
        task_id='transform_cotacao',
        python_callable=transform_cotacao_func
    )

    staging_cotacao = PythonOperator(
        task_id='load_cotacao',
        python_callable=staging_cotacao_func
    )
    delete_data = PythonOperator(
        task_id='delete_data',
        python_callable=delete_data_func
    )
    load_data = PythonOperator(
        task_id='load_data_func',
        python_callable=load_data_func
    )

    variables_execution >> extract >> transform_cotacao >> staging_cotacao >> delete_data >> load_data
