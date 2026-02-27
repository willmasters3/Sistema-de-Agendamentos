// Função para carregar informações do usuário
async function carregarInfoUsuario() {
    try {
        const response = await fetch('/user-info');
        if (!response.ok) throw new Error('Erro ao carregar informações do usuário.');

        return await response.json();
    } catch (error) {
        console.error('Erro ao carregar informações do usuário:', error);
        return null;
    }
}

// Função para carregar unidades, filtrando pela unidade do usuário
async function carregarUnidades() {
    const userInfo = await carregarInfoUsuario();

    if (!userInfo) {
        document.getElementById('resultadoAdicionar').innerHTML = 'Erro ao carregar unidades. Por favor, faça login novamente.';
        return;
    }

    try {
        const response = await fetch('/listar-unidades');
        if (!response.ok) throw new Error('Erro ao carregar unidades.');

        const unidades = await response.json();
        const unidadeSelect = document.getElementById('unidadeSelect');
        unidadeSelect.innerHTML = '<option value="">Selecione uma unidade</option>';

        unidades.forEach(unidade => {
            if (userInfo.unidades.includes(unidade.codigo)) {
                const option = document.createElement('option');
                option.value = unidade.codigo;
                option.textContent = unidade.nome;
                unidadeSelect.appendChild(option);
            }
        });
    } catch (error) {
        console.error('Erro ao carregar as unidades:', error);
        alert('Erro ao carregar unidades.');
    }
}

// Função para formatar a data considerando o formato DD/MM/YYYY e hora HH:mm:ss
function formatarDataCompleta(data, hora) {
    const partesData = data.split('/');
    const dia = partesData[0].padStart(2, '0');
    const mes = partesData[1].padStart(2, '0');
    const ano = partesData[2];

    const dataFormatada = `${ano}-${mes}-${dia}T${hora}`;
    return new Date(dataFormatada);
}
// Função para verificar e atualizar o botão "Editar"
const verificaCheckboxes = () => {
    const checkboxes = document.querySelectorAll('.agendamento-checkbox');
    const anyChecked = Array.from(checkboxes).some(item => item.checked);
    document.getElementById('btnEditarSelecionados').style.display = anyChecked ? 'inline-block' : 'none';
};

// Selecionar Todos
document.getElementById('selectAllAgendamentos').addEventListener('change', (event) => {
    const checkboxes = document.querySelectorAll('.agendamento-checkbox');
    const isChecked = event.target.checked;
    checkboxes.forEach(checkbox => {
        checkbox.checked = isChecked;
    });

    // Atualiza o botão de editar com base na seleção
    document.getElementById('btnEditarSelecionados').style.display = isChecked ? 'inline-block' : 'none';
});

// Adiciona evento de mudança a todos os checkboxes após serem carregados
async function atualizarCheckboxes() {
    const checkboxes = document.querySelectorAll('.agendamento-checkbox');
    checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', verificaCheckboxes);
    });
}

