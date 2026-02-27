// htmltestedeproducao.js

document.addEventListener('DOMContentLoaded', function () {
    // --- CARREGAMENTO INICIAL DE DADOS ---
    personalizarSaudacao();
    carregarDadosDashboard();
    carregarAgendaSemana(); 
    carregarSalasMaisUsadas();
    criarGraficoSalas();
    popularSeletorSalas(); // Carrega as salas no novo seletor
    popularSeletorUnidades();
    iniciarContadorSessao();
// --- MANIPULADORES DE ELEMENTOS ---
    // --- MANIPULADORES DE ELEMENTOS ---
    const allInteractiveSections = [
        document.getElementById('agendamentoForm'),
        document.getElementById('filtros'),
        document.getElementById('secaoRelatorios'),
        document.getElementById('secaoSalas')
    ];
    const graficoContainer = document.getElementById('graficoContainer');

    // Mapeamento dos botões do menu às suas seções correspondentes
    const menuButtons = {
        'mostrarFormularioBtn': document.getElementById('agendamentoForm'),
        'mostrarRelatoriosBtn': document.getElementById('secaoRelatorios'),
        'mostrarSalasBtn': document.getElementById('secaoSalas')
    };
   let relatoriosCarregados = false; // Flag para carregar relatórios apenas uma vez
    // --- FUNÇÃO CENTRALIZADA PARA RESETAR A TELA ---
    function resetarParaDashboardPrincipal() {
        allInteractiveSections.forEach(el => el && el.classList.remove('visivel'));
        if (graficoContainer) {
            graficoContainer.style.display = 'block';
        }
    }

    // --- LÓGICA DE CLIQUE UNIFICADA PARA OS BOTÕES DE SEÇÃO ---
    Object.keys(menuButtons).forEach(buttonId => {
        const button = document.getElementById(buttonId);
        const section = menuButtons[buttonId];

        if (button && section) {
            button.addEventListener('click', (event) => {
                event.preventDefault(); // Previne qualquer comportamento padrão do <li>
                const estavaVisivel = section.classList.contains('visivel');
                
                resetarParaDashboardPrincipal();

                if (!estavaVisivel) {
                    section.classList.add('visivel');
                    if (graficoContainer) graficoContainer.style.display = 'none';

                    // Carrega dados específicos se for a primeira vez
                    if (buttonId === 'mostrarRelatoriosBtn' && !relatoriosCarregados) {
                        carregarTodosOsRelatorios();
                        relatoriosCarregados = true;
                    }
                }
            });
        }
    });
    // --- CORREÇÃO: EVENTOS PARA OS BOTÕES DE NAVEGAÇÃO ---
    const botaoInicio = document.querySelector('li[onclick*="http://10.165.128.68:3000/"]');
    if (botaoInicio) {
        const url = botaoInicio.getAttribute('onclick').match(/window.location.href='(.*?)'/)[1];
        botaoInicio.removeAttribute('onclick');
        botaoInicio.addEventListener('click', () => {
            window.location.href = url;
        });
    }

    const botaoCompleta = document.querySelector('li[onclick*="agendas-api.html"]');
    if (botaoCompleta) {
        const url = botaoCompleta.getAttribute('onclick').match(/window.location.href='(.*?)'/)[1];
        botaoCompleta.removeAttribute('onclick');
        botaoCompleta.addEventListener('click', () => {
            window.location.href = url;
        });
    }

    // --- EVENT LISTENERS PARA OS SELETORES DE SALAS ---
    const seletorDeUnidade = document.getElementById('seletorDeUnidade');
    if (seletorDeUnidade) {
        seletorDeUnidade.addEventListener('change', (event) => {
            const codigoUnidade = event.target.value;
            popularSeletorSalas(codigoUnidade);
            document.getElementById('containerDetalheSala').style.display = 'none';
        });
    }

    const seletorDeSala = document.getElementById('seletorDeSala');
    if (seletorDeSala) {
        seletorDeSala.addEventListener('change', (event) => {
            const salaId = event.target.value;
            if (salaId) {
                desenharSala(salaId);
            } else {
                document.getElementById('containerDetalheSala').style.display = 'none';
            }
        });
    }
});


// ==========================================================
// FUNÇÕES DE CARREGAMENTO E MANIPULAÇÃO DE DADOS
// ==========================================================

