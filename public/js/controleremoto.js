

// A URL base do seu servidor, sem nenhum prefixo de rota.
const API_BASE_URL = 'http://10.165.128.68:3000';

// --- Funções de Interface (Modais) ---

function showModal(title, message) {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalMessage').textContent = message;
    document.getElementById('notificationModal').classList.remove('hidden');
    document.getElementById('notificationModal').classList.add('flex');
}

function closeModal() {
    document.getElementById('notificationModal').classList.add('hidden');
    document.getElementById('notificationModal').classList.remove('flex');
}

// --- Lógica de Comunicação com o Backend ---

// Esta função busca o inventário e já está funcionando corretamente.
async function fetchInventoryAndStatus() {
    document.getElementById('loading').classList.remove('hidden');
    
    let inventoryData = [];

    try {
        const response = await fetch(`${API_BASE_URL}/computadores/inventario`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });

        if (!response.ok) {
            throw new Error(`Erro ao buscar inventário: Status ${response.status}`);
        }

        inventoryData = await response.json();
        
    } catch (error) {
        console.error('Erro ao buscar dados do inventário:', error);
        document.getElementById('loading').textContent = `Erro ao carregar o inventário. Verifique os logs do servidor Node.js.`;
        document.getElementById('loading').classList.remove('hidden');
        document.getElementById('agentsTable').classList.add('hidden');
        return;
    }

    const agentsBody = document.getElementById('agentsBody');
    agentsBody.innerHTML = '';
    
    inventoryData.forEach(pc => {
        const isConnected = pc.isConnected;
        const serialNumber = pc.serialNumber;
        const ipAddress = pc.ipAddress;
        const lastLoggedUser = pc.lastLoggedUser;

        const row = agentsBody.insertRow();
        row.className = isConnected ? 'hover:bg-green-50' : 'bg-gray-100 text-gray-500';

        row.insertCell().textContent = pc.nomeComputador || 'N/A';
        row.insertCell().textContent = serialNumber || 'N/A';
        row.insertCell().textContent = ipAddress || 'N/A'; 
        row.insertCell().textContent = (lastLoggedUser && lastLoggedUser.split('\\').pop()) || 'N/A'; 

        const statusCell = row.insertCell();
        statusCell.className = 'px-6 py-4 whitespace-nowrap text-sm font-medium text-center';
        statusCell.innerHTML = `<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${isConnected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
            ${isConnected ? 'Conectado (WS Ativo)' : 'Offline/Aguardando'}
        </span>`;

        const actionCell = row.insertCell();
        actionCell.className = 'px-6 py-4 whitespace-nowrap text-sm font-medium text-center';
        
        if (isConnected) {
            const button = document.createElement('button');
            button.textContent = 'Iniciar Sessão Remota'; 
            button.className = 'bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition duration-150 transform hover:scale-105';
            button.onclick = () => sendRemoteCommand(serialNumber); 
            actionCell.appendChild(button);
        } else {
            actionCell.textContent = 'Agente inativo';
        }
    });

    document.getElementById('loading').classList.add('hidden');
    document.getElementById('agentsTable').classList.remove('hidden');
}


// Esta função envia o comando para iniciar o acesso remoto.
// Contém as correções para a URL e para abrir a nova janela.
async function sendRemoteCommand(serialNumber) {
    // CORREÇÃO 1: Limpa o número de série para remover barras extras (ex: /ABC/ -> ABC)
    // Isso conserta o erro da URL com barras duplas (//).
    const cleanSerialNumber = serialNumber.replace(/\//g, '');

    showModal("Enviando Comando...", `Solicitando sessão remota no PC ${cleanSerialNumber}.`); 
    
    try {
        // Usamos a variável "cleanSerialNumber" para montar a URL corretamente
        const response = await fetch(`${API_BASE_URL}/comando-agente/${cleanSerialNumber}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                command: 'START_CUSTOM_REMOTE' 
            })
        });

        if (response.ok) {
            // CORREÇÃO 2: Comando enviado com sucesso! Agora abrimos a janela do visualizador.
            // Sem esta linha, a tela de streaming nunca apareceria.
            closeModal();
            window.open(`/html/remote-view.html?serial=${cleanSerialNumber}`, '_blank');
        } else {
            const errorText = await response.text();
            showModal("Erro ao Enviar", `O servidor respondeu com falha (Status: ${response.status}). Detalhes: ${errorText}`);
        }

    } catch (error) {
        console.error("Erro na função sendRemoteCommand:", error);
        showModal("Erro de Rede", `Não foi possível alcançar o servidor Node.js.`);
    }
}

// Inicia o carregamento da lista de computadores quando a página abre
window.onload = fetchInventoryAndStatus;