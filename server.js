// server.js (VERSÃO FINAL E CORRIGIDA - COPIE E COLE TUDO)

const express = require('express');
const session = require('express-session');
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const WebSocket = require('ws');
const http = require('http');
const sql = require('mssql'); // <-- Importante
const config = require('./dbConfig'); // <-- Importante
const wss = new WebSocket.Server({ port: 8080 });

const app = express();
dotenv.config();

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(session({
    secret: 'segredo-seguro',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 3600000 } // 1 hora
}));

// --- ESTRUTURAS DE DADOS PARA WEBSOCKET ---
const connectedAgents = new Map(); 
// agora vai armazenar objetos:
// { ws, width, height }

const activeViewers = new Map();


// --- MIDDLEWARES ---
function checkAuth(req, res, next) {
    if (req.session.user) {
        return next();
    } else {
        res.redirect('/html/login.html');
    }
}

function checkPermissions(req, res, next) {
    const { permissao } = req.session.user || {};
    if (permissao === 'admin' || permissao === 'coordenador') {
        return next();
    } else {
        res.status(403).send('Acesso negado.');
    }
}

// ----------------------------------------------------------------------
// ROTA PARA INFORMAÇÕES DA SESSÃO
// ----------------------------------------------------------------------
// Rota para obter informações da sessão (tempo restante)
app.get('/session-info', checkAuth, (req, res) => {
    if (req.session.cookie && req.session.cookie.expires) {
        // Calcula o tempo restante em segundos
        const tempoRestante = Math.round((new Date(req.session.cookie.expires).getTime() - Date.now()) / 1000);
        res.json({ tempoRestante: tempoRestante > 0 ? tempoRestante : 0 });
    } else {
        res.status(404).json({ error: 'Sessão não encontrada ou já expirada.' });
    }
});

// ----------------------------------------------------------------------
// ROTAS HTTP/EXPRESS
// ----------------------------------------------------------------------

// Rota para o index
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/index.html'));
});

// Rotas públicas
app.get('/html/login.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/html/login.html'));
});


// Rota para tornar htmltestesdeproducao.html acessível publicamente
app.get('/html/agendamentos.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/html/agendamentos.html'));
});
// Rota para tornar infocomputadores.html acessível publicamente
app.get('/html/infocomputadores.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/html/infocomputadores.html'));
});
/*Rota publica para testes  de producao nao esta totalmente livre ao publico
app.get('/html/htmltestesdeproducao.html',(req, res) =>{
    res.sendFile(path.join(__dirname, 'public/html/htmltestesdeproducao.html'));
});*/
// Rota para tornar agendas-api.html acessível publicamente
app.get('/html/agendas-api.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/html/agendas-api.html'));
});

// Rota protegida para agendasala (acesso a qualquer usuário autenticado)
app.get('/html/agendasala.html', checkAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public/html/agendasala.html'));
});
// Rota protegida para agendasala (acesso a qualquer usuário autenticado)
app.get('/html/dashboardagenda.html', checkAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public/html/dashboardagenda.html'));
});

// Rotas protegidas
const protectedRoutes = [
    'adicionaprogramas.html', 'adicionaunidade.html', 'alteraagenda.html',
    'alteradados.html', 'cadastro.html', 'dashboard.html', 'dashboard-coordenador.html',
    'gerenciarequipamentos.html', 'dashboardagenda.html', 'unidadescurriculares.html',
    'disponibilidade-professores.html', 'controleremoto.html',
    'remote-view.html','htmltestesdeproducao.html'
];
protectedRoutes.forEach(route => {
    app.get(`/html/${route}`, checkAuth, checkPermissions, (req, res) => {
        res.sendFile(path.join(__dirname, `public/html/${route}`));
    });
});

// Servir arquivos estáticos
app.use('/css', express.static(path.join(__dirname, 'public/css')));
app.use('/js', express.static(path.join(__dirname, 'public/js')));
app.use('/imagens', express.static(path.join(__dirname, 'imagens')));


// <<< CORREÇÃO 1: ROTA DE COMANDO ADICIONADA AQUI >>>
// Esta rota precisa ficar aqui porque usa 'connectedAgents'
app.post('/comando-agente/:serial', checkAuth, (req, res) => {
    const serial = req.params.serial;
    const { command } = req.body;

    const agentInfo = connectedAgents.get(serial);

    if (agentInfo && agentInfo.ws && agentInfo.ws.readyState === WebSocket.OPEN) {
        agentInfo.ws.send(command);
        console.log(`Comando '${command}' enviado para Agente ${serial}`);
        res.status(200).send({ message: `Comando enviado com sucesso.` });
    } else {
        res.status(404).send({ error: 'Agente desconectado ou não encontrado.' });
    }
});