async function personalizarSaudacao() {
    try {
        const response = await fetch('/user-info');
        if (!response.ok) return;
        const usuario = await response.json();
        const nomeProfessor = usuario.nome.split(' ')[0];
        const hora = new Date().getHours();
        let saudacao;
        if (hora >= 5 && hora < 12) { saudacao = "Bom dia"; }
        else if (hora >= 12 && hora < 18) { saudacao = "Boa tarde"; }
        else { saudacao = "Boa noite"; }
        const elementoTitulo = document.getElementById('saudacaoDashboard');
        if (elementoTitulo) { elementoTitulo.textContent = `${saudacao}, ${nomeProfessor}!`; }
    } catch (error) { console.error('Erro ao personalizar a saudação:', error); }
}

async function carregarTodosOsRelatorios() {
    carregarRelatorioHorasUc();
    carregarRelatorioUsoSalas();
    carregarRelatorioPorPeriodo();
}

async function carregarRelatorioHorasUc() {
    const container = document.getElementById('relatorioHorasUc');
    try {
        const response = await fetch('/relatorio/horas-por-uc');
        if (!response.ok) throw new Error('Falha ao buscar dados.');
        const data = await response.json();
        if (data.length === 0) {
            container.innerHTML = '<p>Nenhum dado encontrado para este relatório.</p>'; return;
        }
        let html = '<ul>';
        data.forEach(item => { html += `<li><strong>${item.tipo_aula}:</strong> ${item.horas}h ${item.minutos}min</li>`; });
        html += '</ul>';
        container.innerHTML = html;
    } catch (error) {
        container.innerHTML = '<p style="color: red;">Erro ao carregar relatório.</p>';
        console.error('Erro no relatório Horas/UC:', error);
    }
}

async function carregarRelatorioUsoSalas() {
    const container = document.getElementById('relatorioUsoSalas');
    try {
        const response = await fetch('/relatorio/uso-salas');
        if (!response.ok) throw new Error('Falha ao buscar dados.');
        const data = await response.json();
        if (data.length === 0) {
            container.innerHTML = '<p>Nenhum dado encontrado para este relatório.</p>'; return;
        }
        let html = '<ul>';
        data.forEach(item => { html += `<li><strong>${item.nome_sala}:</strong> ${item.quantidade_usos} vez(es) - Total: ${item.horas}h ${item.minutos}min</li>`; });
        html += '</ul>';
        container.innerHTML = html;
    } catch (error) {
        container.innerHTML = '<p style="color: red;">Erro ao carregar relatório.</p>';
        console.error('Erro no relatório Uso de Salas:', error);
    }
}

async function carregarRelatorioPorPeriodo() {
    const container = document.getElementById('relatorioPorPeriodo');
    try {
        const response = await fetch('/relatorio/agendamentos-periodo');
        if (!response.ok) throw new Error('Falha ao buscar dados.');
        const data = await response.json();
        if (data.length === 0) {
            container.innerHTML = '<p>Nenhum dado encontrado para este relatório.</p>'; return;
        }
        let html = '<ul>';
        data.forEach(item => { html += `<li><strong>${item.dia_semana} (${item.turno}):</strong> ${item.quantidade} agendamento(s)</li>`; });
        html += '</ul>';
        container.innerHTML = html;
    } catch (error) {
        container.innerHTML = '<p style="color: red;">Erro ao carregar relatório.</p>';
        console.error('Erro no relatório por Período:', error);
    }
}

function toggleMenu() {
    const sidebar = document.querySelector('.sidebar');
    sidebar.classList.toggle('collapsed');
}

async function carregarDadosDashboard() {
    try {
        const response = await fetch('/horas-agendadas-mes');
        const data = await response.json();
        document.getElementById('horasAgendadasMes').textContent = `${data.horas}h ${data.minutos}min`;
        document.getElementById('agendamentosMes').textContent = data.agendamentos;
        document.getElementById('salasUtilizadasMes').textContent = data.salas_utilizadas;
        document.getElementById('taxaOcupacaoMes').textContent = `${data.taxa_ocupacao.toFixed(2)}%`;
    } catch (error) {
        console.error('Erro ao carregar dados da dashboard:', error);
        document.getElementById('horasAgendadasMes').textContent = 'Erro';
        document.getElementById('agendamentosMes').textContent = 'Erro';
        document.getElementById('salasUtilizadasMes').textContent = 'Erro';
        document.getElementById('taxaOcupacaoMes').textContent = 'Erro';
    }
}