/*
// Função para aplicar filtros
async function aplicarFiltros() {
    const filtroSala = document.getElementById("filtroSala").value || '';
    const filtroProfessor = document.getElementById("filtroProfessor").value || '';
    const filtroDataInicio = document.getElementById("filtroDataInicio").value || '';
    const filtroDataFim = document.getElementById("filtroDataFim").value || '';
    const filtroTurno = document.getElementById("filtroTurno").value || '';
    const filtroDiaSemana = document.getElementById("filtroDiaSemana").value || '';
    const unidadeSelect = document.getElementById('unidadeSelect');
    const codigoUnidade = unidadeSelect.value;

    if (!codigoUnidade) {
        alert('Por favor, selecione uma unidade antes de aplicar os filtros.');
        return;
    }

    try {
        const response = await fetch(`/listar-agendamentos-filtrados?unidadeCodigo=${codigoUnidade}&professor=${filtroProfessor}&dataInicio=${filtroDataInicio}&dataFim=${filtroDataFim}&sala=${filtroSala}&turno=${filtroTurno}&diaSemana=${filtroDiaSemana}`);

        if (!response.ok) throw new Error('Erro ao carregar agendamentos filtrados');

        const agendamentos = await response.json();
        const agendamentosList = document.getElementById('agendamentosList');

        if (!agendamentosList) {
            console.error('Elemento agendamentosList não encontrado no DOM.');
            return;
        }

        agendamentosList.innerHTML = ''; // Limpa o conteúdo anterior

        
        if (agendamentos.length === 0) {
            agendamentosList.innerHTML = '<tr><td colspan="10" style="text-align: center;">Nenhum agendamento encontrado com os critérios fornecidos.</td></tr>';
        } else {
            agendamentos.forEach(agendamento => {
                const agendamentoRow = document.createElement('tr');
                agendamentoRow.innerHTML = `
                    <td><input type="checkbox" class="agendamento-checkbox" value="${agendamento.id_agendamento}"></td>
                    <td>${agendamento.nome_sala || 'N/D'}</td>
                    <td>${agendamento.nome || 'N/D'}</td>
                    <td>${formatarData(agendamento.data_reservas) || 'N/D'}</td>
                    <td>${formatarHora(agendamento.hora_inicio) || 'N/D'}</td>
                    <td>${formatarData(agendamento.data_reservas) || 'N/D'}</td>
                    <td>${formatarHora(agendamento.hora_fim) || 'N/D'}</td>
                    <td>${agendamento.tipo_aula || 'N/D'}</td>
                    <td>${agendamento.motivo || 'Nenhum motivo fornecido'}</td>
                    <td><button class="btn-editar" data-id="${agendamento.id_agendamento}">Editar</button></td>
                `;
                agendamentosList.appendChild(agendamentoRow);

                // Adiciona o evento para o checkbox
                const checkbox = agendamentoRow.querySelector('.agendamento-checkbox');
                checkbox.addEventListener('change', () => {
                    const checkboxes = document.querySelectorAll('.agendamento-checkbox');
                    const anyChecked = Array.from(checkboxes).some(item => item.checked);
                    document.getElementById('btnEditarSelecionados').style.display = anyChecked ? 'inline-block' : 'none';
                });
            });
        }

        // Atualiza o estado do botão de editar após adicionar os agendamentos
        const checkboxes = document.querySelectorAll('.agendamento-checkbox');
        const anyChecked = Array.from(checkboxes).some(item => item.checked);
        document.getElementById('btnEditarSelecionados').style.display = anyChecked ? 'inline-block' : 'none';

    } catch (error) {
        console.error('Erro ao aplicar filtros:', error);
        alert('Erro ao aplicar filtros.');
    }
}



// Função para verificar se o horário do agendamento está dentro do turno selecionado
function verificarHorarioTurno(agendamentoData, filtroTurno) {
    const agendamentoInicio = new Date(agendamentoData); // Data do início do agendamento
    const agendamentoFim = new Date(agendamentoData); // Data do fim do agendamento

    // Definindo os limites de tempo para cada turno
    const turnoManhaInicio = new Date(agendamentoData);
    turnoManhaInicio.setHours(6, 0, 0); // 6:00
    const turnoManhaFim = new Date(agendamentoData);
    turnoManhaFim.setHours(13, 0, 0); // 13:00

    const turnoTardeInicio = new Date(agendamentoData);
    turnoTardeInicio.setHours(13, 15, 0); // 13:15
    const turnoTardeFim = new Date(agendamentoData);
    turnoTardeFim.setHours(17, 15, 0); // 17:15

    const turnoNoiteInicio = new Date(agendamentoData);
    turnoNoiteInicio.setHours(17, 15, 0); // 17:15
    const turnoNoiteFim = new Date(agendamentoData);
    turnoNoiteFim.setHours(23, 59, 0); // 23:59

    // Verificando se o agendamento está dentro do turno selecionado
    if (filtroTurno === 'manha') {
        return agendamentoInicio >= turnoManhaInicio && agendamentoFim <= turnoManhaFim;
    } else if (filtroTurno === 'tarde') {
        return agendamentoInicio >= turnoTardeInicio && agendamentoFim <= turnoTardeFim;
    } else if (filtroTurno === 'noite') {
        return agendamentoInicio >= turnoNoiteInicio && agendamentoFim <= turnoNoiteFim;
    }

    return true; // Retorna true se "Todos os Turnos" estiver selecionado
}

*/
// Função para aplicar filtros
async function aplicarFiltros() {
    const filtroSala = document.getElementById("filtroSala").value || '';
    const filtroProfessor = document.getElementById("filtroProfessor").value || '';
    const filtroDataInicio = document.getElementById("filtroDataInicio").value || '';
    const filtroDataFim = document.getElementById("filtroDataFim").value || '';
    const filtroTurno = document.getElementById("filtroTurno").value || '';
    const filtroDiaSemana = document.getElementById("filtroDiaSemana").value || '';
    const unidadeSelect = document.getElementById('unidadeSelect');
    const codigoUnidade = unidadeSelect.value;

    if (!codigoUnidade) {
        alert('Por favor, selecione uma unidade antes de aplicar os filtros.');
        return;
    }

    try {
        const response = await fetch(`/listar-agendamentos-filtrados?unidadeCodigo=${codigoUnidade}&professor=${filtroProfessor}&dataInicio=${filtroDataInicio}&dataFim=${filtroDataFim}&sala=${filtroSala}`);
        if (!response.ok) throw new Error('Erro ao carregar agendamentos filtrados');

        const agendamentos = await response.json();
        const agendamentosList = document.getElementById('agendamentosList');
        agendamentosList.innerHTML = '';

        // Aplica os filtros de turno e dia da semana no frontend
        const agendamentosFiltrados = agendamentos.filter(agendamento => {
            const inicio = new Date(`${agendamento.data_reservas}T${agendamento.hora_inicio}`);
            const fim = new Date(`${agendamento.data_reservas}T${agendamento.hora_fim}`);

            const turnoOk = filtroTurno ? verificarHorarioTurno(inicio, fim, filtroTurno) : true;
            const diaSemanaOk = filtroDiaSemana ? inicio.getDay().toString() === filtroDiaSemana : true;

            return turnoOk && diaSemanaOk;
        });

        if (agendamentosFiltrados.length === 0) {
            agendamentosList.innerHTML = '<tr><td colspan="10" style="text-align: center;">Nenhum agendamento encontrado com os critérios fornecidos.</td></tr>';
        } else {
            agendamentosFiltrados.forEach(agendamento => {
                const agendamentoRow = document.createElement('tr');
                agendamentoRow.innerHTML = `
                    <td><input type="checkbox" class="agendamento-checkbox" value="${agendamento.id_agendamento}"></td>
                    <td>${agendamento.nome_sala || 'N/D'}</td>
                    <td>${agendamento.nome || 'N/D'}</td>
                    <td>${formatarData(agendamento.data_reservas) || 'N/D'}</td>
                    <td>${formatarHora(agendamento.hora_inicio) || 'N/D'}</td>
                    <td>${formatarData(agendamento.data_reservas) || 'N/D'}</td>
                    <td>${formatarHora(agendamento.hora_fim) || 'N/D'}</td>
                    <td>${agendamento.tipo_aula || 'N/D'}</td>
                    <td>${agendamento.motivo || 'Nenhum motivo fornecido'}</td>
                    <td><button class="btn-editar" data-id="${agendamento.id_agendamento}">Editar</button></td>
                `;
                agendamentosList.appendChild(agendamentoRow);
            });

            atualizarCheckboxes();
        }

    } catch (error) {
        console.error('Erro ao aplicar filtros:', error);
        alert('Erro ao aplicar filtros.');
    }
}

