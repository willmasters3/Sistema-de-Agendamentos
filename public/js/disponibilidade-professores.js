document.addEventListener('DOMContentLoaded', () => {
    const selectUnidade = document.getElementById('select-unidade');
    const selectProfessor = document.getElementById('select-professor');
    const form = document.getElementById('form-disponibilidade');
    const resultadoDiv = document.getElementById('disponibilidade-resultado');
    const listaDisponibilidade = document.getElementById('lista-disponibilidade');
    const resultadoTitulo = document.getElementById('resultado-titulo');
    const msgErro = document.getElementById('msg-erro');
    const msgSemDisp = document.getElementById('msg-sem-disponibilidade');
    
    let professoresData = []; 
    let unidadesData = [];

    // Função auxiliar para formatar a data
    function formatarData(dataISO) {
        const [ano, mes, dia] = dataISO.split('-');
        return `${dia}/${mes}/${ano}`;
    }

    // Função para mostrar mensagem de erro
    function mostrarMensagemErro(mensagem) {
        msgErro.textContent = mensagem;
        msgErro.classList.remove('hidden');
        resultadoDiv.classList.add('hidden');
    }

    // Função principal para carregar Unidades
    async function carregarUnidades() {
        try {
            const response = await fetch('/listar-unidades');
            if (!response.ok) {
                throw new Error('Falha ao carregar unidades');
            }
            unidadesData = await response.json();

            selectUnidade.innerHTML = '<option value="">-- Selecione a Unidade --</option>';
            unidadesData.forEach(unidade => {
                const option = document.createElement('option');
                option.value = unidade.codigo; 
                option.textContent = unidade.nome;
                selectUnidade.appendChild(option);
            });
        } catch (error) {
            console.error('Erro ao carregar unidades:', error);
            selectUnidade.innerHTML = '<option value="">Erro ao carregar unidades</option>';
            mostrarMensagemErro('Erro ao carregar a lista de unidades.');
        }
    }
    
    // Função para carregar Professores com base na Unidade selecionada
    async function carregarProfessoresPorUnidade(codigoUnidade) {
        selectProfessor.innerHTML = '<option value="">Carregando Professores...</option>';
        selectProfessor.disabled = true;
        professoresData = [];
        msgErro.classList.add('hidden'); // Oculta erros anteriores

        try {
            const response = await fetch(`/listar-professores-por-unidade/${codigoUnidade}`);
            
            if (!response.ok) {
                if (response.status === 404 || response.status === 204) {
                     selectProfessor.innerHTML = '<option value="">Nenhum professor encontrado</option>';
                     return;
                }
                throw new Error('Falha ao carregar professores');
            }
            professoresData = await response.json();

            selectProfessor.innerHTML = '<option value="">-- Selecione o Professor --</option>';
            professoresData.forEach(prof => {
                const option = document.createElement('option');
                option.value = prof.id_professor;
                option.textContent = `${prof.nome} (${prof.matricula})`;
                selectProfessor.appendChild(option);
            });
            selectProfessor.disabled = false;

        } catch (error) {
            console.error('Erro ao carregar professores:', error);
            selectProfessor.innerHTML = '<option value="">Erro ao carregar</option>';
            mostrarMensagemErro('Erro ao carregar a lista de professores.');
        }
    }

    // Event Listener para a seleção de Unidade
    selectUnidade.addEventListener('change', () => {
        const codigoUnidade = selectUnidade.value;
        if (codigoUnidade) {
            carregarProfessoresPorUnidade(codigoUnidade);
        } else {
            selectProfessor.innerHTML = '<option value="">Selecione uma Unidade Primeiro</option>';
            selectProfessor.disabled = true;
        }
        resultadoDiv.classList.add('hidden');
        msgSemDisp.classList.add('hidden');
    });


    // Tratar o envio do formulário
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Esconder resultados e mensagens antigas
        resultadoDiv.classList.add('hidden');
        msgErro.classList.add('hidden');
        msgSemDisp.classList.add('hidden');
        listaDisponibilidade.innerHTML = '';

        const idProfessor = selectProfessor.value;
        const dataInicioInput = document.getElementById('data-inicio').value;
        const dataFimInput = document.getElementById('data-fim').value;

        const horaInicioJornada = document.getElementById('jornada-inicio').value;
        const horaFimJornada = document.getElementById('jornada-fim').value;
        
        if (!idProfessor) {
            mostrarMensagemErro('Selecione um professor para continuar.');
            return;
        }
        
        // Montar a URL de consulta (datas já estão em YYYY-MM-DD)
        const url = `/professor-disponibilidade/${idProfessor}?` + 
            `dataInicio=${dataInicioInput}&dataFim=${dataFimInput}&` + 
            `horaInicioJornada=${horaInicioJornada}&horaFimJornada=${horaFimJornada}`;
        
        try {
            const response = await fetch(url);
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.message || 'Erro desconhecido ao verificar disponibilidade.');
            }

            exibirResultado(data, selectProfessor.options[selectProfessor.selectedIndex].text);

        } catch (error) {
            console.error('Erro ao buscar disponibilidade:', error);
            mostrarMensagemErro(`Erro ao buscar disponibilidade: ${error.message}`);
        }
    });


    // CORREÇÃO AQUI: Ajustando a criação do objeto Date para evitar o erro de fuso horário.
    function obterDiaSemana(dataISO) {
        // Cria um objeto Date forçando a leitura como UTC e adicionando a data como um timestamp.
        // Isso força a interpretação como o dia exato no fuso horário local.
        const [ano, mes, dia] = dataISO.split('-').map(Number);
        const dataCorrigida = new Date(ano, mes - 1, dia, 12); // Hora 12:00 (meio-dia) garante que caia no dia certo.
        
        return dataCorrigida.toLocaleDateString('pt-BR', { weekday: 'short' });
    }

    // Exibir o resultado na interface (AGORA EM LAYOUT GRID)
    function exibirResultado(data, nomeProfessor) {
        resultadoTitulo.textContent = `Disponibilidade de: ${nomeProfessor}`;
        listaDisponibilidade.innerHTML = '';
        
        const disponibilidades = data.disponibilidade;
        const datasLivre = Object.keys(disponibilidades);
        
        if (datasLivre.length === 0) {
            msgSemDisp.textContent = "O professor está **TOTALMENTE OCUPADO** ou não possui horários livres no período/jornada selecionados.";
            msgSemDisp.classList.remove('hidden');
            msgSemDisp.classList.remove('alert-success');
            msgSemDisp.classList.add('alert-danger'); 
            
        } else {
            // Professor tem horários livres em alguns dias
            datasLivre.forEach(dataISO => {
                const intervalos = disponibilidades[dataISO];
                const diaDiv = document.createElement('div');
                diaDiv.classList.add('dia-disponivel');
                
                let htmlIntervalos = '<div class="intervalo-container">'; // Container para verticalizar os intervalos
                intervalos.forEach(intervalo => {
                    htmlIntervalos += `<span class="intervalo">${intervalo.inicio} - ${intervalo.fim}</span>`;
                });
                htmlIntervalos += '</div>';
                
                // Exibe o dia da semana (Ex: QUI 02/10/2025) usando a função corrigida
                const diaSemana = obterDiaSemana(dataISO);

                diaDiv.innerHTML = `
                    <h3>${diaSemana.toUpperCase()} ${formatarData(dataISO)}</h3>
                    ${htmlIntervalos}
                `;
                listaDisponibilidade.appendChild(diaDiv);
            });
            msgSemDisp.classList.add('hidden');
        }

        resultadoDiv.classList.remove('hidden');
    }

    // Iniciar carregamento das Unidades
    carregarUnidades();
});