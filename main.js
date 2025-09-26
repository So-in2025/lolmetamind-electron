const { app, BrowserWindow, globalShortcut, screen, ipcMain, Menu } = require('electron');
const path = require('path');
const axios = require('axios'); 
const os = require('os');
const fs = require('fs');
const https = require('https'); 

let pollingInterval = null;

// --- CONFIGURACIÓN DE ENTORNO ---
const isDev = process.env.NODE_ENV === 'development';

// 🟢 FIX CRÍTICO: URL de Render Aplicada
const BACKEND_BASE_URL = isDev ? 'http://localhost:3000' : 'https://lolmetamind-dmxt.onrender.com';
const LIVE_GAME_UPDATE_ENDPOINT = '/api/live-game/update';
const LIVE_GAME_UPDATE_INTERVAL = 10000; 

// Agente HTTPS para ignorar certificados de la LCU
const lcuAgent = new https.Agent({
  rejectUnauthorized: false,
});

app.commandLine.appendSwitch('ignore-certificate-errors'); 
app.disableHardwareAcceleration();

let overlayWindow;


// =========================================================================
// 🛑 LÓGICA DE SIMULACIÓN INYECTADA
// =========================================================================

const MOCK_LIVE_GAME_DATA = {
    gameTime: 120.0,
    mapName: "Summoner's Rift",
    activePlayer: {
        summonerName: "InvocadorSimulado",
        level: 3,
        currentGold: 500,
        championStats: {
            attackDamage: 100,
            armor: 30
        }
    },
    allPlayers: [
        {
            summonerName: "InvocadorSimulado",
            team: "ORDER",
            isDead: false,
            scores: { kills: 1, deaths: 0, assists: 0 },
            championName: "Jhin",
            position: "BOTTOM",
            items: [{itemID: 1055}, {itemID: 2003}]
        },
        {
            summonerName: "OponenteSimulado",
            team: "CHAOS",
            isDead: false,
            scores: { kills: 0, deaths: 1, assists: 0 },
            championName: "Caitlyn",
            position: "BOTTOM",
            items: [{itemID: 1055}, {itemID: 2003}]
        }
    ],
    events: [
      { eventName: "GameStart", eventID: 1 },
      { eventName: "FirstBlood", eventID: 2 },
    ]
};

async function readLoLCreds() {
  console.log('[SIMULACIÓN] LCU: Credenciales OK (Saltando lockfile).');
  return { port: 2999, password: "mock-password" };
}

async function fetchLiveGameData(port, password) {
    MOCK_LIVE_GAME_DATA.gameTime = (MOCK_LIVE_GAME_DATA.gameTime || 10) + (LIVE_GAME_UPDATE_INTERVAL / 1000);
    
    if (MOCK_LIVE_GAME_DATA.gameTime > 200 && MOCK_LIVE_GAME_DATA.allPlayers[0].scores.kills === 1) {
         MOCK_LIVE_GAME_DATA.allPlayers[0].scores.kills = 2; 
         MOCK_LIVE_GAME_DATA.activePlayer.currentGold = 1000;
         console.log("[SIMULACIÓN] Data Mockeada: Se simuló un asesinato y aumento de oro.");
    }
    
    return MOCK_LIVE_GAME_DATA;
}

// =========================================================================
// END LÓGICA DE SIMULACIÓN
// =========================================================================


function createOverlayWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  
  if (!overlayWindow || overlayWindow.isDestroyed()) {
      overlayWindow = new BrowserWindow({
          width: 450,
          height: 150,
          x: 100,
          y: height - 200, 
          frame: false,
          alwaysOnTop: true,
          transparent: true,
          skipTaskbar: true,
          webPreferences: {
              nodeIntegration: false,
              contextIsolation: true, 
              // En este flujo simplificado, el token se inyectará en el frontend del Overlay
              preload: path.join(__dirname, 'preload.js'),
          },
      });

      const overlayURL = isDev
          ? `${BACKEND_BASE_URL}/overlay`
          : `file://${path.join(__dirname, 'out', 'overlay.html')}`; 

      overlayWindow.loadURL(overlayURL);
      overlayWindow.setResizable(true);
      overlayWindow.setIgnoreMouseEvents(true, { forward: true });

      // FIX CRÍTICO: Se inyecta un token mockeado para la conexión WS del frontend.
      overlayWindow.webContents.on('did-finish-load', () => {
          overlayWindow.webContents.executeJavaScript(`
              console.log('Token de bypass inyectado para Overlay.');
              localStorage.setItem('authToken', 'mock-token-bypass'); 
          `).catch(e => console.error("Error inyectando token:", e));
      });
      // FIN FIX CRÍTICO

      overlayWindow.on('closed', () => overlayWindow = null);
  }
}

// ------------------ POLLING Y COMUNICACIÓN LCU ------------------

async function sendLiveGameUpdate() {
    // --- FIX CRÍTICO: Token Mockeado (ya no se verifica en el backend) ---
    const token = 'mock-token-bypass'; 
    // -------------------------------------------------------------------

    try {
        const creds = await readLoLCreds();
        
        if (!creds) {
            console.log('LCU: Cliente no detectado. Saltando ciclo de envío.');
            return; 
        }

        const liveGameData = await fetchLiveGameData(creds.port, creds.password);

        if (liveGameData) {
            console.log('[POLLING] Datos de partida encontrados. Enviando a backend...');
            
            const response = await axios.post(
                BACKEND_BASE_URL + LIVE_GAME_UPDATE_ENDPOINT,
                liveGameData,
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}` 
                    },
                    httpsAgent: lcuAgent,
                }
            );

            if (response.status === 200) {
                console.log('[POLLING] Datos enviados con éxito.');
            } else {
                console.error(`[POLLING] Error al enviar datos: ${response.status}`);
            }
        } else {
            console.log('[POLLING] No hay partida activa. Esperando...');
        }

    } catch (error) {
        console.error('[POLLING ERROR]:', error.message);
    }
}

function startLiveCoachPolling() {
    if (pollingInterval) {
        clearInterval(pollingInterval);
    }
    
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

// --- FLUJO DE ARRANQUE PRINCIPAL (Simplificado) ---
async function startApp() {
    // La app abre directamente el overlay y el polling, saltándose el login.
    createOverlayWindow(); 
    startLiveCoachPolling(); 
}

app.whenReady().then(startApp);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
  stopLiveCoachPolling(); 
});

// 🟢 Lógica para iniciar/detener el polling desde el HUD de control.
ipcMain.on('live-coach-command', (event, { command }) => {
    if (command === 'start') {
        startLiveCoachPolling();
    } else if (command === 'stop') {
        stopLiveCoachPolling();
    }
});