// Função para verificar se o horário do agendamento está dentro do turno selecionado
function verificarHorarioTurno(agendamentoInicio, agendamentoFim, filtroTurno) {
    // Definindo os limites de tempo para cada turno
    const turnos = {
        manha: { inicio: 6 * 60, fim: 13 * 60 }, // de 06:00 até 13:00
        tarde: { inicio: (13 * 60 + 1), fim: (17 * 60 + 15) }, // de 13:01 até 17:15
        noite: { inicio: (17 * 60 + 16), fim: (23 * 60 + 59) } // de 17:16 até 23:59
    };

    const inicioMinutos = (agendamentoInicio.getHours() * 60) + agendamentoInicio.getMinutes();
    const fimMinutos = (agendamentoFim.getHours() * 60) + agendamentoFim.getMinutes();

    // Verificando o turno
    if (filtroTurno === 'manha') {
        return inicioMinutos >= turnos.manha.inicio && fimMinutos <= turnos.manha.fim;
    } else if (filtroTurno === 'tarde') {
        return inicioMinutos >= turnos.tarde.inicio && fimMinutos <= turnos.tarde.fim;
    } else if (filtroTurno === 'noite') {
        return inicioMinutos >= turnos.noite.inicio && fimMinutos <= turnos.noite.fim;
    }

    return true; // Retorna true se "Todos os Turnos" estiver selecionado
}


