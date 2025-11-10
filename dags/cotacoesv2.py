from airflow import DAG
from datetime import datetime
from airflow.operators.python import PythonOperator, BranchPythonOperator
from airflow.operators.bash import BashOperator
from airflow.providers.postgres.operators.postgres import PostgresOperator
from airflow.providers.postgres.hooks.postgres import PostgresHook
from airflow.providers.mysql.hooks.mysql import MySqlHook
from airflow.providers.mysql.operators.mysql import MySqlOperator

import pandas as pd
import requests
import json
import logging
import os
import tempfile



#### EXTRACT ####

def extract_cotacao_func(**kwargs):
    ds_nodash = kwargs['ds_nodash']
    file_path = ds_nodash + ".csv"
    #file_path = '20251029' +".csv"
    url = "https://www4.bcb.gov.br/Download/fechamento/"
    full_url = url + file_path
    logging.info(full_url)
    try:
        response = requests.get(full_url)
        if response.status_code == 404:
            logging.warning(f"Arquivo {file_path} não encontrado (404)")
            return None

        if response.status_code != 200:
            logging.error(f"Erro ao baixar arquivo. Status: {response.status_code} - URL: {full_url}")
            return None
        logging.info("Arquivo baixado com sucesso")

        with open(file_path, "wb") as f:
            f.write(response.content)
        columns = ['dtReferencia', 'coMoeda', 'tpMoeda', 'noMoeda', 'txCompra', 'txVenda', 'parCompra',
                   'parVenda']
        df = pd.read_csv(file_path, sep=";", encoding='latin1', names=columns)
        logging.info(df.head())

        # Salvar em arquivo temporário
        temp_file = tempfile.NamedTemporaryFile(mode='w', suffix='.parquet', delete=False)
        temp_path = temp_file.name
        temp_file.close()
        df.to_parquet(temp_path, index=False)
        logging.info(f"Dados salvos em: {temp_path}")
        return temp_path
    except Exception as e:
        logging.error(e)
        raise e

#### TRANSFORM ####
def transform_cotacao_func(**kwargs):
    ti = kwargs['ti']
    temp_path = ti.xcom_pull(task_ids='extract_cotacao')
    if temp_path is not None:
        # Ler do arquivo temporário
        df = pd.read_parquet(temp_path)
        logging.info(f"Dados lidos de: {temp_path}")

        df['dtReferencia'] = pd.to_datetime(df['dtReferencia'], dayfirst=True)

        for col in ['txCompra', 'txVenda', 'parCompra', 'parVenda']:
            if col in df.columns:
                df[col] = df[col].astype(str).str.replace(',', '.').astype(float)

        df = df.dropna()
        df = df.reindex(columns=['coMoeda', 'dtReferencia', 'tpMoeda', 'noMoeda','txCompra', 'txVenda', 'parCompra', 'parVenda'])

        # Salvar transformado em novo arquivo temporário
        temp_file = tempfile.NamedTemporaryFile(mode='w', suffix='.parquet', delete=False)
        temp_path_transformed = temp_file.name
        temp_file.close()
        df.to_parquet(temp_path_transformed, index=False)
        logging.info(f"Dados transformados salvos em: {temp_path_transformed}")

        # Limpar arquivo anterior
        os.remove(temp_path)

        return temp_path_transformed
    else:
        logging.info("Nenhum dado recebido da extração (arquivo não encontrado)")
        return None
#### LOAD ####
def load_cotacao_func(**kwargs):
    ti = kwargs['ti']
    ds_nodash = kwargs['ds_nodash']
    formatted_ds_nodash = datetime.strptime(ds_nodash, '%Y%m%d').strftime('%Y-%m-%d')
    temp_path = ti.xcom_pull(task_ids='transform_cotacao')
    mysql_hook = MySqlHook(mysql_conn_id='mysql_default', database='appdb')

    if temp_path is not None:
        try:
            # Ler do arquivo temporário
            df = pd.read_parquet(temp_path)
            logging.info(f"Dados lidos de: {temp_path}")

            mysql_hook.run(f'DELETE FROM tb_cotacoes WHERE date(dtReferencia) = "{formatted_ds_nodash}"')
            df.to_sql(
                'tb_cotacoes',
                mysql_hook.get_sqlalchemy_engine(),
                if_exists='append',
                index=False
            )
            logging.info(f"Carregados {len(df)} registros no banco de dados")

            # Registrar sucesso na tabela de controle
            mysql_hook.run(f'''
                INSERT INTO tb_controle_execucao (dtExecucao, noArquivo, dsObservacao)
                VALUES (NOW(), '{ds_nodash}.csv', 'Sucesso: {len(df)} registros carregados')
            ''')

            # Limpar arquivo temporário
            os.remove(temp_path)
        except Exception as e:
            # Registrar erro na tabela de controle
            erro_msg = str(e).replace("'", "''")[:190]  # Escapar aspas e limitar tamanho
            mysql_hook.run(f'''
                INSERT INTO tb_controle_execucao (dtExecucao, noArquivo, dsObservacao)
                VALUES (NOW(), '{ds_nodash}.csv', 'Erro ao carregar: {erro_msg}')
            ''')
            logging.error(f"Erro ao carregar dados: {e}")
            raise e
    else:
        # Registrar arquivo não encontrado na tabela de controle
        mysql_hook.run(f'''
            INSERT INTO tb_controle_execucao (dtExecucao, noArquivo, dsObservacao)
            VALUES (NOW(), '{ds_nodash}.csv', 'Arquivo não encontrado no Banco Central')
        ''')
        logging.info("Nenhum dado para carregar (arquivo não encontrado)")



# ti.xcom_pull(task_ids='') --> retorna o valor do xcom do task anterior


with DAG('dag_cotacao', start_date=datetime(2025, 8, 1, 11, 00, 00, 00), schedule_interval='0 20 * * *',
         catchup=True) as dag:

    ###### EXTRACT ######
    captura_cotacao = PythonOperator(
        task_id='extract_cotacao',
        python_callable=extract_cotacao_func
    )
    ###### TRANSFORM ######

    transform_cotacao = PythonOperator(
        task_id='transform_cotacao',
        python_callable=transform_cotacao_func
    )
    ###### LOAD ######
    create_table = MySqlOperator(
        task_id='create_table',
        mysql_conn_id='mysql_default',
        sql='''CREATE TABLE IF NOT EXISTS tb_cotacoes (
                coMoeda INT not null,
                dtReferencia DATETIME default CURRENT_TIMESTAMP,
                tpMoeda VARCHAR(3) default null,
                noMoeda VARCHAR(3) default null,
                txCompra DECIMAL(15,8) default null,
                txVenda DECIMAL(15,8) default null,
                parCompra DECIMAL(15,8) default null,
                parVenda DECIMAL(15,8) default null
            );
            CREATE TABLE IF NOT EXISTS tb_controle_execucao(
                coControleExecucao INT PRIMARY KEY AUTO_INCREMENT,
                dtExecucao DATETIME,
                noArquivo VARCHAR(50),
                dsObservacao VARCHAR(200)
            )'''
    )

    load_cotacao = PythonOperator(
        task_id='load_cotacao',
        python_callable=load_cotacao_func
    )

    captura_cotacao >> transform_cotacao >> create_table >> load_cotacao
