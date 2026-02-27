// gerenciarequipamentos.js (CÓDIGO COMPLETO E FUNCIONAL)

// =======================================================
//   *** CONTROLE DO MODAL DE EDIÇÃO (INÍCIO) ***
// =======================================================
// Variáveis Globais de Edição
const modal = document.getElementById('modalEdicaoMonitor');
const closeButton = modal ? modal.querySelector('.close-button') : null;
const btnRemoverAssociacao = document.getElementById('btnRemoverAssociacao');
const formEditarMonitor = document.getElementById('formEditarMonitor');
const btnExcluirPermanentemente = document.getElementById('btnExcluirPermanentemente');
let monitorSalaId = null; 

if (modal && closeButton) {
    closeButton.addEventListener('click', () => modal.style.display = 'none');
    window.addEventListener('click', (event) => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });
}
if (btnExcluirPermanentemente) {
    btnExcluirPermanentemente.addEventListener('click', () => {
        const monitorId = document.getElementById('editMonitorId').value;
        const monitorPatrimonio = document.getElementById('editPatrimonio').value;
        if (monitorId) {
            excluirMonitorPermanentemente(parseInt(monitorId), monitorPatrimonio);
        }
    });
}
function abrirModalEdicaoMonitor(event) {
    const button = event.currentTarget;
    // Opcional: Busca por ID se os datasets estiverem incompletos, mas vamos confiar nos datasets
    const id = button.dataset.id;
    const modelo = button.dataset.modelo;
    const polegadas = button.dataset.polegadas;
    const serie = button.dataset.serie;
    const patrimonio = button.dataset.patrimonio;
    const idSala = button.dataset.idSala;
    
    // Atualiza o título e os campos do formulário
    document.getElementById('monitorTitulo').textContent = `${modelo} - ${patrimonio}`;
    document.getElementById('editMonitorId').value = id;
    document.getElementById('editModelo').value = modelo;
    document.getElementById('editPolegadas').value = polegadas;
    document.getElementById('editNumeroSerie').value = serie;
    document.getElementById('editPatrimonio').value = patrimonio;
    
    monitorSalaId = idSala;

    // Lógica para mostrar/esconder o botão de remoção da sala
    if (idSala) {
        btnRemoverAssociacao.style.display = 'inline-block';
        // Passamos a salaId e o monitorId
        btnRemoverAssociacao.onclick = () => desassociarMonitor(parseInt(id), parseInt(idSala));
    } else {
        btnRemoverAssociacao.style.display = 'none';
        btnRemoverAssociacao.onclick = null;
    }

    modal.style.display = 'block';
}
// =======================================================
//   *** NOVA FUNÇÃO: EXCLUSÃO PERMANENTE ***
// =======================================================

async function excluirMonitorPermanentemente(monitorId, patrimonio) {
    if (!confirm(`ATENÇÃO! Você irá EXCLUIR PERMANENTEMENTE o monitor ${patrimonio} (ID: ${monitorId}) do inventário. Esta ação é IRREVERSÍVEL. Continuar?`)) {
        return;
    }

    try {
        const res = await fetch(`/excluir-monitor/${monitorId}`, {
            method: 'DELETE'
        });

        if (res.ok) {
            alert('Monitor excluído permanentemente do inventário.');
            
            // 1. Fechar o modal
            modal.style.display = 'none'; 
            
            // 2. Limpar e recarregar as listas (disponíveis e associados)
            carregarEquipamentos();
            carregarAssociados(); 
            
        } else {
            const msg = await res.text();
            alert(`Erro ao excluir monitor: ${msg}`);
        }
    } catch (err) {
        console.error('Erro ao excluir monitor permanentemente:', err);
        alert('Erro de conexão ao tentar excluir monitor.');
    }
}
function desassociarMonitor(monitorId, salaId) {
    if (!confirm('Tem certeza que deseja remover este monitor da sala?')) return;
    
    // Esconde o modal para evitar confusão visual enquanto a requisição é processada
    if (modal) {
        modal.style.display = 'none';
    }
    
    // Reutiliza a função de remoção que já existe e trata o fetch DELETE
    removerMonitor(monitorId, salaId); 
}
// =======================================================
//   *** FIM CONTROLE DO MODAL DE EDIÇÃO ***
// =======================================================


