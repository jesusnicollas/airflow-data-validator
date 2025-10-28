# 🚀 Apache Airflow - DAG Validador de Dados

Este repositório contém exemplos práticos de **Apache Airflow** para orquestração de workflows de dados. O projeto demonstra conceitos fundamentais como **XCom**, **BranchPythonOperator** e integração com APIs externas.

## 📋 Sobre o Projeto

Este DAG implementa um **validador de dados** que:
- Consome dados de uma API pública (NYC Open Data)
- Valida a quantidade de registros retornados
- Executa diferentes fluxos baseado na validação (branching)

## 🏗️ Arquitetura do DAG

```
graph TD
    A[captura_conta_dados] --> B[e_valida]
    B --> C[valido]
    B --> D[nvalido]
```


### Fluxo de Execução:

1. **`captura_conta_dados`** → Faz requisição HTTP para API e conta registros
2. **`e_valida`** → Valida se quantidade ≥ 1000 registros
3. **`valido`** → Executado se validação passou
4. **`nvalido`** → Executado se validação falhou

## 🔧 Tecnologias Utilizadas

- **Apache Airflow** - Orquestração de workflows
- **Python 3.9+** - Linguagem principal
- **Pandas** - Manipulação de dados
- **Requests** - Consumo de APIs
- **NYC Open Data API** - Fonte de dados externa

## 📦 Dependências

```python
# Principais dependências
airflow
pandas
requests
```


## 🚀 Como Executar

### 1. Pré-requisitos
```shell script
# Instalar Apache Airflow
pip install apache-airflow

# Instalar dependências adicionais
pip install pandas requests
```


### 2. Configuração
```shell script
# Copiar DAG para pasta do Airflow
cp dag_validador.py $AIRFLOW_HOME/dags/

# Iniciar webserver do Airflow
airflow webserver --port 8080

# Iniciar scheduler (em outro terminal)
airflow scheduler
```


### 3. Execução
- Acesse o Airflow UI: http://localhost:8080
- Ative o DAG `dag_validador`
- O DAG executará automaticamente a cada 30 minutos

## 📊 Conceitos Demonstrados

### 🔄 XCom (Cross Communication)
```python
# Função que retorna dados
def captura_conta_dados_func():
    qtd = len(df.index)
    return qtd  # Automaticamente salvo no XCom

# Função que consome dados
def e_valida_func(ti):
    qtd = ti.xcom_pull(task_ids='captura_conta_dados')  # Recupera do XCom
```


### 🌿 Branching (Fluxo Condicional)
```python
# BranchPythonOperator permite fluxos condicionais
def e_valida_func(ti):
    qtd = ti.xcom_pull(task_ids='captura_conta_dados')
    if qtd >= 1000:
        return 'valido'    # Executa task 'valido'
    return 'nvalido'       # Executa task 'nvalido'
```


### 📅 Scheduling
```python
# DAG executado a cada 30 minutos
schedule_interval='30 * * * *'
```


## 📈 Monitoramento

O DAG inclui logs detalhados para monitoramento:
- **Quantidade de registros** capturados
- **Status da validação** (aprovado/reprovado)
- **Tempo de execução** de cada task

## 🛠️ Possíveis Melhorias

- [ ] Adicionar notificações por email/Slack
- [ ] Implementar retry automático
- [ ] Salvar dados em banco de dados
- [ ] Adicionar testes unitários
- [ ] Configurar alertas de SLA

## 📚 Recursos de Aprendizado

- [Documentação oficial do Airflow](https://airflow.apache.org/docs/)
- [Airflow XCom Guide](https://airflow.apache.org/docs/apache-airflow/stable/core-concepts/xcoms.html)
- [BranchPythonOperator](https://airflow.apache.org/docs/apache-airflow/stable/howto/operator/python.html#branching)

## 🤝 Contribuindo

Este é um projeto de estudos! Sinta-se à vontade para:
- Abrir issues com dúvidas
- Sugerir melhorias
- Criar pull requests com novos exemplos

## 📄 Licença

Este projeto está sob licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

---

⭐ **Se este projeto te ajudou a aprender Airflow, deixe uma estrela!** ⭐