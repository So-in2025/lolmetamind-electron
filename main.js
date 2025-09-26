const { app, BrowserWindow, globalShortcut, screen, ipcMain } = require('electron');
const path = require('path');
const axios = require('axios'); 
const { spawn } = require('child_process');
const os = require('os');
const fs = require('fs');
const https = require('https'); 
const { Server } = require('ws'); // Aseguramos el constructor de WebSocket (aunque no se use aquí, es por contexto)
const WebSocket = require('ws'); // ¡Añade esta línea!
let wsClient; // Y esta, para guardar la conexión

let store; 

const isDev = process.env.NODE_ENV === 'development';
<<<<<<< HEAD
const LOCKFILE_PATH = path.join(process.env.LOCALAPPDATA || (process.platform == 'darwin' ? process.env.HOME + '/Library/Application Support' : process.platform == 'linux' ? process.env.HOME + '/.config' : process.platform == 'HOME' + '/AppData/Local'), 'Riot Games/League of Legends/lockfile');
=======
>>>>>>> ffe8a3dea13c12cbb01d07555ca048862cd7dd13

// 🟢 FIX CRÍTICO: Se añade el flag de certificado SÓLO para la LCU.
// Esta línea es necesaria y debe estar aquí para que el agente HTTPS funcione.
app.commandLine.appendSwitch('ignore-certificate-errors'); 
app.disableHardwareAcceleration();

let overlayWindow;

// URL para la API y la carga inicial de la web de Next.js
const HTTP_BASE_URL = isDev ? 'http://localhost:3000' : 'https://lolmetamind-dmxt.onrender.com'; // <-- URL del Servicio Web

// URL EXCLUSIVA para la conexión en tiempo real del WebSocket
const WS_BASE_URL = isDev ? 'ws://localhost:8080' : 'wss://lolmetamind-ws.onrender.com'; // <-- URL del Servicio WebSocket

// BACKEND_BASE_URL también debe apuntar al servicio web para las peticiones HTTP
const BACKEND_BASE_URL = HTTP_BASE_URL; 
const LIVE_GAME_UPDATE_ENDPOINT = '/api/live-game/update';
const LIVE_GAME_UPDATE_INTERVAL = 10000; 

// Agente HTTPS para ignorar certificados de la LCU (usado en fetch/axios)
const lcuAgent = new https.Agent({
  rejectUnauthorized: false,
});

<<<<<<< HEAD
function getLcuCredentials() {
  try {
    const data = fs.readFileSync(LOCKFILE_PATH, 'utf8');
    const [name, pid, port, password, protocol] = data.split(':');
    if (!port || !password) {
      return { error: 'Lockfile incompleto. El cliente no está ejecutándose.' };
    }
    return { port, token: Buffer.from(`riot:${password}`).toString('base64') };
  } catch (error) {
    if (error.code === 'ENOENT') {
      return { error: 'El lockfile no existe. Asegúrate de que el Cliente de LoL esté abierto.' };
    }
    return { error: `Error al leer lockfile: ${error.message}` };
  }
}

async function fetchLiveGameData() {
  const { port, token, error } = getLcuCredentials();

  if (error) return { error: true, message: error, gameTime: 0 };

  const LIVE_CLIENT_API_URL = `https://127.0.0.1:${port}/liveclientdata/allgamedata`;
  
  try {
    const response = await axios.get(LIVE_CLIENT_API_URL, {
      headers: {
        'Authorization': `Basic ${token}`
      },
      httpsAgent: new https.Agent({ rejectUnauthorized: false })
    });

    if (response.status === 200 && response.data) {
        if (response.data.gameData && response.data.gameData.gameTime !== undefined) {
            return { data: response.data, gameTime: response.data.gameData.gameTime, error: false };
        } else {
             return { error: true, message: 'Partida no iniciada. Esperando tiempo de juego.', gameTime: 0 };
        }
    }

  } catch (axiosError) {
    if (axiosError.response && (axiosError.response.status === 404 || axiosError.code === 'ECONNREFUSED')) {
      return { error: true, message: 'No hay partida activa (LCU API Not Found).', gameTime: 0 };
    }
    return { error: true, message: `Fallo al conectar a LCU: ${axiosError.message}`, gameTime: 0 };
  }
}


=======
// --- FUNCIONES DE CONTROL DE POLLING (AGREGADAS) ---