document.getElementById("btnEditarSelecionados").addEventListener("click", async () => {
    const checkboxes = document.querySelectorAll('#agendamentosList input[type="checkbox"]:checked');

    if (checkboxes.length === 0) {
        alert("Selecione ao menos um agendamento para editar.");
        return;
    }

    // Cria o modal para edição
    const modal = document.createElement('div');
    modal.classList.add('modal');

    const unidadeSelect = document.getElementById('unidadeSelect');
    const unidadeCodigo = unidadeSelect.value;

    const professores = await carregarProfessoresPorUnidade(unidadeCodigo);
    const tiposAtividade = await carregarTiposDeAtividadePorUnidade(unidadeCodigo);

    tiposAtividade.sort((a, b) => a.descricao.localeCompare(b.descricao));

    modal.innerHTML = `
        <div class="modal-content">
            <h3>Editar Agendamentos Selecionados</h3>
            <label for="novoProfessor">Novo Professor:</label>
            <select id="novoProfessor">
                ${professores.map(professor => `
                    <option value="${professor.id_professor}">${professor.nome}</option>
                `).join('')}
            </select>
            <label for="novoTipoAtividade">Tipo de Atividade:</label>
            <select id="novoTipoAtividade">
                <option value="">Selecione um Tipo de Atividade</option>
                ${tiposAtividade.map(tipo => `
                    <option value="${tipo.id_tipo_aula}">${tipo.descricao}</option>
                `).join('')}
            </select>
            <label for="novoMotivo">Motivo:</label>
            <input type="text" id="novoMotivo" placeholder="Motivo para os agendamentos selecionados">
            <button id="salvarEdicoes">Salvar Edições</button>
            <button id="fecharModal">Fechar</button>
        </div>
    `;

    document.body.appendChild(modal);

    // Função para fechar o modal
    const fecharModal = () => {
        modal.remove();
        document.removeEventListener('keydown', escPressHandler); // Remove o listener da tecla ESC
    };

    // Lógica para fechar o modal com o botão
    document.getElementById("fecharModal").addEventListener("click", fecharModal);

    // Lógica para fechar o modal com a tecla ESC
    const escPressHandler = (event) => {
        if (event.key === 'Escape') {
            fecharModal();
        }
    };

    document.addEventListener('keydown', escPressHandler);



    // Evento para salvar as edições
    document.getElementById("salvarEdicoes").addEventListener("click", async () => {
        const novoProfessorId = document.getElementById("novoProfessor").value;
        const novoTipoAtividadeId = document.getElementById("novoTipoAtividade").value; // Aqui é o ID que está sendo pego
        const novoMotivo = document.getElementById("novoMotivo").value;

        // Obtenha a descrição correspondente ao ID
        const tipoAtividade = tiposAtividadeMap[novoTipoAtividadeId]; // Transforma o ID em descrição

        if (!tipoAtividade) {
            alert("Tipo de atividade selecionado é inválido.");
            return;
        }

        let sucesso = true;
        let mensagemSucesso = '';

        // Atualiza cada agendamento selecionado
        for (let checkbox of checkboxes) {
            const idAgendamento = checkbox.value;
            try {
                await editarAgendamento(idAgendamento, novoProfessorId, tipoAtividade, novoMotivo); // Agora você usa a descrição correta
            } catch (error) {
                console.error('Erro ao editar agendamento:', error);
                sucesso = false;
                mensagemSucesso = "Houve um erro ao atualizar alguns agendamentos.";
            }
        }

        if (sucesso) {
            mensagemSucesso = "Agendamentos atualizados com sucesso!";
        }

        alert(mensagemSucesso);
        // Fechar o modal e recarregar edições
        fecharModal();
        carregarAgendamentosPorUnidade(unidadeCodigo);
    });

});