// <<< CORREÇÃO 2: A "PONTE" (MIDDLEWARE) FOI ADICIONADA AQUI >>>
// Isto garante que `req.connectedAgents` existirá em todas as rotas
app.use((req, res, next) => {
    req.connectedAgents = connectedAgents;
    next();
});


// <<< CORREÇÃO 3: AGORA USAMOS O ARQUIVO DE ROTAS >>>
// As outras rotas (login, salas, etc.) são carregadas a partir daqui
const routes = require('./routes');
app.use(routes);


// ----------------------------------------------------------------------
// CONFIGURAÇÃO DO SERVIDOR E WEBSOCKET
// ----------------------------------------------------------------------

const PORT = process.env.PORT || 3000;
const server = http.createServer(app);


// ... (O resto do seu código WebSocket continua aqui, está correto)
wss.on('connection', function connection(ws) {
   // console.log('[WS] Nova conexão recebida.');
    ws.agentSerial = null; // Para agentes
    ws.subscribedTo = null; // Para visualizadores

    ws.on('message', function incoming(message) {
        // Se a mensagem for um buffer de dados (imagem), encaminha para os visualizadores
        if (message instanceof Buffer) {
            if (ws.agentSerial) {
                const viewers = activeViewers.get(ws.agentSerial);
                if (viewers && viewers.size > 0) {
                    viewers.forEach(viewerWs => {
                        if (viewerWs.readyState === WebSocket.OPEN) {
                            viewerWs.send(message);
                        }
                    });
                }
            }
            return; // Termina a execução aqui para mensagens binárias
        }

        // Se for uma mensagem de texto (JSON)
        try {
            const data = JSON.parse(message.toString());

            // --- LÓGICA DE REGISTRO E ASSINATURA (SEU CÓDIGO ORIGINAL, ESTÁ CORRETO) ---
            if (data.type === 'register' && data.serial) {

    ws.agentSerial = data.serial;

    connectedAgents.set(data.serial, {
        ws: ws,
        width: data.width || 1920,
        height: data.height || 1080
    });

    console.log(`[WS] Agente registrado: ${data.serial} - Resolução: ${data.width}x${data.height}`);

} else if (data.type === 'subscribe' && data.serial) {

    ws.subscribedTo = data.serial;

    if (!activeViewers.has(data.serial)) {
        activeViewers.set(data.serial, new Set());
    }

    activeViewers.get(data.serial).add(ws);

    // ENVIAR RESOLUÇÃO PARA O FRONT
    const agentInfo = connectedAgents.get(data.serial);

    if (agentInfo && agentInfo.ws.readyState === WebSocket.OPEN) {

        const infoMessage = {
            type: "agent_info",
            width: agentInfo.width,
            height: agentInfo.height
        };

        ws.send(JSON.stringify(infoMessage));

        console.log(`[WS] Enviando resolução ao visualizador: ${agentInfo.width}x${agentInfo.height}`);
    }


            // --- INÍCIO DA CORREÇÃO (LÓGICA QUE FALTAVA) ---
            // Se a mensagem for um comando de controle (mouse/teclado)
            } else if (['mouse_move', 'mouse_down', 'mouse_up', 'key_down', 'key_up'].includes(data.type)) {
                
                // 1. Verifica para qual agente este visualizador está inscrito
                const targetSerial = ws.subscribedTo;

                if (targetSerial) {
                    // 2. Procura o agente correspondente na lista de agentes conectados
                    const targetAgent = connectedAgents.get(targetSerial);

if (targetAgent && targetAgent.ws.readyState === WebSocket.OPEN) {
    targetAgent.ws.send(message); 
}

                }
            // --- FIM DA CORREÇÃO ---
            }

        } catch (e) {
            console.error('[WS] Erro ao processar mensagem de texto:', e.message, 'Mensagem recebida:', message.toString());
        }
    });

    ws.on('close', () => {
        // Se era um agente que desconectou
        if (ws.agentSerial) {
            connectedAgents.delete(ws.agentSerial);
            // Também remove a lista de visualizadores para este agente
            activeViewers.delete(ws.agentSerial);
          //  console.log(`[WS] Agente desconectado: ${ws.agentSerial}. Restantes: ${connectedAgents.size}`);
        
        // Se era um visualizador que desconectou
        } else if (ws.subscribedTo) {
            const viewersSet = activeViewers.get(ws.subscribedTo);
            if (viewersSet) {
                viewersSet.delete(ws);
             //   console.log(`[WS] Um visualizador para ${ws.subscribedTo} se desconectou.`);
            }
        } else {
            // console.log(`[WS] Uma conexão genérica foi fechada.`);
        }
    });
});

// Inicia os dois servidores
server.listen(PORT, () => {
    console.log(`Servidor HTTP (Express) iniciado na porta ${PORT}`);
   // console.log(`Servidor WebSocket (WS) iniciado na porta 8080.`);
});