// =======================================================
//   *** FUNÇÕES DE RENDERIZAÇÃO E PAGINAÇÃO ***
// =======================================================

function renderComputadores() {
    const filtro = document.getElementById('filtroComputadores').value.toLowerCase();
    const lista = document.getElementById('listaComputadores');
    const paginacao = document.getElementById('paginacaoComputadores');

    const filtrados = computadores.filter(c => c.nome_computador.toLowerCase().includes(filtro) || (c.patrimonio && c.patrimonio.toLowerCase().includes(filtro)));
    const totalPaginas = Math.ceil(filtrados.length / itensPorPagina);
    const inicio = (paginaAtualComputadores - 1) * itensPorPagina;
    const pagina = filtrados.slice(inicio, inicio + itensPorPagina);

    lista.innerHTML = '';
    pagina.forEach(c => {
        const li = document.createElement('li');
        const isDisabled = c.id_sala ? 'disabled' : '';
        const nomeSala = salas[c.id_sala] || 'Sala Desconhecida'; // Adicionado para computadores também
        const isAssociated = c.id_sala ? `(Associado à Sala ${nomeSala})` : ''; // Usa nome da sala

        li.innerHTML = `<label>
            <input type="checkbox" class="computador-checkbox" value="${c.id}" ${isDisabled}> 
            ${c.nome_computador} - IP: ${c.endereco_ip} - Patrimônio: ${c.patrimonio} ${isAssociated}
        </label>`;
        lista.appendChild(li);
    });

    paginacao.innerHTML = gerarPaginacao(totalPaginas, paginaAtualComputadores, 'computadores');
}

function renderMonitores() {
    const filtro = document.getElementById('filtroMonitores').value.toLowerCase();
    const lista = document.getElementById('listaMonitores');
    const paginacao = document.getElementById('paginacaoMonitores');

    const filtrados = monitores.filter(m => m.modelo.toLowerCase().includes(filtro) || (m.patrimonio && m.patrimonio.toLowerCase().includes(filtro)));
    const totalPaginas = Math.ceil(filtrados.length / itensPorPagina);
    const inicio = (paginaAtualMonitores - 1) * itensPorPagina;
    const pagina = filtrados.slice(inicio, inicio + itensPorPagina);

    lista.innerHTML = '';
    pagina.forEach(m => {
        const li = document.createElement('li');
        const isDisabled = m.id_sala ? 'disabled' : '';
        const nomeSala = salas[m.id_sala] || 'Sala Desconhecida'; 
        const isAssociated = m.id_sala ? `(Associado à Sala ${nomeSala})` : '';

        // NOVO CÓDIGO AQUI: Adicionando o botão de Edição
        li.innerHTML = `
            <label>
                <input type="checkbox" class="monitor-checkbox" value="${m.id}" ${isDisabled}> 
                ${m.modelo} - ${m.polegadas} - Patrimônio: ${m.patrimonio} ${isAssociated}
            </label>
            <button class="btn-editar-monitor" 
                data-id="${m.id}" 
                data-modelo="${m.modelo}" 
                data-polegadas="${m.polegadas}" 
                data-serie="${m.numero_serie}" 
                data-patrimonio="${m.patrimonio}" 
                data-id-sala="${m.id_sala || ''}">
                <i class="fas fa-edit"></i> Editar
            </button>
        `;
        lista.appendChild(li);
    });
    
    // ATUALIZAÇÃO: Adiciona listener DEPOIS que a lista é renderizada
    document.querySelectorAll('.btn-editar-monitor').forEach(button => {
        button.addEventListener('click', abrirModalEdicaoMonitor);
    });

    paginacao.innerHTML = gerarPaginacao(totalPaginas, paginaAtualMonitores, 'monitores');
}


