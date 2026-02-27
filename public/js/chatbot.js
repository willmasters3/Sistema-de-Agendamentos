document.addEventListener('DOMContentLoaded', () => {
    // Atenção: O HTML tem dois elementos com id="chatContainer".
    // Certifique-se de que o JS está referenciando o correto.
    const chatContainer = document.getElementById('chatContainer');
    const userInput = document.getElementById('userInput');
    const sendMessageButton = document.getElementById('sendMessage');
    const chatbot = document.getElementById('chatbot'); // O container do widget

    let currentStep = 'greeting'; // Controla o fluxo (greeting, askUnit, askRoom)
    let selectedUnit = null; 
    let selectedRoom = null; 

    function obterSaudacao() {
        const horaAtual = new Date().getHours();
        if (horaAtual < 12) return 'Bom dia!';
        if (horaAtual < 18) return 'Boa tarde!';
        return 'Boa noite!';
    }

    // Função para adicionar mensagens
    function addMessage(content, sender) {
        const messageElement = document.createElement('div');
        // Usamos 'user' e 'chatbot' internamente
        messageElement.className = (sender === 'user' ? 'user-message' : 'chatbot-message');
        messageElement.innerHTML = content;
        chatContainer.appendChild(messageElement);
        
        // Rola automaticamente para baixo
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    // --------------------------------------------------------
    // FUNÇÃO QUE CHAMA A API GEMINI (NOVA)
    // --------------------------------------------------------
    async function fetchGeminiReply(message) {
        try {
            // Adiciona um placeholder de "digitando"
            addMessage('🤖 digitando...', 'chatbot'); 
            
            const response = await fetch('/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: message })
            });

            // Remove o feedback 'digitando...'
            if (chatContainer.lastElementChild && chatContainer.lastElementChild.textContent.includes('digitando')) {
                 chatContainer.lastElementChild.remove();
            }

            if (!response.ok) {
                throw new Error(`Erro ${response.status}: Falha na API do Chatbot.`);
            }

            const data = await response.json();
            return data.reply;

        } catch (error) {
            console.error("Erro na comunicação com o Gemini:", error);
            // Retorna uma resposta amigável em caso de falha
            return 'Desculpe, a IA está indisponível ou ocorreu um erro de comunicação.';
        }
    }
    
    // --------------------------------------------------------
    // FLUXO FIXO DE INVENTÁRIO (Sua lógica original)
    // --------------------------------------------------------

    function startChat() {
        const saudacao = obterSaudacao();
        addMessage(saudacao, 'chatbot');
        currentStep = 'askUnit'; 
        addMessage('Qual unidade você deseja acessar?', 'chatbot');
        
        fetchUnidades().then(unidades => {
            unidades.forEach(unit => {
                addMessage(`<a href="#" class="link-unidade" data-codigo="${unit.codigo_unidade}">${unit.nome_unidade}</a>`, 'chatbot');
            });
            handleLinks(); 
        });
    }

    async function fetchUnidades() {
        const response = await fetch('/unidades');
        return response.ok ? await response.json() : [];
    }

    async function fetchSalas(unit) {
        const response = await fetch(`/salas/${unit}`);
        return response.ok ? await response.json() : [];
    }

    async function obterInformacoesSala(roomId) {
        const response = await fetch(`/sala/${roomId}`);
        return response.ok ? await response.json() : null;
    }

    // Função para lidar com o clique em links (Navegação Fixa)
    async function handleInventoryNavigation(input) {
        // Se o input não é um link, mas o fluxo espera um código, ele é tratado aqui (ex: se o usuário digitar o código da sala)

        if (currentStep === 'askUnit') {
            selectedUnit = input; 
            const unitLink = chatContainer.querySelector(`.link-unidade[data-codigo="${input}"]`);
            const unitName = unitLink ? unitLink.textContent : selectedUnit; // Tenta pegar o nome

            addMessage(`Você escolheu a unidade **${unitName}**. Quais salas você deseja acessar?`, 'chatbot');
            currentStep = 'askRoom';
            
            const salas = await fetchSalas(selectedUnit);
            if (salas.length > 0) {
                salas.forEach(room => {
                    addMessage(`<a href="#" class="link-sala" data-id="${room.id_sala}">${room.nome_sala}</a>`, 'chatbot');
                });
            } else {
                addMessage(`Não há salas disponíveis para a unidade ${unitName}.`, 'chatbot');
            }
            handleLinks(); 
            return;
        }

        if (currentStep === 'askRoom') {
            selectedRoom = input; 
            const salaInfo = await obterInformacoesSala(selectedRoom);
            
            if (salaInfo) {
                const detalhes = `
                    <strong>Unidade:</strong> ${salaInfo.codigo_unidade}<br>
                    <strong>Nome:</strong> ${salaInfo.nome_sala}<br>
                    <strong>Computadores:</strong> ${salaInfo.computadores ?? 'N/A'}<br>
                    <strong>Recursos:</strong> ${salaInfo.maquinario ?? 'N/A'}<br>
                `;
                addMessage(`Detalhes da Sala ${salaInfo.nome_sala}:<br>${detalhes}`, 'chatbot');
            } else {
                addMessage('Desculpe, não consegui encontrar informações sobre esta sala.', 'chatbot');
            }
            
            currentStep = 'greeting'; 
            addMessage('Em que mais posso ajudar? (Diga "iniciar" para buscar outra sala)', 'chatbot');
            return;
        }
    }


    // --------------------------------------------------------
    // FUNÇÃO PRINCIPAL QUE FUNDE INVENTÁRIO E IA
    // --------------------------------------------------------

    // Função PRINCIPAL QUE FUNDE INVENTÁRIO E IA
async function handleInputAndRoute(input) {
    const normalizedInput = input.toLowerCase().trim();
    
    // 1. COMANDO DE NAVEGAÇÃO FIXA (Inicia/Continua o Fluxo de Inventário)
    if (normalizedInput === 'iniciar' || normalizedInput === 'start') {
        startChat();
        return;
    }
    
    // 2. CONTINUA O FLUXO DE NAVEGAÇÃO
    if (currentStep !== 'greeting') {
        // Se já estamos em um fluxo fixo (askUnit ou askRoom), chamamos o handleInventoryNavigation
        if (currentStep === 'askUnit' || currentStep === 'askRoom') {
             // Tratamos o input como uma seleção de unidade ou sala
             return handleInventoryNavigation(input);
        }
    }
    
    // 3. MODO CHAT GERAL (API GEMINI)
    // Se não for um comando fixo nem parte de um fluxo em andamento, vá para a IA.
    const geminiReply = await fetchGeminiReply(input);
    addMessage(geminiReply, 'chatbot');
}

    // A função para lidar com links de unidade e sala
    function handleLinks() {
        const linkHandler = (e) => {
            e.preventDefault();
            const value = e.currentTarget.dataset.codigo || e.currentTarget.dataset.id;
            const text = e.currentTarget.textContent;
            
            addMessage(text, 'user'); 
            handleInputAndRoute(value); // Envia o valor (código ou ID) para o roteador
        };

        // Remove e adiciona listeners para evitar duplicidade de eventos
        const existingLinks = chatContainer.querySelectorAll('.link-unidade, .link-sala');
        existingLinks.forEach(link => {
            link.removeEventListener('click', linkHandler);
            link.addEventListener('click', linkHandler);
        });
        
    }


    // --------------------------------------------------------
    // LISTENERS GLOBAIS
    // --------------------------------------------------------
    
    // Listener para o botão Enviar (ou Enter)
    sendMessageButton.addEventListener('click', () => {
        const input = userInput.value.trim();
        if (input) {
            addMessage(input, 'user');
            userInput.value = '';
            // Roteia a entrada digitada
            handleInputAndRoute(input); 
        }
    });

    userInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault(); // Impede que o form seja submetido (se houver)
            sendMessageButton.click(); 
        }
    });

    // Listener para Abre/Fecha o Chatbot (A Bolinha/Ícone)
    const chatButton = document.getElementById('chatButton');
    if (chatButton) {
        chatButton.addEventListener('click', () => {
            // Alterna a visibilidade do widget principal (#chatbot)
            const isHidden = chatbot.style.display === 'none' || chatbot.style.display === '';
            chatbot.style.display = isHidden ? 'flex' : 'none';
            
            // Se estiver abrindo e for o início, inicie o fluxo
            if (isHidden && currentStep === 'greeting') {
                addMessage(obterSaudacao() + " Eu sou o seu assistente. Digite 'iniciar' para buscar salas ou faça uma pergunta livre.", 'chatbot');
            }
        });
    }

    // NOVO LISTENER: Fechar o Chatbot (Se o botão X for adicionado ao HTML)
    const closeChatButton = document.getElementById('close-chat');
    if (closeChatButton) {
        closeChatButton.addEventListener('click', () => {
            chatbot.style.display = 'none';
        });
    }

    // Mensagem inicial de boas-vindas
    if (chatbot.style.display === 'flex' && currentStep === 'greeting') {
        addMessage(obterSaudacao() + " Eu sou o seu assistente. Digite 'iniciar' para buscar salas ou faça uma pergunta livre.", 'chatbot');
    }
});
