const { app, BrowserWindow, globalShortcut, screen, ipcMain } = require('electron');
const path = require('path');
const axios = require('axios'); 
const { spawn } = require('child_process');
const os = require('os');
const fs = require('fs');
const https = require('https'); 
const { Server } = require('ws'); // Aseguramos el constructor de WebSocket (aunque no se use aquí, es por contexto)

let store; 

const isDev = process.env.NODE_ENV === 'development';

// 🟢 FIX CRÍTICO: Se añade el flag de certificado SÓLO para la LCU.
// Esta línea es necesaria y debe estar aquí para que el agente HTTPS funcione.
app.commandLine.appendSwitch('ignore-certificate-errors'); 
app.disableHardwareAcceleration();

let overlayWindow;
let licenseWindow;
let tokenStorage = {}; 

// --- CONFIGURACIÓN CRÍTICA ---
// ⚠️ ¡IMPORTANTE! REEMPLAZA [TU-DOMINIO-REAL].onrender.com con tu URL de Render.
const BACKEND_BASE_URL = isDev ? 'http://localhost:3000' : 'https://lolmetamind-dmxt.onrender.com';
const LIVE_GAME_UPDATE_ENDPOINT = '/api/live-game/update';
const LIVE_GAME_UPDATE_INTERVAL = 10000; 

// Agente HTTPS para ignorar certificados de la LCU (usado en fetch/axios)
const lcuAgent = new https.Agent({
  rejectUnauthorized: false,
});


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
    ? 'http://localhost:3000/overlay'
    : `file://${path.join(__dirname, 'out/overlay.html')}`;

  if (isDev) {
    overlayWindow.loadURL(urlToLoad);
  } else {
    overlayWindow.loadFile(path.join(__dirname, 'out/overlay.html'));
  }

  overlayWindow.webContents.on('did-finish-load', () => {
    setInterval(sendLiveGameUpdate, LIVE_GAME_UPDATE_INTERVAL);
  });
}

function createLicenseWindow() {
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;
    licenseWindow = new BrowserWindow({
      width: 800,
      height: 600,
      center: true,
      frame: true, 
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        preload: path.join(__dirname, 'preload.js'),
      },
    });
    
    const urlToLoad = isDev 
        ? 'http://localhost:3000'
        : `file://${path.join(__dirname, 'out/index.html')}`;

    if (isDev) {
        licenseWindow.loadURL(urlToLoad);
    } else {
        licenseWindow.loadFile(path.join(__dirname, 'out/index.html'));
    }
}

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
// --- LÓGICA DE CONTROL DE ATAJOS ---

function registerGlobalShortcuts() {
    // CTRL+F1: Habilitar interacción con el mouse (para mover/redimensionar)
    globalShortcut.register('CommandOrControl+F1', () => {
        if (overlayWindow) {
            // Deshabilita el ignore: permite mover y redimensionar
            overlayWindow.setIgnoreMouseEvents(false); 
            console.log('Shortcuts: Interacción HABILITADA (CTRL+F1).');
        }
    });

    // CTRL+F2: Deshabilitar interacción con el mouse (para usarlo en el juego)
    globalShortcut.register('CommandOrControl+F2', () => {
        if (overlayWindow) {
            // forward: true asegura que los clics pasen al juego detrás
            overlayWindow.setIgnoreMouseEvents(true, { forward: true }); 
            console.log('Shortcuts: Interacción DESHABILITADA (CTRL+F2). Clics pasan al juego.');
        }
    });
}
// --- FLUJO DE ARRANQUE PRINCIPAL ---
// --- FUNCIÓN DE ARRANQUE FINAL (REEMPLAZA async function startApp()) ---
async function startApp() {
    // FIX: Inicializamos Store (aunque no lo usemos, evita errores de require)
    const { default: Store } = await import('electron-store');
    store = new Store(); 

    // Abrimos directamente el overlay y el polling.
    createOverlayWindow(); 
    startLiveCoachPolling(); 
    registerGlobalShortcuts(); // 🟢 AGREGAMOS EL REGISTRO DE ATAJOS

}
app.whenReady().then(startApp);

// UBICACIÓN: Reemplaza tu app.on('window-all-closed', ...)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
  stopLiveCoachPolling(); 
});

// AÑADIR: Desactivamos todos los atajos al cerrar la aplicación
app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

// UBICACIÓN: ELIMINA el bloque ipcMain.on('verify-license', ...)
// UBICACIÓN: AÑADE el manejador de control de Live Coach
ipcMain.on('live-coach-command', (event, { command }) => {
    if (command === 'start') {
        startLiveCoachPolling();
    } else if (command === 'stop') {
        stopLiveCoachPolling();
    }
});