function gerarPaginacao(total, atual, tipo) {
    let html = '';
    if (total <= 1) return '';

    html += `<button onclick="mudarPagina('${tipo}', 1)"><<</button>`;
    html += `<button onclick="mudarPagina('${tipo}', ${Math.max(1, atual - 1)})"><</button>`;
    
    const maxPaginas = 5;
    let startPage = Math.max(1, atual - Math.floor(maxPaginas / 2));
    let endPage = Math.min(total, startPage + maxPaginas - 1);
    
    if (endPage - startPage + 1 < maxPaginas) {
        startPage = Math.max(1, endPage - maxPaginas + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
        html += `<button onclick="mudarPagina('${tipo}', ${i})" ${i === atual ? 'class="active"' : ''}>${i}</button>`;
    }

    html += `<button onclick="mudarPagina('${tipo}', ${Math.min(total, atual + 1)})">></button>`;
    html += `<button onclick="mudarPagina('${tipo}', ${total})">>></button>`;

    return html;
}

function mudarPagina(tipo, pagina) {
    if (tipo === 'computadores') {
        paginaAtualComputadores = pagina;
        renderComputadores();
    } else {
        paginaAtualMonitores = pagina;
        renderMonitores();
    }
}

// =======================================================
//   *** VARIÁVEIS E EVENTOS GLOBAIS ***
// =======================================================

let equipamentosVisiveis = false;
let computadores = [];
let salas = {};
let monitores = [];
let paginaAtualComputadores = 1;
let paginaAtualMonitores = 1;
const itensPorPagina = 50;

document.addEventListener('DOMContentLoaded', () => {
    carregarUnidades();
    carregarTodasAsSalas(); 
    document.getElementById('unidade').addEventListener('change', carregarSalas);
    document.getElementById('tipoSala').addEventListener('change', carregarSalas);
    document.getElementById('filtroComputadores').addEventListener('input', () => renderComputadores());
    document.getElementById('filtroMonitores').addEventListener('input', () => renderMonitores());
    document.getElementById('sala').addEventListener('change', carregarAssociados);
    
    // Novo: Listener para o formulário de edição do monitor
    if (formEditarMonitor) {
        formEditarMonitor.addEventListener('submit', salvarEdicaoMonitor);
    }
});

// =======================================================
//   *** FUNÇÕES PRINCIPAIS E FUNÇÕES DE EDIÇÃO/SALVAMENTO ***
// =======================================================

// Lógica de SALVAR EDIÇÃO DO MONITOR (NOVA FUNÇÃO)
async function salvarEdicaoMonitor(e) {
    e.preventDefault();

    const id = document.getElementById('editMonitorId').value;
    const modelo = document.getElementById('editModelo').value;
    const polegadas = parseInt(document.getElementById('editPolegadas').value);
    const numero_serie = document.getElementById('editNumeroSerie').value;
    const patrimonio = document.getElementById('editPatrimonio').value;

    try {
        const res = await fetch(`/editar-monitor/${id}`, { 
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ modelo, polegadas, numero_serie, patrimonio })
        });

        if (res.ok) {
            alert('Monitor atualizado com sucesso!');
            modal.style.display = 'none';
            carregarEquipamentos(); // Recarrega a lista para mostrar a mudança
            carregarAssociados(); // Recarrega a lista de associados caso a edição tenha afetado o item
        } else {
            const msg = await res.text();
            alert(`Erro ao atualizar monitor: ${msg}`);
        }
    } catch (err) {
        console.error('Erro ao salvar monitor:', err);
        alert('Erro ao salvar monitor. Verifique se o servidor está rodando e a rota PUT está configurada.');
    }
}


async function carregarTodasAsSalas() {
    try {
        const [salasAcademicas, salasAdministrativas] = await Promise.all([
            fetch('/todas-salas-academicas').then(res => res.json()),
            fetch('/todas-salas-administrativas').then(res => res.json())
        ]);

        salas = {};
        [...salasAcademicas, ...salasAdministrativas].forEach(sala => {
            salas[sala.id_sala] = sala.nome_sala;
        });
        console.log('Salas carregadas:', salas);
    } catch (error) {
        console.error('Erro ao carregar todas as salas:', error); 
    }
}