// Função para editar apenas o professor de um agendamento
async function editarProfessorAgendamento(idAgendamento, novoProfessorId) {
    try {
        const response = await fetch(`/editar-professor-agendamento/${idAgendamento}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ professor: novoProfessorId }), // Somente o professor é editado
        });

        if (!response.ok) throw new Error('Erro ao editar professor do agendamento.');

        return true; // Retorna verdadeiro se a edição foi bem-sucedida
    } catch (error) {
        console.error('Erro ao editar professor do agendamento:', error);
        return false; // Retorna falso se ocorreu um erro
    }
}


// Função para abrir modal de edição
async function abrirModalEdicao(agendamento) {
    const modal = document.createElement('div');
    modal.classList.add('modal');

    // Obtem o código da unidade da propriedade do agendamento
    const unidadeSelect = document.getElementById('unidadeSelect'); // Obtendo o select da unidade
    const unidadeCodigo = unidadeSelect.value; // Pega o valor da seleção atual

    // Valida se a unidade está definida
    if (!unidadeCodigo) {
        console.error('Código da unidade não encontrado ao abrir o modal de edição.');
        alert('Erro: Nenhuma unidade selecionada.'); // Mensagem de erro
        return; // Retorna se nenhuma unidade foi selecionada
    }

    // Carregar os professores e tipos de atividade apenas da unidade selecionada
    const professores = await carregarProfessoresPorUnidade(unidadeCodigo);
    const tiposAtividade = await carregarTiposDeAtividadePorUnidade(unidadeCodigo);

    modal.innerHTML = `
    <div class="modal-content">
        <h3>Editar Agendamento</h3>
        <label for="novoProfessor">Professor:</label>
        <select id="novoProfessor">
            ${professores.map(professor => `
                <option value="${professor.id_professor}" ${professor.nome === agendamento.nome ? 'selected' : ''}>${professor.nome}</option>
            `).join('')}
        </select>
        <label for="novoTipoAtividade">Tipo de Atividade:</label>
        <select id="novoTipoAtividade">
            ${tiposAtividade.map(tipo => `
                <option value="${tipo.id_tipo_aula}" ${tipo.id_tipo_aula === agendamento.tipo_aula ? 'selected' : ''}>${tipo.descricao}</option>
            `).join('')}
        </select>
        <label for="novoMotivo">Motivo:</label>
        <input type="text" id="novoMotivo" value="${agendamento.motivo || ''}">
        <button id="salvarEdicao">Salvar</button>
        <button id="fecharModal">Fechar</button>
    </div>
`;


    document.body.appendChild(modal);

    // Função para fechar o modal
    const fecharModal = () => {
        modal.remove();
        document.removeEventListener('keydown', escPressHandler); // Remove o listener da tecla ESC
    };

    // Lógica para fechar o modal com o botão
    document.getElementById("fecharModal").addEventListener("click", fecharModal);

    // Lógica para fechar o modal com a tecla ESC
    const escPressHandler = (event) => {
        if (event.key === 'Escape') {
            fecharModal();
        }
    };

    document.addEventListener('keydown', escPressHandler);


}


async function carregarProfessoresPorUnidade(codigoUnidade) {
    try {
        const response = await fetch(`/listar-professores-por-unidade/${codigoUnidade}`);
        if (!response.ok) throw new Error('Erro ao carregar professores por unidade');

        const professores = await response.json();

        // Classificando os professores em ordem alfabética
        professores.sort((a, b) => a.nome.localeCompare(b.nome));

        return professores;
    } catch (error) {
        console.error('Erro ao carregar professores por unidade:', error);
        return [];
    }
}

let tiposAtividadeMap = {};

// Função para carregar tipos de atividade
async function carregarTiposDeAtividadePorUnidade(codigoUnidade) {
    try {
        const response = await fetch(`/listar-tipos-aula-por-unidade/${codigoUnidade}`);
        if (!response.ok) throw new Error('Erro ao carregar tipos de atividade por unidade');

        const tiposAtividade = await response.json();
        tiposAtividadeMap = {}; // Limpa o mapeamento anterior

        tiposAtividade.forEach(tipo => {
            tiposAtividadeMap[tipo.id_tipo_aula] = tipo.descricao; // Mapeia o ID para a descrição
        });

        return tiposAtividade;
    } catch (error) {
        console.error('Erro ao carregar tipos de atividade por unidade:', error);
        return [];
    }
}




// Função para editar agendamento
async function editarAgendamento(idAgendamento, novoProfessor, novoTipoAtividade, novoMotivo) {
    try {
        const response = await fetch(`/editar-agendamento/${idAgendamento}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                professor: novoProfessor,
                tipoAtividade: novoTipoAtividade,
                motivo: novoMotivo,
            }),
        });

        if (!response.ok) throw new Error('Erro ao editar agendamento.');
        // Removido o alert daqui
    } catch (error) {
        console.error('Erro ao editar agendamento:', error);
        throw error; // Propaga o erro para ser tratado no loop
    }
}