function startLiveCoachPolling() {
    // Si ya hay un intervalo, lo detenemos para evitar duplicados.
    if (pollingInterval) clearInterval(pollingInterval); 
    
    sendLiveGameUpdate(); // Ejecuta inmediatamente
    
    pollingInterval = setInterval(sendLiveGameUpdate, LIVE_GAME_UPDATE_INTERVAL);
    console.log(`[LIVE COACH] Polling iniciado. Enviando datos cada ${LIVE_GAME_UPDATE_INTERVAL / 1000}s.`);
}

function stopLiveCoachPolling() {
    if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
        console.log('[LIVE COACH] Polling detenido.');
    }
}

>>>>>>> ffe8a3dea13c12cbb01d07555ca048862cd7dd13
function createOverlayWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  overlayWindow = new BrowserWindow({
    width,
    height,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  overlayWindow.setIgnoreMouseEvents(true, { forward: true });

  const urlToLoad = isDev
    ? `${HTTP_BASE_URL}/overlay`
    : `file://${path.join(__dirname, 'out/overlay.html')}`; // Usamos HTTP_BASE_URL para cargar el contenido Next.js

<<<<<<< HEAD
    if (isDev) {
      overlayWindow.loadURL(urlToLoad);
    } else {
      overlayWindow.loadFile(path.join(__dirname, 'out/overlay.html'));
    }
    ipcMain.handle('lcu:fetch-game-data', async () => { 

        return await fetchLiveGameData(); 

    });
=======
  if (isDev) {
    overlayWindow.loadURL(urlToLoad);
  } else {
    overlayWindow.loadFile(path.join(__dirname, 'out/overlay.html'));
  }

>>>>>>> ffe8a3dea13c12cbb01d07555ca048862cd7dd13
}

function setupWebSocketClient() {
  wsClient = new WebSocket(WS_BASE_URL);

  wsClient.on('open', () => {
    console.log('[WS-CLIENT] Conectado al servidor WebSocket del backend.');
  });

  wsClient.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      console.log('[WS-CLIENT] Mensaje recibido del backend:', message.type);

      // El PUENTE: Reenviamos el mensaje a la ventana del overlay
      if (overlayWindow && message.type) {
        overlayWindow.webContents.send(message.type, message.payload);
      }
    } catch (error) {
      console.error('[WS-CLIENT] Error al procesar mensaje:', error);
    }
  });

  wsClient.on('close', () => {
    console.log('[WS-CLIENT] Desconectado del servidor WebSocket. Intentando reconectar en 5 segundos...');
    setTimeout(setupWebSocketClient, 5000); // Intenta reconectar si se cae
  });

  wsClient.on('error', (error) => {
    console.error('[WS-CLIENT] Error de WebSocket:', error.message);
  });
}

<<<<<<< HEAD
=======
// --- LÓGICA DE LIVE COACH: SIMULACIÓN Y FUNCIÓN ---
let pollingInterval = null; 

// DATOS MOCK para el Live Coach
const MOCK_LIVE_GAME_DATA = {
    gameTime: 120.0,
    mapName: "Summoner's Rift",
    activePlayer: { summonerName: "InvocadorSimulado", level: 3, currentGold: 500, championStats: { attackDamage: 100, armor: 30 } },
    allPlayers: [
        { summonerName: "InvocadorSimulado", team: "ORDER", isDead: false, scores: { kills: 1, deaths: 0, assists: 0 }, championName: "Jhin", position: "BOTTOM", items: [{itemID: 1055}, {itemID: 2003}] },
        { summonerName: "OponenteSimulado", team: "CHAOS", isDead: false, scores: { kills: 0, deaths: 1, assists: 0 }, championName: "Caitlyn", position: "BOTTOM", items: [{itemID: 1055}, {itemID: 2003}] }
    ],
    events: [{ eventName: "GameStart", eventID: 1 }, { eventName: "FirstBlood", eventID: 2 }]
};

// Sustituye la función getLCUCredentials()
function getLCUCredentials() {
  console.log('[SIMULACIÓN] LCU: Credenciales OK (Saltando lockfile).');
  return { port: 2999, token: "mock-password" };
}

// Sustituye la función getRealLiveGameData()
async function getRealLiveGameData() {
    const LIVE_GAME_UPDATE_INTERVAL_S = 10;
    
    MOCK_LIVE_GAME_DATA.gameTime = (MOCK_LIVE_GAME_DATA.gameTime || 0) + LIVE_GAME_UPDATE_INTERVAL_S;

    if (MOCK_LIVE_GAME_DATA.gameTime > 200 && MOCK_LIVE_GAME_DATA.allPlayers[0].scores.kills === 1) {
         MOCK_LIVE_GAME_DATA.allPlayers[0].scores.kills = 2; 
         MOCK_LIVE_GAME_DATA.activePlayer.currentGold = 1000;
         console.log("[SIMULACIÓN] Data Mockeada: Se simuló un asesinato y aumento de oro.");
    }
    
    return MOCK_LIVE_GAME_DATA;
}


