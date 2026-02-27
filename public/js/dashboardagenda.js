//  (VERSÃO COMPLETA E CORRIGIDA)

document.addEventListener('DOMContentLoaded', function () {
    // --- CARREGAMENTO INICIAL DOS DADOS ---
    personalizarSaudacao();
    carregarDadosDashboard();
    carregarAgendaSemana(); 
    carregarSalasMaisUsadas();
    criarGraficoSalas();
    popularSeletorUnidades();

    // --- MANIPULADORES DE ELEMENTOS ---
    const botaoMostrarForm = document.getElementById('mostrarFormularioBtn');
    const formulario = document.getElementById('agendamentoForm');
    const filtros = document.getElementById('filtros');
    const graficoContainer = document.getElementById('graficoContainer');
    const botaoRelatorios = document.getElementById('mostrarRelatoriosBtn');
    const secaoRelatorios = document.getElementById('secaoRelatorios');
    
    const botaoSalas = document.getElementById('mostrarSalasBtn'); // Seu <li> com ID
    const secaoSalas = document.getElementById('secaoSalas');       // Sua nova <div> com ID

    const menuInicio = document.querySelector('li[onclick*="http://10.165.128.68:3000/"]');
    const menuCompleta = document.querySelector('li[onclick*="agendas-api.html"]');
    let relatoriosCarregados = false;

    // MUDANÇA 1: Função centralizada para esconder todas as seções interativas
    // e retornar ao estado padrão (gráfico visível).
    /*function esconderSessoesInterativas() {
        formulario.classList.remove('visivel');
        filtros.classList.remove('visivel');
        secaoRelatorios.classList.remove('visivel');
        graficoContainer.style.display = 'block'; // O padrão é sempre mostrar o gráfico
    }
*/
    // MUDANÇA 2: Lógica de clique para "Agendar Sala" atualizada
    if (botaoMostrarForm) {
        botaoMostrarForm.addEventListener('click', () => {
            const estavaVisivel = formulario.classList.contains('visivel');
            
            // Primeiro, fecha tudo e volta ao padrão.
            esconderSessoesInterativas();

            // Se o formulário estava fechado, agora nós o abrimos (e escondemos o gráfico).
            if (!estavaVisivel) {
                formulario.classList.add('visivel');
                filtros.classList.add('visivel');
                graficoContainer.style.display = 'none';
            }
            // Se já estava aberto, a função esconderSessoesInterativas() já cuidou de fechá-lo.
        });
    }

    // MUDANÇA 3: Lógica de clique para "Relatórios" atualizada
    if (botaoRelatorios) {
        botaoRelatorios.addEventListener('click', () => {
            const estavaVisivel = secaoRelatorios.classList.contains('visivel');

            // Primeiro, fecha tudo e volta ao padrão.
            esconderSessoesInterativas();

            // Se os relatórios estavam fechados, agora nós os abrimos (e escondemos o gráfico).
            if (!estavaVisivel) {
                secaoRelatorios.classList.add('visivel');
                graficoContainer.style.display = 'none';

                // Carrega os dados dos relatórios se for a primeira vez.
                if (!relatoriosCarregados) {
                    carregarTodosOsRelatorios();
                    relatoriosCarregados = true;
                }
            }
            // Se já estava aberto, a função esconderSessoesInterativas() já cuidou de fechá-lo.
        });
    }
    // NOVO: Lógica de clique para "Salas"
    if (botaoSalas && secaoSalas) {
        botaoSalas.addEventListener('click', (event) => {
            event.preventDefault(); // Garante que o <li> não faça nada padrão
            const estavaVisivel = secaoSalas.classList.contains('visivel');
            
            // Primeiro, fecha tudo e volta ao padrão.
            esconderSessoesInterativas();

            // Se a seção de Salas estava fechada, agora nós a abrimos (e escondemos o gráfico).
            if (!estavaVisivel) {
                secaoSalas.classList.add('visivel');
                graficoContainer.style.display = 'none';
            }
        });
    }
    // MUDANÇA 4: Cliques nos outros botões do menu agora só precisam chamar a função de reset.
    if (menuInicio) menuInicio.addEventListener('click', esconderSessoesInterativas);
    if (menuCompleta) menuCompleta.addEventListener('click', esconderSessoesInterativas);


    // MUDANÇA 1: Função centralizada para esconder todas as seções interativas
// e retornar ao estado padrão (gráfico visível).
function esconderSessoesInterativas() {
    formulario.classList.remove('visivel');
    filtros.classList.remove('visivel');
    secaoRelatorios.classList.remove('visivel');
    if (secaoSalas) secaoSalas.classList.remove('visivel'); // <-- ATUALIZAÇÃO: Esconder a nova seção
    graficoContainer.style.display = 'block'; // O padrão é sempre mostrar o gráfico
}
});


