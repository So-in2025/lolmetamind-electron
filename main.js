const { app, BrowserWindow, globalShortcut, screen, ipcMain } = require('electron');
const path = require('path');
const axios = require('axios'); 
const { spawn } = require('child_process');
const os = require('os');
const fs = require('fs');
const https = require('https'); 
const { Server } = require('ws'); 
const WebSocket = require('ws'); 
let wsClient; 

let store; 
let pollingInterval = null; // CRÍTICO: Variable para el intervalo de polling

const isDev = process.env.NODE_ENV === 'development';
// Ruta común al lockfile del cliente de Riot
// --- LÍNEAS DE REEMPLAZO EN main.js ---
// Usaremos una lógica de ruta más robusta para Windows y otros sistemas operativos.
/*
const appDataDir = process.env.LOCALAPPDATA || (
    process.platform === 'win32' 
    ? path.join(process.env.USERPROFILE, 'AppData', 'Local') 
    : process.platform === 'darwin' 
    ? path.join(process.env.HOME, 'Library', 'Application Support') 
    : path.join(process.env.HOME, '.config')
);

const LOCKFILE_PATH = path.join(
    appDataDir,
    'Riot Games', 
    'League of Legends', 
    'lockfile'
);*/
// --- FIN DEL REEMPLAZO ESPECÍFICO ---

app.commandLine.appendSwitch('ignore-certificate-errors'); 
app.disableHardwareAcceleration();

let overlayWindow;

const HTTP_BASE_URL = isDev ? 'http://localhost:3000' : 'https://lolmetamind-dmxt.onrender.com'; 
const WS_BASE_URL = isDev ? 'ws://localhost:8080' : 'wss://lolmetamind-ws.onrender.com'; 

const BACKEND_BASE_URL = HTTP_BASE_URL; 
const LIVE_GAME_UPDATE_ENDPOINT = '/api/live-game/update';
const LIVE_GAME_UPDATE_INTERVAL = 10000; // Polling cada 10 segundos

const lcuAgent = new https.Agent({
  rejectUnauthorized: false,
});

// --- FUNCIÓN CRÍTICA: BYPASS DE LOCKFILE CON DATOS HARDCODEADOS ---
function getLcuCredentials() {
    // Datos LCU fijos extraídos de tu sesión: LeagueClient:15628:51088:K4RgXDTDG9iuB8ldMpQ9sQ:https
    const hardcodedPort = 51088;
    const hardcodedPassword = 'K4RgXDTDG9iuB8ldMpQ9sQ';
    
    // El token es la contraseña codificada en Base64 con prefijo "riot:"
    const hardcodedToken = Buffer.from(`riot:${hardcodedPassword}`).toString('base64');
    
    // **ESTO ES CLAVE:** Retornamos los datos directamente sin errores de lectura de archivo.
    return { 
        error: null, 
        port: hardcodedPort, 
        token: hardcodedToken 
    };
}
// --- FIN FUNCIÓN HARDCODEADA ---

// --- FUNCIÓN fetchAndSendLcuData (MUCHO MÁS ROBUSTA) ---
async function fetchAndSendLcuData() {
  const { port, token, error } = getLcuCredentials();

  if (error) {
    console.log(`[LCU POLLING] LCU No detectado. Mensaje: ${error}`);
    return;
  }
  
  const LCU_BASE_URL = `https://127.0.0.1:${port}`;
  const commonHeaders = { 'Authorization': `Basic ${token}`, 'Content-Type': 'application/json' };

  let gameflowData = null;
  let currentSummoner = null;
  let champSelectData = null;
  let liveClientData = null;
  let gameTime = 0;
  let gameStatus = 'None';
  
  try {
    // 1. Obtener la sesión de juego (Fase)
    const gameflowResponse = await axios.get(`${LCU_BASE_URL}/lol/gameflow/v1/session`, { headers: commonHeaders, httpsAgent: lcuAgent });
    gameflowData = gameflowResponse.data;
    gameStatus = gameflowData.phase;
    
    // 2. Obtener el Invocador Actual (Es esencial para el backend)
    const summonerResponse = await axios.get(`${LCU_BASE_URL}/lol/summoner/v1/current-summoner`, { headers: commonHeaders, httpsAgent: lcuAgent });
    currentSummoner = summonerResponse.data;

    // 3. Obtener datos de Champion Select (Si aplica)
    if (gameStatus === 'ChampionSelect') {
        const champSelectResponse = await axios.get(`${LCU_BASE_URL}/lol/champ-select/v1/session`, { headers: commonHeaders, httpsAgent: lcuAgent });
        champSelectData = champSelectResponse.data;
    }

    // 4. LIVE CLIENT DATA API (puerto 2999) - SÓLO si hay partida activa
    if (gameStatus === 'InProgress' || gameStatus === 'InGame' || gameStatus === 'InQueue') {
        const LIVE_CLIENT_API_URL = `https://127.0.0.1:2999/liveclientdata/allgamedata`;
        try {
            const liveDataResponse = await axios.get(LIVE_CLIENT_API_URL, { httpsAgent: lcuAgent });
            liveClientData = liveDataResponse.data;
            gameTime = liveClientData.gameData.gameTime;
        } catch (liveDataError) {
             console.log(`[LCU] Live Data API (2999) no disponible. Fase: ${gameStatus}.`);
        }
    }

    // 5. CONSOLIDAR DATA COMPLETA
    const consolidatedData = { 
        gameflow: gameflowData, 
        currentSummoner: currentSummoner, // Añadido
        champSelect: champSelectData || {}, // Añadido
        liveData: liveClientData || {},
        gameTime: gameTime,
    };
    
    // 6. ENVIAR DATA AL BACKEND (BYPASS DE AUTENTICACIÓN)
    const response = await axios.post(
        `${BACKEND_BASE_URL}${LIVE_GAME_UPDATE_ENDPOINT}`,
        consolidatedData, 
        { headers: { 'Content-Type': 'application/json' }, httpsAgent: lcuAgent }
    );

    if (response.status === 200 || response.status === 204) {
        const logMessage = response.status === 204 ? 'No Content' : `DB Updated, Time: ${gameTime}`;
        console.log(`[LCU] Envío exitoso. Fase: ${gameStatus}. Status: ${logMessage}.`);
    } else {
        console.error(`[LCU] Error al enviar data LCU: ${response.status}`);
    }

  } catch (axiosError) {
    let errorMessage = `Fallo de red al conectar al LCU/Backend: ${axiosError.message}`;
    if (axiosError.response) {
        errorMessage = `Fallo de API LCU (${axiosError.response.status}): ${axiosError.response.statusText}`;
    }
    console.error(`[LCU] Fallo de conexión/API. Error: ${errorMessage}`);
  }
}

