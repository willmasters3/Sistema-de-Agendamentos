

document.addEventListener('DOMContentLoaded', () => {

    const statusElement = document.getElementById('status');
    const screenElement = document.getElementById('screen');
    const titleElement = document.getElementById('viewTitle');
    const disconnectBtn = document.getElementById('disconnectBtn');
    const resInfoElement = document.getElementById('resInfo');

    let currentObjectUrl = null;

    // DECLARAR PRIMEIRO AS VARIÁVEIS
    let nativeScreenWidth = 1920;
    let nativeScreenHeight = 1080;

    // AGORA SIM PODE USAR ELAS
    resInfoElement.innerText =
        `Resolução do agente: ${nativeScreenWidth} x ${nativeScreenHeight}`;



    const params = new URLSearchParams(window.location.search);
    const agentSerial = params.get('serial');

    if (!agentSerial) {
        statusElement.textContent = 'Erro: Serial Number do agente não foi fornecido na URL.';
        statusElement.style.color = 'red';
        return;
    }
    
    titleElement.textContent = `Visualizando Agente: ${agentSerial}`;
    statusElement.textContent = `Aguardando stream...`;

    const ws = new WebSocket('ws://10.165.128.68:8080');

    ws.onopen = () => {
        console.log('Conectado ao servidor WebSocket para visualização.');
        statusElement.textContent = `Conectado. Solicitando stream...`;
        disconnectBtn.classList.remove('hidden');

        const subscriptionMessage = {
            type: 'subscribe',
            serial: agentSerial
        };
        ws.send(JSON.stringify(subscriptionMessage));
    };

    ws.onmessage = (event) => {

    // Se for imagem (stream)
    if (event.data instanceof Blob) {
        statusElement.textContent = `Recebendo stream...`;

        if (currentObjectUrl) {
            URL.revokeObjectURL(currentObjectUrl);
        }

        currentObjectUrl = URL.createObjectURL(event.data);
        screenElement.src = currentObjectUrl;

        return;
    }

    // Se for mensagem JSON (ex: resolução do agente)
    try {
        const data = JSON.parse(event.data);

        if (data.type === "agent_info" || data.type === "register") {

            nativeScreenWidth = data.width;
            nativeScreenHeight = data.height;

            console.log("Resolução recebida do agente:", nativeScreenWidth, "x", nativeScreenHeight);

            statusElement.textContent = `Conectado - Resolução do agente: ${nativeScreenWidth}x${nativeScreenHeight}`;
        }

    } catch (e) {
        console.error("Mensagem WS inválida:", e);
    }
};

    ws.onclose = () => {
        console.log('Conexão WebSocket de visualização fechada. Fechando a janela.');
        statusElement.textContent = 'Desconectado. Fechando...';
        window.close();
    };

    ws.onerror = (error) => {
        console.error('Erro no WebSocket de visualização:', error);
        statusElement.textContent = 'Erro de conexão com o servidor WebSocket.';
        statusElement.style.color = 'red';
    };

    disconnectBtn.addEventListener('click', () => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.close();
        }
    });

    function sendControlCommand(command) {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(command));
        }
    }

    // --- LÓGICA DE CONTROLE DO MOUSE CORRIGIDA ---

    function handleMouseEvent(e) {
        e.preventDefault();
    
        const rect = screenElement.getBoundingClientRect();
        console.log("Mouse:", scaledX, scaledY);

        // posição real do mouse dentro do elemento
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
    
        // tamanho real renderizado
        const displayWidth = rect.width;
        const displayHeight = rect.height;
    
        const scaleX = nativeScreenWidth / displayWidth;
        const scaleY = nativeScreenHeight / displayHeight;
    
        const scaledX = Math.round(mouseX * scaleX);
        const scaledY = Math.round(mouseY * scaleY);
    
        if (
            scaledX < 0 || scaledY < 0 ||
            scaledX > nativeScreenWidth ||
            scaledY > nativeScreenHeight
        ) return;
    
        let commandType = '';
        if (e.type === 'mousemove') commandType = 'mouse_move';
        if (e.type === 'mousedown') commandType = 'mouse_down';
        if (e.type === 'mouseup') commandType = 'mouse_up';
    
        sendControlCommand({
            type: commandType,
            x: scaledX,
            y: scaledY,
            button: e.button === 0 ? 'left' : (e.button === 2 ? 'right' : 'middle')
        });
    }
    

    // --- LÓGICA DE CONTROLE DO TECLADO ADICIONADA ---

    function handleKeyboardEvent(e) {
        // Previne ações padrão do navegador (Ex: F5 recarregar, Tab mudar de campo)
        e.preventDefault(); 
        
        const command = {
            type: e.type === 'keydown' ? 'key_down' : 'key_up',
            keyCode: e.keyCode // Envia o código numérico da tecla
        };
        sendControlCommand(command);
    }
    
    // Captura os eventos de teclado na janela inteira
    window.addEventListener('keydown', handleKeyboardEvent);
    window.addEventListener('keyup', handleKeyboardEvent);
    screenElement.addEventListener('contextmenu', (e) => e.preventDefault());
});