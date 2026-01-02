// Variáveis globais
let chartPrincipal = null;
let chartComparacao = null;
let autoUpdateInterval = null;
let moedaAtual = null; // Nenhuma moeda selecionada inicialmente

// Mapa de códigos de moedas CORRETOS do banco
const moedasConhecidas = {
    220: { nome: 'USD', descricao: 'Dólar Americano' },
    978: { nome: 'EUR', descricao: 'Euro' },
    165: { nome: 'CAD', descricao: 'Dólar Canadense' },
    540: { nome: 'GBP', descricao: 'Libra Esterlina' },
    470: { nome: 'JPY', descricao: 'Iene Japonês' }
};

// Inicialização
document.addEventListener('DOMContentLoaded', async () => {
    await carregarMoedas();
    // Não carregar dados automaticamente - mostrar estado inicial
    mostrarEstadoInicial();

    // Event listeners
    document.getElementById('moedaSelect').addEventListener('change', atualizarDashboard);
    document.getElementById('periodoSelect').addEventListener('change', atualizarDashboard);
    document.getElementById('atualizarBtn').addEventListener('click', atualizarDashboard);
    document.getElementById('autoUpdateBtn').addEventListener('click', toggleAutoUpdate);
    document.getElementById('compararBtn').addEventListener('click', compararMoedas);
});

// Mostrar estado inicial do dashboard
function mostrarEstadoInicial() {
    // Limpar estatísticas com classe placeholder
    const taxaCompra = document.getElementById('taxaCompraAtual');
    const taxaVenda = document.getElementById('taxaVendaAtual');

    taxaCompra.textContent = 'Selecione uma moeda';
    taxaCompra.className = 'stat-value placeholder';

    taxaVenda.textContent = 'Selecione uma moeda';
    taxaVenda.className = 'stat-value placeholder';

    document.getElementById('variacaoCompra').textContent = '-';
    document.getElementById('variacaoCompra').className = 'stat-change';

    document.getElementById('variacaoVenda').textContent = '-';
    document.getElementById('variacaoVenda').className = 'stat-change';

    document.getElementById('mediaPeriodo').textContent = '-';
    document.getElementById('mediaPeriodo').className = 'stat-value';

    document.getElementById('volatilidade').textContent = '-';
    document.getElementById('volatilidade').className = 'stat-value';

    // Mostrar mensagem no gráfico principal
    const ctx = document.getElementById('chartPrincipal').getContext('2d');
    if (chartPrincipal) {
        chartPrincipal.destroy();
    }
    chartPrincipal = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: []
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Selecione uma moeda para visualizar as cotações',
                    font: {
                        size: 16
                    }
                }
            }
        }
    });

    // Limpar tabela
    const tbody = document.querySelector('#tabelaCotacoes tbody');
    tbody.innerHTML = '<tr><td colspan="6" class="loading">Selecione uma moeda para ver o histórico de cotações</td></tr>';
}

// Carregar lista de moedas disponíveis
async function carregarMoedas() {
    try {
        const response = await fetch('/api/moedas');
        const moedas = await response.json();

        const select = document.getElementById('moedaSelect');
        const selectComparar = document.getElementById('moedasComparar');

        select.innerHTML = '<option value="">Selecione uma moeda...</option>';
        selectComparar.innerHTML = '';

        moedas.forEach(moeda => {
            const info = moedasConhecidas[moeda.coMoeda] || { nome: moeda.noMoeda, descricao: moeda.tpMoeda };

            const option = new Option(`${info.nome} (${moeda.coMoeda})`, moeda.coMoeda);
            select.add(option);

            const optionComparar = new Option(`${info.nome} (${moeda.coMoeda})`, moeda.coMoeda);
            selectComparar.add(optionComparar);
        });

        // Não selecionar nenhuma moeda por padrão
    } catch (error) {
        console.error('Erro ao carregar moedas:', error);
        mostrarErro('Erro ao carregar lista de moedas');
    }
}

// Atualizar dashboard principal
async function atualizarDashboard() {
    const coMoeda = document.getElementById('moedaSelect').value;
    const periodo = document.getElementById('periodoSelect').value;

    if (!coMoeda) return;

    moedaAtual = coMoeda;

    try {
        // Buscar dados de variação
        const [variacaoResponse, cotacoesResponse] = await Promise.all([
            fetch(`/api/variacao/${coMoeda}?periodo=${periodo}`),
            fetch(`/api/cotacoes/${coMoeda}?limite=20`)
        ]);

        const variacao = await variacaoResponse.json();
        const cotacoes = await cotacoesResponse.json();

        // Atualizar estatísticas
        atualizarEstatisticas(variacao, cotacoes);

        // Atualizar gráfico principal
        atualizarGraficoPrincipal(variacao);

        // Atualizar tabela
        atualizarTabela(cotacoes);

    } catch (error) {
        console.error('Erro ao atualizar dashboard:', error);
        mostrarErro('Erro ao carregar dados');
    }
}