document.getElementById('btnFiltroExclusao').addEventListener('click', () => {
    const filtrosDivExclusao = document.getElementById('filtrosExclusao');
    const estadoAtualExclusao = filtrosDivExclusao.style.display;

    filtrosDivExclusao.style.display = (estadoAtualExclusao === 'none' || estadoAtualExclusao === '') ? 'flex' : 'none';
});


// Evento DOMContentLoaded para inicializar aplicações e listeners
document.addEventListener('DOMContentLoaded', () => {
    carregarUnidades(); // Carrega as unidades ao carregar a página

    const unidadeSelect = document.getElementById('unidadeSelect');
    unidadeSelect.addEventListener('change', async () => {
        const codigoUnidade = unidadeSelect.value;
        if (codigoUnidade) {
            await carregarAgendamentosPorUnidade(codigoUnidade); // Carrega os agendamentos para a unidade selecionada
        } else {
            document.getElementById('agendamentosList').innerHTML = ''; // Limpa a lista
        }
    });

    const btnFiltro = document.getElementById('btnFiltro');
    const filtrosDiv = document.getElementById('filtros');

    // Verifica se o botão de filtro existe e adiciona evento de clique
    if (btnFiltro) {
        btnFiltro.addEventListener('click', () => {
            // Alterna a visibilidade do painel de filtros
            const estadoAtual = filtrosDiv.style.display;
            filtrosDiv.style.display = (estadoAtual === 'none' || estadoAtual === '') ? 'flex' : 'none';
        });
    }

    const btnAplicarFiltro = document.getElementById('btnAplicarFiltro');
    if (btnAplicarFiltro) {
        btnAplicarFiltro.addEventListener('click', aplicarFiltros); // Chama a função de aplicação de filtros
    } else {
        console.error('Botão de aplicar filtro não encontrado no DOM.');
    }
});

let paginaAtual = 1; // Página atual
const totalPorPagina = 50; // Total de agendamentos por página


