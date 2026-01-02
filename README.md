# Dashboard de Cotações de Moedas 💱

Sistema completo para visualização e análise de variações de moedas com gráficos interativos, estatísticas em tempo real e comparações entre múltiplas moedas.

## 📋 Índice

- [Visão Geral](#visão-geral)
- [Funcionalidades](#funcionalidades)
- [Requisitos](#requisitos)
- [Instalação](#instalação)
- [Configuração](#configuração)
- [Uso](#uso)
- [API](#api)
- [Estrutura do Projeto](#estrutura-do-projeto)
- [Banco de Dados](#banco-de-dados)
- [Códigos de Moedas](#códigos-de-moedas)
- [Tecnologias](#tecnologias)

## 🎯 Visão Geral

O Dashboard de Cotações é uma aplicação web full-stack que permite monitorar e analisar variações de taxas de câmbio de diferentes moedas. Com interface moderna e responsiva, oferece visualizações através de gráficos de linha, estatísticas detalhadas e atualizações em tempo real.

## ✨ Funcionalidades

### Dashboard Principal
- **Visualização em Gráficos de Linha**: Acompanhe a evolução das taxas de compra/venda
- **Estatísticas em Tempo Real**:
  - Taxa de compra atual (6-8 casas decimais)
  - Taxa de venda atual (6-8 casas decimais)
  - Variação percentual (4 casas decimais)
  - Média do período selecionado
  - Volatilidade calculada
- **Períodos Ajustáveis**: 7, 15, 30, 60 ou 90 dias
- **Auto-atualização**: Atualização automática a cada 30 segundos (opcional)

### Comparação de Moedas
- Compare múltiplas moedas simultaneamente
- Visualização em gráfico de linha sobreposto
- Seleção múltipla de moedas

### Tabela de Histórico
- Últimas 20 cotações detalhadas
- Exibição de todas as taxas e paridades
- Formatação com alta precisão decimal

## 📦 Requisitos

- **Node.js** v14 ou superior
- **MySQL** 5.7 ou superior
- **Navegador** moderno (Chrome, Firefox, Safari, Edge)

## 🚀 Instalação

1. **Clone o repositório ou copie os arquivos para sua pasta**

2. **Instale as dependências:**
```bash
npm install
```

3. **Configure o banco de dados:**
- Certifique-se que o MySQL está rodando
- O banco de dados `appdb` deve existir
- A tabela `tb_cotacoes` deve estar criada (veja estrutura abaixo)

## ⚙️ Configuração

### Arquivo `.env`
Configure as variáveis de ambiente no arquivo `.env`:

```env
DB_HOST=127.0.0.1       # Host do MySQL
DB_PORT=3306            # Porta do MySQL
DB_USER=root            # Usuário do banco
DB_PASSWORD=root        # Senha do banco
DB_NAME=appdb           # Nome do banco de dados
PORT=3001               # Porta do servidor Node.js
```

## 🎮 Uso

### Iniciar o Servidor

**Modo produção:**
```bash
npm start
```

**Modo desenvolvimento (com auto-reload):**
```bash
npm run dev
```

### Acessar o Dashboard

Abra o navegador e acesse:
```
http://localhost:3001
```

### Navegação

1. **Selecionar Moeda**: Use o dropdown para escolher a moeda
2. **Ajustar Período**: Selecione o período de análise
3. **Atualizar Dados**: Clique em "Atualizar" ou ative auto-atualização
4. **Comparar Moedas**: Selecione múltiplas moedas e clique em "Comparar"

## 🔌 API

### Endpoints Disponíveis

#### `GET /api/moedas`
Lista todas as moedas disponíveis no banco.

**Resposta:**
```json
[
  {
    "coMoeda": 220,
    "noMoeda": "USD",
    "tpMoeda": "A"
  }
]
```

#### `GET /api/cotacoes/:coMoeda`
Busca cotações de uma moeda específica.

**Parâmetros:**
- `coMoeda`: Código da moeda
- `limite`: Número de registros (query param, opcional)

**Resposta:**
```json
[
  {
    "coMoeda": 220,
    "dtReferencia": "2024-11-01T00:00:00",
    "noMoeda": "USD",
    "txCompra": 5.4054,
    "txVenda": 5.4060,
    "parCompra": 1.0000,
    "parVenda": 1.0000
  }
]
```

#### `GET /api/variacao/:coMoeda`
Busca variação das cotações com estatísticas.

**Parâmetros:**
- `coMoeda`: Código da moeda
- `periodo`: Número de dias (query param, padrão: 30)

**Resposta:**
```json
[
  {
    "data": "2024-11-01",
    "mediaCompra": 5.4054,
    "mediaVenda": 5.4060,
    "minimoCompra": 5.4000,
    "maximoCompra": 5.4100,
    "minimoVenda": 5.4010,
    "maximoVenda": 5.4110,
    "noMoeda": "USD"
  }
]
```

#### `POST /api/comparar`
Compara múltiplas moedas.

**Body:**
```json
{
  "moedas": [220, 978, 165],
  "periodo": 30
}
```

## 📁 Estrutura do Projeto

```
front_cotacoes/
├── server.js           # Servidor Express + API REST
├── package.json        # Dependências e scripts
├── .env               # Configurações de ambiente
├── README.md          # Esta documentação
├── verificar-moedas.js # Script utilitário para listar moedas
└── public/            # Frontend
    ├── index.html     # Página principal
    ├── styles.css     # Estilos CSS
    └── app.js         # Lógica do frontend

```

## 🗄️ Banco de Dados

### Estrutura da Tabela

```sql
CREATE TABLE `tb_cotacoes` (
  `coMoeda` int NOT NULL,
  `dtReferencia` datetime DEFAULT CURRENT_TIMESTAMP,
  `tpMoeda` varchar(3) DEFAULT NULL,
  `noMoeda` varchar(3) DEFAULT NULL,
  `txCompra` decimal(15,8) DEFAULT NULL,
  `txVenda` decimal(15,8) DEFAULT NULL,
  `parCompra` decimal(15,8) DEFAULT NULL,
  `parVenda` decimal(15,8) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

### Descrição dos Campos

| Campo | Tipo | Descrição |
|-------|------|-----------|
| **coMoeda** | int | Código identificador único da moeda |
| **dtReferencia** | datetime | Data/hora da cotação |
| **tpMoeda** | varchar(3) | Tipo da moeda |
| **noMoeda** | varchar(3) | Código da moeda (USD, EUR, etc) |
| **txCompra** | decimal(15,8) | Taxa de compra com 8 casas decimais |
| **txVenda** | decimal(15,8) | Taxa de venda com 8 casas decimais |
| **parCompra** | decimal(15,8) | Paridade de compra |
| **parVenda** | decimal(15,8) | Paridade de venda |

## 💱 Códigos de Moedas

### Principais Moedas Identificadas

| Código | Moeda | Descrição |
|--------|-------|-----------|
| **220** | USD | Dólar Americano |
| **978** | EUR | Euro |
| **165** | CAD | Dólar Canadense |
| **540** | GBP | Libra Esterlina |
| **470** | JPY | Iene Japonês |

### Verificar Moedas Disponíveis

Execute o script utilitário para listar todas as moedas:
```bash
node verificar-moedas.js
```

## 🛠️ Tecnologias

### Backend
- **Node.js**: Runtime JavaScript
- **Express**: Framework web
- **MySQL2**: Driver MySQL
- **CORS**: Habilitação de CORS
- **Dotenv**: Variáveis de ambiente

### Frontend
- **HTML5**: Estrutura
- **CSS3**: Estilização com gradientes e animações
- **JavaScript ES6+**: Lógica e interatividade
- **Chart.js**: Biblioteca de gráficos
- **Date-fns**: Manipulação de datas

### Características Técnicas
- **Alta Precisão**: 6-8 casas decimais para valores monetários
- **Responsivo**: Adaptável a diferentes tamanhos de tela
- **Tempo Real**: Atualização automática opcional
- **Performance**: Queries otimizadas e cache de dados

## 📊 Recursos Adicionais

### Scripts Úteis

**Verificar conectividade do banco:**
```bash
node verificar-moedas.js
```

**Logs do servidor:**
```bash
npm start
# Servidor rodando na porta 3001
# Conectado ao banco de dados MySQL
```

### Solução de Problemas

1. **Erro de conexão com MySQL:**
   - Verifique se o MySQL está rodando
   - Confirme credenciais no arquivo `.env`
   - Teste conexão: `mysql -u root -p`

2. **Porta 3001 em uso:**
   - Altere a porta no arquivo `.env`
   - Ou finalize o processo: `lsof -i :3001` e `kill -9 [PID]`

3. **Dados não aparecem:**
   - Verifique se há dados na tabela `tb_cotacoes`
   - Confirme os códigos de moeda usando `verificar-moedas.js`

## 📝 Licença

Este projeto foi desenvolvido para fins educacionais e de demonstração.

## 👨‍💻 Autor

Dashboard de Cotações - Sistema de análise de variações de moedas com alta precisão decimal.