// ==========================================================
// FUNÇÕES ASSÍNCRONAS (NENHUMA MUDANÇA ABAIXO)
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
            container.innerHTML = '<p>Nenhum dado encontrado para este relatório.</p>';
            return;
        }
        let html = '<ul>';
        data.forEach(item => {
            html += `<li><strong>${item.tipo_aula}:</strong> ${item.horas}h ${item.minutos}min</li>`;
        });
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
            container.innerHTML = '<p>Nenhum dado encontrado para este relatório.</p>';
            return;
        }
        let html = '<ul>';
        data.forEach(item => {
            html += `<li><strong>${item.nome_sala}:</strong> ${item.quantidade_usos} vez(es) - Total: ${item.horas}h ${item.minutos}min</li>`;
        });
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
            container.innerHTML = '<p>Nenhum dado encontrado para este relatório.</p>';
            return;
        }
        let html = '<ul>';
        data.forEach(item => {
            html += `<li><strong>${item.dia_semana} (${item.turno}):</strong> ${item.quantidade} agendamento(s)</li>`;
        });
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
    } catch (error) {
        console.error('Erro ao carregar agenda da semana:', error);
    }
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
    } catch (error) {
        console.error('Erro ao carregar salas mais utilizadas:', error);
    }
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
                    backgroundColor: [
                        'rgba(54, 162, 235, 0.8)', 'rgba(255, 99, 132, 0.8)',
                        'rgba(255, 206, 86, 0.8)', 'rgba(75, 192, 192, 0.8)',
                        'rgba(153, 102, 255, 0.8)'
                    ],
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
        if(containerGrafico) {
            containerGrafico.innerHTML = '<p style="color:red;">Não foi possível carregar o gráfico.</p>';
        }
    }
}
// ==========================================================
// FUNÇÕES PARA VISUALIZAÇÃO DE SALAS (Integração)
// ==========================================================

// MUDANÇA: Nova função para popular o seletor de UNIDADES
async function popularSeletorUnidades() {
    const seletorUnidade = document.getElementById('seletorDeUnidade');
    const seletorSala = document.getElementById('seletorDeSala');
    if (!seletorUnidade || !seletorSala) return;

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
        
        // Se houver apenas uma unidade, selecione-a e carregue as salas
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
    if (!seletor) return;
    
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
// --- EVENT LISTENERS PARA OS SELETORES DE SALAS ---
    const seletorDeUnidade = document.getElementById('seletorDeUnidade');
    if (seletorDeUnidade) {
        seletorDeUnidade.addEventListener('change', (event) => {
            const codigoUnidade = event.target.value;
            popularSeletorSalas(codigoUnidade);
            // Oculta os detalhes da sala antiga ao mudar de unidade
            const containerDetalheSala = document.getElementById('containerDetalheSala');
            if(containerDetalheSala) containerDetalheSala.style.display = 'none';
        });
    }

    const seletorDeSala = document.getElementById('seletorDeSala');
    if (seletorDeSala) {
        seletorDeSala.addEventListener('change', (event) => {
            const salaId = event.target.value;
            if (salaId) {
                desenharSala(salaId);
            } else {
                const containerDetalheSala = document.getElementById('containerDetalheSala');
                if(containerDetalheSala) containerDetalheSala.style.display = 'none';
            }
        });
    }
    
async function desenharSala(idSala) {
    const containerDetalhe = document.getElementById('containerDetalheSala');
    const areaDesenho = document.getElementById('desenhoSala');
    const areaInfo = document.getElementById('infoSala');
    const tituloSala = document.getElementById('nomeSalaDetalhe');
    
    if (!containerDetalhe || !areaDesenho || !areaInfo || !tituloSala) return;

    try {
        const response = await fetch(`/salas/detalhes/${idSala}`);
        if (!response.ok) throw new Error('Falha ao buscar detalhes da sala.');
        
        const { detalhes } = await response.json();
        
        tituloSala.textContent = detalhes.nome_sala;
        areaDesenho.innerHTML = ''; // Limpa o desenho anterior
        
        // Adiciona Projetor/Quadro
        if (detalhes.projetor === 'Sim') { 
            areaDesenho.innerHTML += '<div class="quadro"><i class="fas fa-video"></i> Projetor</div>'; 
        } else { 
            areaDesenho.innerHTML += '<div class="quadro">Quadro Branco</div>'; 
        }

        const totalCadeiras = detalhes.cadeiras || 0;
        const totalPCs = detalhes.computadores_associados || 0;
        
        // Desenha os postos de trabalho
        for (let i = 0; i < totalCadeiras; i++) {
            let postoHtml = '<div class="posto-trabalho">';
            // Se o índice for menor que o total de PCs, adiciona o ícone de PC
            if (i < totalPCs) { 
                postoHtml += '<i class="fas fa-desktop pc"></i>'; 
            }
            postoHtml += '<i class="fas fa-chair cadeira"></i>';
            postoHtml += '</div>';
            areaDesenho.innerHTML += postoHtml;
        }

        // Adiciona informações textuais
        areaInfo.innerHTML = `
            <p><strong>Total de Cadeiras:</strong> ${totalCadeiras}</p>
            <p><strong>Total de Computadores:</strong> ${totalPCs}</p>
        `;
        
        containerDetalhe.style.display = 'block'; // Mostra o container de detalhes
    } catch (error) {
        console.error("Erro ao desenhar a sala:", error);
        areaDesenho.innerHTML = "<p class='text-danger'>Não foi possível carregar os detalhes desta sala.</p>";
        containerDetalhe.style.display = 'block';
    }
}