// Atualizar estatísticas
function atualizarEstatisticas(variacao, cotacoes) {
    if (cotacoes.length > 0) {
        const ultimaCotacao = cotacoes[0];
        const penultimaCotacao = cotacoes[1] || cotacoes[0];

        // Taxa de compra atual
        const taxaCompraElem = document.getElementById('taxaCompraAtual');
        taxaCompraElem.textContent = formatarMoeda(ultimaCotacao.txCompra);
        taxaCompraElem.className = 'stat-value'; // Remove classe placeholder

        // Taxa de venda atual
        const taxaVendaElem = document.getElementById('taxaVendaAtual');
        taxaVendaElem.textContent = formatarMoeda(ultimaCotacao.txVenda);
        taxaVendaElem.className = 'stat-value'; // Remove classe placeholder

        // Variação de compra (com 4 casas decimais para precisão)
        const varCompra = ((ultimaCotacao.txCompra - penultimaCotacao.txCompra) / penultimaCotacao.txCompra * 100);
        const elemVarCompra = document.getElementById('variacaoCompra');
        elemVarCompra.textContent = `${varCompra >= 0 ? '↑' : '↓'} ${Math.abs(varCompra).toFixed(4)}%`;
        elemVarCompra.className = `stat-change ${varCompra >= 0 ? 'positive' : 'negative'}`;

        // Variação de venda (com 4 casas decimais para precisão)
        const varVenda = ((ultimaCotacao.txVenda - penultimaCotacao.txVenda) / penultimaCotacao.txVenda * 100);
        const elemVarVenda = document.getElementById('variacaoVenda');
        elemVarVenda.textContent = `${varVenda >= 0 ? '↑' : '↓'} ${Math.abs(varVenda).toFixed(4)}%`;
        elemVarVenda.className = `stat-change ${varVenda >= 0 ? 'positive' : 'negative'}`;
    }

    if (variacao.length > 0) {
        // Média do período
        const mediaCompra = variacao.reduce((acc, v) => acc + parseFloat(v.mediaCompra), 0) / variacao.length;
        document.getElementById('mediaPeriodo').textContent = formatarMoeda(mediaCompra);

        // Volatilidade (desvio padrão)
        const valores = variacao.map(v => parseFloat(v.mediaCompra));
        const media = valores.reduce((a, b) => a + b, 0) / valores.length;
        const variancia = valores.reduce((acc, val) => acc + Math.pow(val - media, 2), 0) / valores.length;
        const desvioPadrao = Math.sqrt(variancia);
        const volatilidade = (desvioPadrao / media * 100).toFixed(4);
        document.getElementById('volatilidade').textContent = `${volatilidade}%`;
    }
}

// Atualizar gráfico principal
function atualizarGraficoPrincipal(dados) {
    const ctx = document.getElementById('chartPrincipal').getContext('2d');

    // Ordenar dados por data
    dados.sort((a, b) => new Date(a.data) - new Date(b.data));

    const labels = dados.map(d => formatarData(d.data));
    const dataCompra = dados.map(d => parseFloat(d.mediaCompra));
    const dataVenda = dados.map(d => parseFloat(d.mediaVenda));
    const dataMaximo = dados.map(d => parseFloat(d.maximoCompra));
    const dataMinimo = dados.map(d => parseFloat(d.minimoCompra));

    if (chartPrincipal) {
        chartPrincipal.destroy();
    }

    chartPrincipal = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Taxa de Compra',
                    data: dataCompra,
                    borderColor: 'rgb(75, 192, 192)',
                    backgroundColor: 'rgba(75, 192, 192, 0.1)',
                    tension: 0.1,
                    fill: false
                },
                {
                    label: 'Taxa de Venda',
                    data: dataVenda,
                    borderColor: 'rgb(255, 99, 132)',
                    backgroundColor: 'rgba(255, 99, 132, 0.1)',
                    tension: 0.1,
                    fill: false
                },
                {
                    label: 'Máximo',
                    data: dataMaximo,
                    borderColor: 'rgb(54, 162, 235)',
                    backgroundColor: 'rgba(54, 162, 235, 0.1)',
                    borderDash: [5, 5],
                    tension: 0.1,
                    fill: false
                },
                {
                    label: 'Mínimo',
                    data: dataMinimo,
                    borderColor: 'rgb(255, 206, 86)',
                    backgroundColor: 'rgba(255, 206, 86, 0.1)',
                    borderDash: [5, 5],
                    tension: 0.1,
                    fill: false
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top'
                },
                title: {
                    display: true,
                    text: 'Evolução das Taxas de Câmbio'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            // Mostrar valor com 8 casas decimais no tooltip
                            label += new Intl.NumberFormat('pt-BR', {
                                minimumFractionDigits: 8,
                                maximumFractionDigits: 8
                            }).format(context.parsed.y);
                            return label;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    ticks: {
                        callback: function(value) {
                            return formatarMoeda(value);
                        }
                    }
                }
            }
        }
    });
}

