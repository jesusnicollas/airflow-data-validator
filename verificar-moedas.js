const mysql = require('mysql2');
require('dotenv').config();

// Conexão com o banco de dados
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

console.log('Conectando ao banco de dados...\n');

db.connect((err) => {
  if (err) {
    console.error('Erro ao conectar:', err);
    return;
  }

  console.log('✓ Conectado ao MySQL\n');
  console.log('Verificando moedas disponíveis no banco...\n');
  console.log('='.repeat(80));

  // Buscar todas as moedas distintas
  const query = `
    SELECT DISTINCT
      coMoeda,
      noMoeda,
      tpMoeda,
      COUNT(*) as total_registros,
      MIN(dtReferencia) as primeira_cotacao,
      MAX(dtReferencia) as ultima_cotacao,
      AVG(txCompra) as media_compra,
      AVG(txVenda) as media_venda
    FROM tb_cotacoes
    GROUP BY coMoeda, noMoeda, tpMoeda
    ORDER BY coMoeda
  `;

  db.query(query, (err, results) => {
    if (err) {
      console.error('Erro na consulta:', err);
      db.end();
      return;
    }

    console.log(`Total de moedas encontradas: ${results.length}\n`);
    console.log('='.repeat(80));

    // Mapear códigos ISO conhecidos
    const codigosISO = {
      // Americas
      840: 'USD - Dólar Americano',
      124: 'CAD - Dólar Canadense',
      986: 'BRL - Real Brasileiro',
      032: 'ARS - Peso Argentino',
      152: 'CLP - Peso Chileno',
      170: 'COP - Peso Colombiano',
      484: 'MXN - Peso Mexicano',
      604: 'PEN - Sol Peruano',
      858: 'UYU - Peso Uruguaio',

      // Europa
      978: 'EUR - Euro',
      826: 'GBP - Libra Esterlina',
      756: 'CHF - Franco Suíço',
      752: 'SEK - Coroa Sueca',
      578: 'NOK - Coroa Norueguesa',
      208: 'DKK - Coroa Dinamarquesa',
      985: 'PLN - Zloty Polonês',
      203: 'CZK - Coroa Tcheca',
      946: 'RON - Leu Romeno',

      // Ásia
      392: 'JPY - Iene Japonês',
      156: 'CNY - Yuan Chinês',
      344: 'HKD - Dólar de Hong Kong',
      702: 'SGD - Dólar de Singapura',
      410: 'KRW - Won Sul-Coreano',
      458: 'MYR - Ringgit Malaio',
      764: 'THB - Baht Tailandês',
      356: 'INR - Rupia Indiana',
      360: 'IDR - Rupia Indonésia',

      // Oceania
      036: 'AUD - Dólar Australiano',
      554: 'NZD - Dólar Neozelandês',

      // África
      710: 'ZAR - Rand Sul-Africano',

      // Oriente Médio
      376: 'ILS - Shekel Israelense',
      949: 'TRY - Lira Turca',
      784: 'AED - Dirham dos Emirados',
      682: 'SAR - Riyal Saudita'
    };

    results.forEach((moeda, index) => {
      console.log(`\n${index + 1}. Código: ${moeda.coMoeda}`);
      console.log(`   Nome no banco: ${moeda.noMoeda || 'N/A'}`);
      console.log(`   Tipo: ${moeda.tpMoeda || 'N/A'}`);

      // Verificar se conhecemos este código
      const descricaoISO = codigosISO[moeda.coMoeda];
      if (descricaoISO) {
        console.log(`   ✓ Moeda identificada: ${descricaoISO}`);
      } else {
        console.log(`   ⚠ Código não identificado no padrão ISO 4217`);
      }

      console.log(`   Total de registros: ${moeda.total_registros}`);
      console.log(`   Primeira cotação: ${new Date(moeda.primeira_cotacao).toLocaleString('pt-BR')}`);
      console.log(`   Última cotação: ${new Date(moeda.ultima_cotacao).toLocaleString('pt-BR')}`);
      console.log(`   Média taxa compra: ${moeda.media_compra ? parseFloat(moeda.media_compra).toFixed(4) : 'N/A'}`);
      console.log(`   Média taxa venda: ${moeda.media_venda ? parseFloat(moeda.media_venda).toFixed(4) : 'N/A'}`);
      console.log('   ' + '-'.repeat(60));
    });

    console.log('\n' + '='.repeat(80));
    console.log('\nResumo:');
    console.log(`- Total de moedas: ${results.length}`);
    console.log(`- Moedas identificadas: ${results.filter(m => codigosISO[m.coMoeda]).length}`);
    console.log(`- Moedas não identificadas: ${results.filter(m => !codigosISO[m.coMoeda]).length}`);

    // Listar apenas os códigos para fácil cópia
    console.log('\n' + '='.repeat(80));
    console.log('\nCódigos encontrados (para copiar):');
    console.log(results.map(m => m.coMoeda).join(', '));

    db.end();
  });
});