// Função para carregar agendamentos por unidade e paginação
async function carregarAgendamentosPorUnidade(codigoUnidade) {
    try {
        const response = await fetch(`/listar-agendamento/${codigoUnidade}`);
        if (!response.ok) throw new Error('Erro ao carregar agendamentos');

        const agendamentos = await response.json();
        const agendamentosList = document.getElementById('agendamentosList');
        agendamentosList.innerHTML = ''; // Limpa a tabela antes de preencher

        const totalAgendamentos = agendamentos.length; // Total de agendamentos
        const totalPaginas = Math.ceil(totalAgendamentos / totalPorPagina); // Total de páginas

        // Paginação
        const agendamentosPagados = agendamentos.slice((paginaAtual - 1) * totalPorPagina, paginaAtual * totalPorPagina);

        if (agendamentosPagados.length === 0) {
            agendamentosList.innerHTML = '<tr><td colspan="8" class="text-center">Nenhum agendamento encontrado para esta unidade no momento.</td></tr>';
        } else {
            // Loop para adicionar agendamentos paginados
            agendamentosPagados.forEach(agendamento => {
                const row = document.createElement('tr');
                // Criando o checkbox para seleção
                const checkboxCell = document.createElement('td');
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox'; // Definindo o tipo como checkbox
                checkbox.value = agendamento.id_agendamento; // O valor é o ID do agendamento
                checkbox.classList.add('agendamento-checkbox'); // Adiciona uma classe para seleção

                // Adiciona evento de alteração no checkbox
                checkbox.addEventListener('change', () => {
                    const checkboxes = document.querySelectorAll('.agendamento-checkbox');
                    const anyChecked = Array.from(checkboxes).some(item => item.checked);
                    document.getElementById('btnEditarSelecionados').style.display = anyChecked ? 'inline-block' : 'none';
                });

                checkboxCell.appendChild(checkbox);
                row.appendChild(checkboxCell); // Adiciona a célula do checkbox à linha

                const salaCell = document.createElement('td');
                salaCell.textContent = agendamento.nome_sala || 'N/D';
                row.appendChild(salaCell);


                const professorCell = document.createElement('td');
                professorCell.textContent = agendamento.nome || 'N/D';
                row.appendChild(professorCell);

                const dataInicioCell = document.createElement('td');
                dataInicioCell.textContent = formatarData(agendamento.data_reservas) || 'N/D';
                row.appendChild(dataInicioCell);

                const horaInicioCell = document.createElement('td');
                horaInicioCell.textContent = formatarHora(agendamento.hora_inicio) || 'N/D';
                row.appendChild(horaInicioCell);

                const dataFimCell = document.createElement('td');
                dataFimCell.textContent = formatarData(agendamento.data_reservas) || 'N/D';
                row.appendChild(dataFimCell);

                const horaFimCell = document.createElement('td');
                horaFimCell.textContent = formatarHora(agendamento.hora_fim) || 'N/D';
                row.appendChild(horaFimCell);

                const tipoAtividadeCell = document.createElement('td');
                tipoAtividadeCell.textContent = agendamento.tipo_aula || 'N/D';
                row.appendChild(tipoAtividadeCell);

                const motivoCell = document.createElement('td');
                motivoCell.textContent = agendamento.motivo || 'N/D';
                row.appendChild(motivoCell);

                // Botão de excluir
                const excluirButton = document.createElement('button');
                excluirButton.textContent = 'Excluir';
                excluirButton.addEventListener('click', async () => {
                    const confirmacao = confirm('Deseja excluir este agendamento?');
                    if (confirmacao) {
                        await excluirAgendamento(agendamento.id_agendamento);
                        carregarAgendamentosPorUnidade(codigoUnidade); // Recarregar a lista após exclusão
                    }
                });


                const acoesCell = document.createElement('td');
                // acoesCell.appendChild(editarButton);
                acoesCell.appendChild(excluirButton);
                row.appendChild(acoesCell);

                agendamentosList.appendChild(row);
            });
        }

        // Adicionar controles de paginação
        adicionarControlesPaginacao(totalPaginas);
    } catch (error) {
        console.error('Erro ao carregar agendamentos:', error);
        alert('Erro ao carregar agendamentos.');
    }
}


// Adicionar controles de paginação
function adicionarControlesPaginacao(totalPaginas) {
    const paginacao = document.getElementById('paginacao');
    paginacao.innerHTML = ''; // Limpa a página anterior

    // Controle de página anterior
    const botaoAnterior = document.createElement('button');
    botaoAnterior.textContent = 'Anterior';
    botaoAnterior.disabled = paginaAtual === 1; // Desabilita se estiver na primeira página
    botaoAnterior.addEventListener('click', () => {
        paginaAtual--;
        carregarAgendamentosPorUnidade(document.getElementById('unidadeSelect').value);
    });
    paginacao.appendChild(botaoAnterior);

    // Botões de página
    for (let i = 1; i <= totalPaginas; i++) {
        const botaoPagina = document.createElement('button');
        botaoPagina.textContent = i;
        botaoPagina.disabled = (i === paginaAtual); // Destacar a página atual

        // Adiciona a classe para botão da página ativa
        if (i === paginaAtual) {
            botaoPagina.classList.add('pagina-ativa');
        }

        botaoPagina.addEventListener('click', () => {
            paginaAtual = i;
            carregarAgendamentosPorUnidade(document.getElementById('unidadeSelect').value);
        });
        paginacao.appendChild(botaoPagina);
    }

    // Controle de próxima página
    const botaoProximo = document.createElement('button');
    botaoProximo.textContent = 'Próximo';
    botaoProximo.disabled = paginaAtual === totalPaginas; // Desabilita se estiver na última página
    botaoProximo.addEventListener('click', () => {
        paginaAtual++;
        carregarAgendamentosPorUnidade(document.getElementById('unidadeSelect').value);
    });
    paginacao.appendChild(botaoProximo);
}