function carregarUnidades() {
    fetch('/unidades')
        .then(response => response.json())
        .then(data => {
            const unidadeSelect = document.getElementById('unidade');
            unidadeSelect.innerHTML = '<option value="">Selecione a unidade</option>';
            data.forEach(unidade => {
                const option = document.createElement('option');
                option.value = unidade.codigo_unidade;
                option.textContent = unidade.nome_unidade;
                unidadeSelect.appendChild(option);
            });
        })
        .catch(error => console.error('Erro ao carregar unidades:', error));
}

function carregarSalas() {
    const unidade = document.getElementById('unidade').value;
    const tipoSala = document.getElementById('tipoSala').value;
    const salaSelect = document.getElementById('sala');

    if (!unidade) {
        salaSelect.innerHTML = '<option value="">Selecione uma unidade primeiro</option>';
        return;
    }

    const rota = tipoSala === 'administrativa' ? `/SalasAdministrativas/${unidade}` : `/salas/${unidade}`;

    fetch(rota)
        .then(response => response.json())
        .then(data => {
            salaSelect.innerHTML = '<option value="">Selecione a sala</option>';
            data.forEach(sala => {
                const option = document.createElement('option');
                option.value = sala.id_sala;
                option.textContent = sala.nome_sala;
                salaSelect.appendChild(option);
            });
        })
        .catch(error => console.error('Erro ao carregar salas:', error));
}

function carregarEquipamentos() {
    fetch('/infocomputadores')
        .then(res => res.json())
        .then(data => {
            computadores = data;
            paginaAtualComputadores = 1;
            renderComputadores();
        });

    fetch('/monitores') 
        .then(res => res.json())
        .then(data => {
            monitores = data;
            paginaAtualMonitores = 1;
            renderMonitores();
        });

    equipamentosVisiveis = true;
}

async function carregarAssociados() {
    const salaId = document.getElementById('sala').value;
    const tipoSala = document.getElementById('tipoSala').value;
    const tabela = document.querySelector('#tabelaComputadoresAssociados tbody');
    const contador = document.getElementById('contadorComputadores');
    tabela.innerHTML = '';
    
    if (!salaId) {
        contador.textContent = '';
        return;
    }

    try {
        const computadores = await fetch(`/computadores-associados/${salaId}/${tipoSala}`).then(res => res.json());
        const monitores = await fetch(`/monitores-associados/${salaId}`).then(res => res.json());

        computadores.forEach(c => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${c.nome_computador}</td>
                <td>${c.endereco_mac}</td>
                <td>${c.cpu_info}</td>
                <td>${c.disco_info}</td>
                <td>${c.SerialNumber}</td>
                <td>${c.endereco_ip}</td>
                <td>${c.patrimonio || '-'}</td>
                <td><button onclick="removerComputador(${c.id_computador}, ${salaId})">Remover</button></td>
            `;
            tabela.appendChild(tr);
        });

        monitores.forEach(m => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>Monitor: ${m.modelo} Polegadas: ${m.polegadas}</td>
                <td>-</td>
                <td>-</td>
                <td>-</td>
                <td>${m.numero_serie || '-'}</td>
                <td>-</td>
                <td>${m.patrimonio || '-'}</td>
                <td><button onclick="removerMonitor(${m.id}, ${salaId})">Remover</button></td>
            `;
            tabela.appendChild(tr);
        });
        
        const totalEquipamentos = computadores.length + monitores.length;
        if (totalEquipamentos === 0) {
            tabela.innerHTML = '<tr><td colspan="8">Nenhum equipamento associado a esta sala.</td></tr>';
            contador.textContent = '';
        } else {
            contador.textContent = `Total de equipamentos associados: ${totalEquipamentos}`;
        }
    } catch (error) {
        console.error('Erro ao carregar equipamentos associados:', error);
        tabela.innerHTML = '<tr><td colspan="8">Erro ao carregar dados.</td></tr>';
    }
}