// Comparar múltiplas moedas
async function compararMoedas() {
    const select = document.getElementById('moedasComparar');
    const moedas = Array.from(select.selectedOptions).map(o => o.value);
    const periodo = document.getElementById('periodoSelect').value;

    if (moedas.length === 0) {
        alert('Selecione pelo menos uma moeda para comparar');
        return;
    }

    try {
        const response = await fetch('/api/comparar', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ moedas, periodo })
        });

        const dados = await response.json();
        atualizarGraficoComparacao(dados);
    } catch (error) {
        console.error('Erro ao comparar moedas:', error);
        mostrarErro('Erro ao comparar moedas');
    }
}

// Atualizar gráfico de comparação
function atualizarGraficoComparacao(dados) {
    const ctx = document.getElementById('chartComparacao').getContext('2d');

    // Agrupar dados por moeda
    const moedasMap = {};
    dados.forEach(item => {
        if (!moedasMap[item.noMoeda]) {
            moedasMap[item.noMoeda] = {
                label: item.noMoeda,
                datas: [],
                valores: []
            };
        }
        moedasMap[item.noMoeda].datas.push(item.data);
        moedasMap[item.noMoeda].valores.push(parseFloat(item.mediaCompra));
    });

    // Obter todas as datas únicas e ordenar
    const todasDatas = [...new Set(dados.map(d => d.data))].sort();

    // Criar datasets
    const datasets = Object.values(moedasMap).map((moeda, index) => {
        const cores = [
            'rgb(75, 192, 192)',
            'rgb(255, 99, 132)',
            'rgb(54, 162, 235)',
            'rgb(255, 206, 86)',
            'rgb(153, 102, 255)'
        ];

        return {
            label: moeda.label,
            data: todasDatas.map(data => {
                const idx = moeda.datas.indexOf(data);
                return idx !== -1 ? moeda.valores[idx] : null;
            }),
            borderColor: cores[index % cores.length],
            backgroundColor: cores[index % cores.length].replace('rgb', 'rgba').replace(')', ', 0.1)'),
            tension: 0.1,
            fill: false
        };
    });

    if (chartComparacao) {
        chartComparacao.destroy();
    }

    chartComparacao = new Chart(ctx, {
        type: 'line',
        data: {
            labels: todasDatas.map(d => formatarData(d)),
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top'
                },
                title: {
                    display: true,
                    text: 'Comparação entre Moedas'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            // Mostrar valor com 8 casas decimais no tooltip
                            if (context.parsed.y !== null) {
                                label += new Intl.NumberFormat('pt-BR', {
                                    minimumFractionDigits: 8,
                                    maximumFractionDigits: 8
                                }).format(context.parsed.y);
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    ticks: {
                        callback: function(value) {
                            return formatarMoeda(value);
                        }
                    }
                }
            }
        }
    });
}

// Atualizar tabela de cotações
function atualizarTabela(cotacoes) {
    const tbody = document.querySelector('#tabelaCotacoes tbody');

    if (cotacoes.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="loading">Nenhuma cotação encontrada</td></tr>';
        return;
    }

    tbody.innerHTML = cotacoes.map(cotacao => `
        <tr>
            <td>${formatarDataHora(cotacao.dtReferencia)}</td>
            <td>${cotacao.noMoeda} (${cotacao.coMoeda})</td>
            <td>${formatarMoeda(cotacao.txCompra)}</td>
            <td>${formatarMoeda(cotacao.txVenda)}</td>
            <td>${formatarMoeda(cotacao.parCompra)}</td>
            <td>${formatarMoeda(cotacao.parVenda)}</td>
        </tr>
    `).join('');
}

// Toggle auto-update
function toggleAutoUpdate() {
    const btn = document.getElementById('autoUpdateBtn');

    if (autoUpdateInterval) {
        clearInterval(autoUpdateInterval);
        autoUpdateInterval = null;
        btn.textContent = 'Auto-atualização: OFF';
        btn.classList.remove('active');
    } else {
        autoUpdateInterval = setInterval(atualizarDashboard, 30000); // Atualiza a cada 30 segundos
        btn.textContent = 'Auto-atualização: ON';
        btn.classList.add('active');
    }
}

// Funções auxiliares
function formatarMoeda(valor) {
    // Usar 8 casas decimais para máxima precisão (conforme o banco: decimal(15,8))
    return new Intl.NumberFormat('pt-BR', {
        minimumFractionDigits: 6,
        maximumFractionDigits: 8
    }).format(valor);
}

function formatarData(data) {
    return new Date(data).toLocaleDateString('pt-BR');
}

function formatarDataHora(data) {
    return new Date(data).toLocaleString('pt-BR');
}

function mostrarErro(mensagem) {
    console.error(mensagem);
    // Aqui você pode adicionar uma notificação visual para o usuário
}