async function carregarAgendaSemana() {
    try {
        const response = await fetch('/agenda-semanal-professor');
        const data = await response.json();
        const container = document.getElementById('agendaSemana');
        container.innerHTML = '';
        const dias = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        const nomesDias = { Monday: 'Segunda-feira', Tuesday: 'Terça-feira', Wednesday: 'Quarta-feira', Thursday: 'Quinta-feira', Friday: 'Sexta-feira', Saturday: 'Sábado', Sunday: 'Domingo' };
        dias.forEach(dia => {
            const eventos = data[dia] || [];
            const div = document.createElement('div');
            div.innerHTML = `<strong>${nomesDias[dia]}</strong><br><br>` + (eventos.length ? eventos.map(e => `${e.replace('(', '<br>(')}<br><br>`).join('') : 'Nenhum agendamento.');
            container.appendChild(div);
        });
    } catch (error) { console.error('Erro ao carregar agenda da semana:', error); }
}

async function carregarSalasMaisUsadas() {
    try {
        const response = await fetch('/top-salas-professor');
        const salas = await response.json();
        const container = document.getElementById('salasMaisUsadas');
        container.innerHTML = '';
        const maxAgendamentos = salas[0]?.quantidade || 1;
        salas.forEach(sala => {
            const porcentagem = (sala.quantidade / maxAgendamentos) * 100;
            const div = document.createElement('div');
            div.classList.add('room');
            div.innerHTML = `<span>${sala.nome_sala} - ${sala.quantidade} agendamentos</span><div class="bar" style="width: ${porcentagem}%"></div>`;
            container.appendChild(div);
        });
    } catch (error) { console.error('Erro ao carregar salas mais utilizadas:', error); }
}

function voltarParaLayoutAntigo() {
    localStorage.setItem('layoutPreferido', 'antigo');
    window.location.href = 'agendasala.html';
}

async function criarGraficoSalas() {
    const containerGrafico = document.getElementById('graficoContainer');
    try {
        const response = await fetch('/relatorio/salas-porcentagem');
        if (!response.ok) throw new Error('Falha ao buscar dados para o gráfico.');
        const dadosGrafico = await response.json();
        if (dadosGrafico.data.length === 0) {
            containerGrafico.innerHTML = '<h2>Uso de Salas</h2><p>Não há dados de agendamentos suficientes para exibir o gráfico.</p>';
            return;
        }
        const ctx = document.getElementById('meuGraficoDonut').getContext('2d');
        new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: dadosGrafico.labels,
                datasets: [{
                    label: 'Nº de Agendamentos',
                    data: dadosGrafico.data,
                    backgroundColor: ['rgba(54, 162, 235, 0.8)', 'rgba(255, 99, 132, 0.8)', 'rgba(255, 206, 86, 0.8)', 'rgba(75, 192, 192, 0.8)', 'rgba(153, 102, 255, 0.8)'],
                    borderColor: 'rgba(255, 255, 255, 1)',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { position: 'top' },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                let label = context.label || '';
                                if (label) { label += ': '; }
                                if (context.parsed !== null) { label += context.parsed + ' agendamento(s)'; }
                                return label;
                            }
                        }
                    }
                }
            }
        });
    } catch (error) {
        console.error("Erro ao criar gráfico:", error);
        if (containerGrafico) { containerGrafico.innerHTML = '<p style="color:red;">Não foi possível carregar o gráfico.</p>'; }
    }
}
// MUDANÇA: Nova função para popular o seletor de UNIDADES
async function popularSeletorUnidades() {
    const seletorUnidade = document.getElementById('seletorDeUnidade');
    const seletorSala = document.getElementById('seletorDeSala');
    try {
        const response = await fetch('/user-info');
        if (!response.ok) throw new Error('Não foi possível buscar dados do usuário.');
        const usuario = await response.json();
        
        // CORREÇÃO: Precisamos do nome da unidade junto com o código
        const unidadesDoUsuario = usuario.unidades || [];
        
        // Busca os nomes de todas as unidades para fazer um mapeamento
        const unidadesResponse = await fetch('/unidades');
        const todasUnidades = await unidadesResponse.json();
        const mapaUnidades = new Map(todasUnidades.map(u => [u.codigo_unidade, u.nome_unidade]));

        const unidadesComNome = unidadesDoUsuario.map(codigo => ({
            codigo: codigo,
            nome: mapaUnidades.get(codigo) || codigo // Usa o nome se encontrar, senão o código
        }));

        seletorUnidade.innerHTML = '';

        if (unidadesComNome.length === 0) {
            seletorUnidade.innerHTML = '<option value="">Nenhuma unidade associada</option>';
            seletorSala.disabled = true;
            return;
        }

        if (unidadesComNome.length > 1) {
            seletorUnidade.innerHTML = '<option value="">-- Escolha uma unidade --</option>';
        }

        unidadesComNome.forEach(unidade => {
            seletorUnidade.innerHTML += `<option value="${unidade.codigo}">${unidade.nome}</option>`;
        });
        
        if (unidadesComNome.length === 1) {
            seletorUnidade.value = unidadesComNome[0].codigo;
            popularSeletorSalas(unidadesComNome[0].codigo);
        }

    } catch (error) {
        console.error("Erro ao popular seletor de unidades:", error);
        seletorUnidade.innerHTML = '<option value="">Erro ao carregar unidades</option>';
    }
}
// MUDANÇA: A função agora aceita um parâmetro `codigoUnidade`
async function popularSeletorSalas(codigoUnidade) {
    const seletor = document.getElementById('seletorDeSala');
    seletor.innerHTML = '<option value="">-- Carregando salas... --</option>';
    seletor.disabled = true;

    if (!codigoUnidade) {
        seletor.innerHTML = '<option value="">-- Aguardando seleção da unidade --</option>';
        return;
    }

    try {
        const response = await fetch(`/salas/${codigoUnidade}`);
        if (!response.ok) throw new Error(`Falha ao buscar salas`);
        const salas = await response.json();
        
        seletor.innerHTML = '<option value="">-- Escolha uma sala --</option>';
        salas.forEach(sala => {
            seletor.innerHTML += `<option value="${sala.id_sala}">${sala.nome_sala}</option>`;
        });
        seletor.disabled = false;
    } catch (error) {
        console.error("Erro ao popular seletor de salas:", error);
        seletor.innerHTML = '<option value="">-- Erro ao carregar salas --</option>';
    }
}