// --- FUNCIÓN DE ENVÍO Y POLLING (REEMPLAZA sendLiveGameUpdate) ---
async function sendLiveGameUpdate() {
    // FIX: NO usamos token ni lo chequeamos. El backend usa user_id=1
    const token = 'NO_AUTH_REQUIRED'; 

    try {
        const credentials = getLCUCredentials();
        if (!credentials) return; 

        const liveGameData = await getRealLiveGameData(); 

        if (!liveGameData || liveGameData.gameTime < 10) { 
            console.log('[POLLING] No hay partida activa. Esperando...');
            return;
        }

        const response = await axios.post(
            `${BACKEND_BASE_URL}${LIVE_GAME_UPDATE_ENDPOINT}`,
            liveGameData,
            {
                headers: {
                    // Aunque el backend no lo verifica, se envía para consistencia
                    'Authorization': `Bearer ${token}`, 
                    'Content-Type': 'application/json',
                },
                httpsAgent: lcuAgent, 
            }
        );

        if (response.status === 200) {
            console.log(`[LIVE-DATA] Envío exitoso para GameTime: ${liveGameData.gameTime}`);
        } else {
            console.error(`[POLLING] Error al enviar datos: ${response.status}`);
        }
    } catch (error) {
        console.error('[POLLING ERROR]: Error al conectar/enviar al Backend: ', error.message);
    }
}

// FUNCIONES DE CONTROL (AGREGADAS)
function startLiveCoachPolling() {
    if (pollingInterval) clearInterval(pollingInterval);
    
    sendLiveGameUpdate(); 
    
    pollingInterval = setInterval(sendLiveGameUpdate, LIVE_GAME_UPDATE_INTERVAL);
    console.log(`[LIVE COACH] Polling iniciado. Enviando datos cada ${LIVE_GAME_UPDATE_INTERVAL / 1000}s.`);
}

function stopLiveCoachPolling() {
    if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
        console.log('[LIVE COACH] Polling detenido.');
    }
}
>>>>>>> ffe8a3dea13c12cbb01d07555ca048862cd7dd13
// --- LÓGICA DE CONTROL DE ATAJOS ---
function registerGlobalShortcuts() {
    globalShortcut.register('CommandOrControl+F1', () => {
        if (overlayWindow) {
            overlayWindow.setIgnoreMouseEvents(false);
            console.log('Shortcuts: Interacción HABILITADA (CTRL+F1).');
        }
    });

    globalShortcut.register('CommandOrControl+F2', () => {
        if (overlayWindow) {
            overlayWindow.setIgnoreMouseEvents(true, { forward: true }); 
            console.log('Shortcuts: Interacción DESHABILITADA (CTRL+F2).');
        }
    });
}


// --- FUNCIÓN DE ARRANQUE PRINCIPAL (REEMPLAZA startApp y Elimina Licencia) ---
async function startApp() {
    // FIX: Inicializamos Store (aunque no lo usemos, evita errores de require)
    const { default: Store } = await import('electron-store');
    store = new Store(); 

    // 🟢 ARRANQUE DIRECTO Y AUTOMÁTICO
<<<<<<< HEAD
    createOverlayWindow();
    registerGlobalShortcuts();
    setupWebSocketClient();
    fetchLiveGameData(); // Primera llamada inmediata
    getLcuCredentials(); // Verifica credenciales LCU
    
=======
    createOverlayWindow(); 
    setupWebSocketClient();
    startLiveCoachPolling(); 
    registerGlobalShortcuts(); // Activamos los atajos
>>>>>>> ffe8a3dea13c12cbb01d07555ca048862cd7dd13
}


app.whenReady().then(startApp);

// Reemplaza app.on('window-all-closed', ...)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
  stopLiveCoachPolling(); // CRÍTICO: Detiene el polling al cerrar
});

// AÑADIR: Desactivamos todos los atajos al cerrar la aplicación
app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
<<<<<<< HEAD
=======

// UBICACIÓN: ELIMINA el bloque ipcMain.on('verify-license', ...)
// UBICACIÓN: AÑADE el manejador de control de Live Coach
ipcMain.on('live-coach-command', (event, { command }) => {
    if (command === 'start') {
        startLiveCoachPolling();
    } else if (command === 'stop') {
        stopLiveCoachPolling();
    }
});
>>>>>>> ffe8a3dea13c12cbb01d07555ca048862cd7dd13
