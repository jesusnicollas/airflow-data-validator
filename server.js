const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Conexão com o banco de dados
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

db.connect((err) => {
  if (err) {
    console.error('Erro ao conectar com o banco:', err);
    return;
  }
  console.log('Conectado ao banco de dados MySQL');
});

// Rota para buscar lista de moedas disponíveis
app.get('/api/moedas', (req, res) => {
  const query = `
    SELECT DISTINCT coMoeda, noMoeda, tpMoeda
    FROM tb_cotacoes
    ORDER BY noMoeda
  `;

  db.query(query, (err, results) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(results);
  });
});

// Rota para buscar cotações de uma moeda específica
app.get('/api/cotacoes/:coMoeda', (req, res) => {
  const { coMoeda } = req.params;
  const { limite = 100 } = req.query;

  const query = `
    SELECT
      coMoeda,
      dtReferencia,
      tpMoeda,
      noMoeda,
      txCompra,
      txVenda,
      parCompra,
      parVenda
    FROM tb_cotacoes
    WHERE coMoeda = ?
    ORDER BY dtReferencia DESC
    LIMIT ?
  `;

  db.query(query, [parseInt(coMoeda), parseInt(limite)], (err, results) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(results);
  });
});

// Rota para buscar variação das cotações
app.get('/api/variacao/:coMoeda', (req, res) => {
  const { coMoeda } = req.params;
  const { periodo = 30 } = req.query; // Últimos 30 dias por padrão

  const query = `
    SELECT
      DATE(dtReferencia) as data,
      AVG(txCompra) as mediaCompra,
      AVG(txVenda) as mediaVenda,
      MIN(txCompra) as minimoCompra,
      MAX(txCompra) as maximoCompra,
      MIN(txVenda) as minimoVenda,
      MAX(txVenda) as maximoVenda,
      noMoeda
    FROM tb_cotacoes
    WHERE coMoeda = ?
      AND dtReferencia >= DATE_SUB(NOW(), INTERVAL ? DAY)
    GROUP BY DATE(dtReferencia), noMoeda
    ORDER BY data DESC
  `;

  db.query(query, [parseInt(coMoeda), parseInt(periodo)], (err, results) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(results);
  });
});

// Rota para comparar múltiplas moedas
app.post('/api/comparar', (req, res) => {
  const { moedas, periodo = 30 } = req.body;

  if (!moedas || !Array.isArray(moedas)) {
    res.status(400).json({ error: 'Lista de moedas é obrigatória' });
    return;
  }

  const placeholders = moedas.map(() => '?').join(',');
  const query = `
    SELECT
      coMoeda,
      noMoeda,
      DATE(dtReferencia) as data,
      AVG(txCompra) as mediaCompra,
      AVG(txVenda) as mediaVenda
    FROM tb_cotacoes
    WHERE coMoeda IN (${placeholders})
      AND dtReferencia >= DATE_SUB(NOW(), INTERVAL ? DAY)
    GROUP BY coMoeda, noMoeda, DATE(dtReferencia)
    ORDER BY data DESC, noMoeda
  `;

  db.query(query, [...moedas, parseInt(periodo)], (err, results) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(results);
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});