function startLiveCoachPolling() {
    if (pollingInterval) clearInterval(pollingInterval); 
    
    sendLiveGameUpdate(); 
    
    pollingInterval = setInterval(sendLiveGameUpdate, LIVE_GAME_UPDATE_INTERVAL);
    console.log(`[LIVE COACH] Polling LCU iniciado. Enviando data cada ${LIVE_GAME_UPDATE_INTERVAL / 1000}s.`);
}

function stopLiveCoachPolling() {
    if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
        console.log('[LIVE COACH] Polling LCU detenido.');
    }
}

// --- LÓGICA DE WEBSOCKET CLIENT (Usa Puerto 10000) ---
function setupWebSocketClient() {
    const token = 'MOCK_TOKEN_LCU_DEMO'; 

    wsClient = new WebSocket(`${WS_BASE_URL}?token=${token}`);

    wsClient.on('open', () => {
        console.log('[WS-CLIENT] Conectado al servidor WebSocket del backend (Puerto 10000).');
    });

    wsClient.on('message', (data) => {
        try {
            const message = JSON.parse(data.toString());
            console.log('[WS-CLIENT] Mensaje recibido del backend. Acción:', message.event); 

            if (overlayWindow) {
                overlayWindow.webContents.send('live-coach-update', message); 
            }
        } catch (error) {
            console.error('[WS-CLIENT] Error al procesar mensaje:', error);
        }
    });

    wsClient.on('close', () => {
        console.log('[WS-CLIENT] Desconectado del servidor WebSocket. Intentando reconectar en 5 segundos...');
        setTimeout(setupWebSocketClient, 5000); 
    });

    wsClient.on('error', (error) => {
        console.error('[WS-CLIENT] Error de WebSocket:', error.message);
    });
}


// --- LÓGICA DE VENTANA Y WEBSOCKET (CON IPC CORREGIDO) ---

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
    : `file://${path.join(__dirname, 'out/overlay.html')}`; 

    if (isDev) {
      overlayWindow.loadURL(urlToLoad);
      // **IMPORTANTE: AÑADIDO PARA DEBUG**
      overlayWindow.webContents.openDevTools(); 
    } else {
      overlayWindow.loadFile(path.join(__dirname, 'out/overlay.html'));
    }
    
    ipcMain.handle('lcu:fetch-game-data', async () => { 
        return await fetchLiveGameData(); 
    });
}

function setupWebSocketClient() {
  wsClient = new WebSocket(WS_BASE_URL);

  wsClient.on('open', () => {
    console.log('[WS-CLIENT] Conectado al servidor WebSocket del backend.');
  });

  wsClient.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      console.log('[WS-CLIENT] Mensaje recibido del backend. Acción:', message.priorityAction); 

      // FIX CRÍTICO DE IPC: Usa un canal fijo y envía el mensaje completo
      if (overlayWindow) {
        overlayWindow.webContents.send('live-coach-update', message); 
      }
    } catch (error) {
      console.error('[WS-CLIENT] Error al procesar mensaje:', error);
    }
  });

  wsClient.on('close', () => {
    console.log('[WS-CLIENT] Desconectado del servidor WebSocket. Intentando reconectar en 5 segundos...');
    setTimeout(setupWebSocketClient, 5000); 
  });

  wsClient.on('error', (error) => {
    console.error('[WS-CLIENT] Error de WebSocket:', error.message);
  });
}

// --- LÓGICA DE ATAJOS Y ARRANQUE ---

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


async function startApp() {
    const { default: Store } = await import('electron-store');
    store = new Store(); 

    createOverlayWindow();
    setupWebSocketClient();
    startLiveCoachPolling(); // CRÍTICO: Inicia el ciclo continuo
    registerGlobalShortcuts();
}


app.whenReady().then(startApp);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
  stopLiveCoachPolling(); 
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});