FROM apache/airflow:2.9.3

USER root

# Instalar Java (OpenJDK 11)
RUN apt-get update && \
    apt-get install -y openjdk-17-jdk-headless && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Configurar JAVA_HOME
ENV JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
ENV PATH=$JAVA_HOME/bin:$PATH

USER airflow

# Instalar dependências Python
RUN pip install --no-cache-dir \
    pyspark==3.5.1 \
    mysql-connector-python