async function desenharSala(idSala) {
    const containerDetalhe = document.getElementById('containerDetalheSala');
    const areaDesenho = document.getElementById('desenhoSala');
    const areaInfo = document.getElementById('infoSala');
    const tituloSala = document.getElementById('nomeSalaDetalhe');
    try {
        const response = await fetch(`/salas/detalhes/${idSala}`);
        const { detalhes } = await response.json();
        tituloSala.textContent = detalhes.nome_sala;
        areaDesenho.innerHTML = '';
        if (detalhes.projetor === 'Sim') { areaDesenho.innerHTML += '<div class="quadro"><i class="fas fa-video"></i> Projetor</div>'; }
        else { areaDesenho.innerHTML += '<div class="quadro">Quadro Branco</div>'; }
        const totalCadeiras = detalhes.cadeiras || 0;
        const totalPCs = detalhes.computadores_associados || 0;
        for (let i = 0; i < totalCadeiras; i++) {
            let postoHtml = '<div class="posto-trabalho">';
            if (i < totalPCs) { postoHtml += '<i class="fas fa-desktop pc"></i>'; }
            postoHtml += '<i class="fas fa-chair cadeira"></i>';
            postoHtml += '</div>';
            areaDesenho.innerHTML += postoHtml;
        }
        areaInfo.innerHTML = `<p><strong>Total de Cadeiras:</strong> ${totalCadeiras}</p><p><strong>Total de Computadores:</strong> ${totalPCs}</p>`;
        containerDetalhe.style.display = 'block';
    } catch (error) {
        console.error("Erro ao desenhar a sala:", error);
        areaDesenho.innerHTML = "<p class='text-danger'>Não foi possível carregar os detalhes desta sala.</p>";
    }
}
// ==========================================================
// NOVA FUNÇÃO: Contador de Sessão
// ==========================================================
let sessionInterval; // Variável para controlar o intervalo

async function iniciarContadorSessao() {
    try {
        const response = await fetch('/session-info');
        if (!response.ok) {
            window.location.href = '/html/login.html';
            return;
        }
        const data = await response.json();
        let tempoRestante = data.tempoRestante;
        const timerElement = document.getElementById('sessionTimer');
        const timeSpan = document.getElementById('sessionTime');
        if (!timerElement || !timeSpan) return;
        timerElement.style.display = 'block';
        if (sessionInterval) { clearInterval(sessionInterval); }
        sessionInterval = setInterval(() => {
            if (tempoRestante <= 0) {
                clearInterval(sessionInterval);
                timeSpan.textContent = "Expirada";
                alert("Sua sessão expirou por inatividade. Você será redirecionado para a página de login.");
                window.location.href = '/html/login.html';
                return;
            }
            tempoRestante--;
            const minutos = Math.floor(tempoRestante / 60);
            const segundos = tempoRestante % 60;
            timeSpan.textContent = `${String(minutos).padStart(2, '0')}:${String(segundos).padStart(2, '0')}`;
        }, 1000);
    } catch (error) { console.error("Não foi possível iniciar o contador da sessão:", error); }
}