async function associarSelecionados() {
    const salaId = document.getElementById('sala').value;
    const tipoSala = document.getElementById('tipoSala').value;

    if (!salaId) {
        alert('Selecione uma sala antes de associar os equipamentos.');
        return;
    }
    
    const computadoresAssociados = await fetch(`/computadores-associados/${salaId}/${tipoSala}`)
        .then(res => res.json())
        .catch(err => []);
    const idsComputadoresAssociados = computadoresAssociados.map(c => c.id_computador);
    
    const idsTodosMonitoresAssociados = await fetch('/monitores-associados-all')
        .then(res => res.json())
        .catch(err => []);
    
    const computadoresSelecionados = Array.from(document.querySelectorAll('.computador-checkbox:checked'))
        .map(cb => parseInt(cb.value))
        .filter(id => !idsComputadoresAssociados.includes(id));
    
    const monitoresSelecionados = Array.from(document.querySelectorAll('.monitor-checkbox:checked'))
        .map(cb => parseInt(cb.value))
        .filter(id => !idsTodosMonitoresAssociados.includes(id));
        
    let associadosNovos = 0;

    for (const id of computadoresSelecionados) {
        await fetch('/associar-computador', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ salaId, computadorId: id, tipoSala })
        }).catch(err => console.error('Erro ao associar computador:', err));
        associadosNovos++;
    }

    for (const id of monitoresSelecionados) {
        await fetch('/associar-monitor', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ salaId, monitorId: id })
        }).catch(err => console.error('Erro ao associar monitor:', err));
        associadosNovos++;
    }

    if (associadosNovos > 0) {
        alert('Equipamentos associados com sucesso!');
        document.getElementById('filtroComputadores').value = '';
        document.getElementById('filtroMonitores').value = '';
        document.querySelectorAll('.computador-checkbox, .monitor-checkbox').forEach(cb => {
            cb.checked = false;
        });
        carregarEquipamentos(); 
        
    } else {
        alert('Nenhum novo equipamento foi associado. Verifique se já estão vinculados à sala.');
    }

    carregarAssociados(); 
}

function removerComputador(computadorId, salaId) {
    const tipoSala = document.getElementById('tipoSala').value;
    if (!confirm('Tem certeza que deseja remover este computador da sala?')) return;

    fetch(`/desassociar-computador/${computadorId}/${salaId}/${tipoSala}`, {
        method: 'DELETE'
    })
    .then(res => {
        if (res.ok) {
            alert('Computador removido com sucesso!');
            carregarAssociados();
            carregarEquipamentos(); 
        } else {
            alert('Erro ao remover computador.');
        }
    })
    .catch(err => {
        console.error('Erro ao remover computador:', err);
        alert('Erro ao remover computador.');
    });
}

function removerMonitor(monitorId, salaId) {
    if (!confirm('Tem certeza que deseja remover este monitor da sala?')) return;

    fetch(`/desassociar-monitor/${monitorId}/${salaId}`, {
        method: 'DELETE'
    })
    .then(res => {
        if (res.ok) {
            alert('Monitor removido com sucesso!');
            carregarAssociados();
            carregarEquipamentos(); 
        } else {
            alert('Erro ao remover monitor.');
        }
    })
    .catch(err => {
        console.error('Erro ao remover monitor:', err);
        alert('Erro ao remover monitor.');
    });
}

document.getElementById('formMonitor').addEventListener('submit', async (e) => {
    e.preventDefault();

    const modelo = document.getElementById('modelo').value;
    const polegadas = parseInt(document.getElementById('polegadas').value);
    const numero_serie = document.getElementById('numero_serie').value;
    const patrimonio = document.getElementById('patrimonio').value;

    try {
        const res = await fetch('/cadastrar-monitor', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ modelo, polegadas, numero_serie, patrimonio })
        });

        if (res.ok) {
            alert('Monitor cadastrado com sucesso!');
            document.getElementById('formMonitor').reset();
            carregarEquipamentos(); 
        } else {
            const msg = await res.text();
            alert(`Erro: ${msg}`);
        }
    } catch (err) {
        console.error('Erro ao cadastrar monitor:', err);
        alert('Erro ao cadastrar monitor.');
    }
});