// Função para excluir um agendamento
async function excluirAgendamento(idAgendamento) {
    try {
        const response = await fetch(`/excluir-agendamento/${idAgendamento}`, {
            method: 'DELETE' // Usando o método DELETE para a exclusão
        });

        if (!response.ok) throw new Error('Erro ao excluir agendamento.');

        alert('Agendamento excluído com sucesso!');
    } catch (error) {
        console.error('Erro ao excluir agendamento:', error);
        alert('Erro ao excluir agendamento.');
    }
}

// Função para formatar a data no formato brasileiro
function formatarData(data) {
    const dataObj = new Date(data);
    const utcDay = dataObj.getUTCDate();
    const utcMonth = dataObj.getUTCMonth() + 1; // Os meses são indexados de 0 a 11
    const utcYear = dataObj.getUTCFullYear();

    const day = utcDay < 10 ? '0' + utcDay : utcDay;
    const month = utcMonth < 10 ? '0' + utcMonth : utcMonth;

    return `${day}/${month}/${utcYear}`; // Formato brasileiro
}

// Função para formatar a hora considerando o fuso horário de São Paulo (Brazil)
function formatarHora(hora) {
    const [hours, minutes, seconds] = hora.split(':').map(Number);
    const dataHora = new Date(Date.UTC(1970, 0, 1, hours, minutes, seconds || 0));

    const horasUTC = dataHora.getUTCHours();
    const minutosUTC = dataHora.getUTCMinutes();
    const segundosUTC = dataHora.getUTCSeconds();

    const horas = horasUTC < 10 ? '0' + horasUTC : horasUTC;
    const minutos = minutosUTC < 10 ? '0' + minutosUTC : minutosUTC;
    const segundos = segundosUTC < 10 ? '0' + segundosUTC : segundosUTC;

    return `${horas}:${minutos}:${segundos}`;
}

document.getElementById('btnExcluirIntervalo').addEventListener('click', async () => {
    const dataInicio = document.getElementById('dataInicio').value;
    const dataFim = document.getElementById('dataFim').value;

    const unidadeSelect = document.getElementById('unidadeSelect');
    const codigoUnidade = unidadeSelect.value; // Captura a unidade selecionada

    if (!dataInicio || !dataFim) {
        alert('Por favor, selecione ambas as datas.');
        return;
    }

    if (!codigoUnidade) {
        alert('Por favor, selecione uma unidade antes de excluir agendamentos.');
        return;
    }

    // Mensagem de confirmação que inclui as datas e a unidade
    const mensagemConfirmacao = `Tem certeza que deseja excluir os agendamentos da unidade ${codigoUnidade} entre ${dataInicio} e ${dataFim}?`;
    const confirmacao = confirm(mensagemConfirmacao);

    // Se o usuário confirmar, chame a função de exclusão
    if (confirmacao) {
        await excluirAgendamentosNoIntervalo(codigoUnidade, dataInicio, dataFim);
    }
});

// Função para excluir agendamentos em um intervalo de datas para uma unidade específica
async function excluirAgendamentosNoIntervalo(codigoUnidade, dataInicio, dataFim) {
    try {
        const response = await fetch(`/excluir-agendamentos-intervalo`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ codigoUnidade, dataInicio, dataFim }),
        });

        if (!response.ok) throw new Error('Erro ao excluir agendamentos.');

        alert('Agendamentos excluídos com sucesso!');
        // Opcionalmente, recarregar a lista de agendamentos
        carregarAgendamentosPorUnidade(codigoUnidade);
    } catch (error) {
        console.error('Erro ao excluir agendamentos:', error);
        alert('Erro ao excluir agendamentos.');
    }
}

