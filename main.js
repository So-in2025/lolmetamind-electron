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


// --- FUNCIÓN PARA OBTENER DATOS DE LA LCU API ---
function getLCUCredentials() {
    try {
        // La ubicación del lockfile es específica de Windows/Instalación predeterminada.
        // Si el usuario usa otra plataforma, esto debe ser ajustado (ej. Mac/Linux).
        const lockFilePath = path.join(os.homedir(), 'AppData', 'Local', 'Riot Games', 'League of Legends', 'lockfile');
        
        if (!fs.existsSync(lockFilePath)) {
            return null; 
        }

        const lockFileContent = fs.readFileSync(lockFilePath, 'utf-8');
        // Formato del lockfile: processName:pid:port:password:protocol
        const parts = lockFileContent.split(':');
        
        if (parts.length < 4) return null;
        
        return { 
            port: parts[2], 
            token: parts[3] 
        };

    } catch (e) {
        // console.error("Error al leer credenciales de LCU:", e.message);
        return null;
    }
}

async function getRealLiveGameData() {
    const credentials = getLCUCredentials();
    if (!credentials) return null;

    try {
        const { port, token } = credentials;
        const lcuUrl = `https://127.0.0.1:${port}/liveclientdata/allgamedata`;
        
        const authHeader = 'Basic ' + Buffer.from(`riot:${token}`).toString('base64');
        
        const response = await fetch(lcuUrl, {
            agent: lcuAgent, // Usamos el agente que ignora el certificado
            headers: {
                'Authorization': authHeader,
            }
        });

        if (!response.ok) {
            // Si no hay partida, la LCU devuelve 404/403.
            return null;
        }

        const data = await response.json();
        return data; 

    } catch (e) {
        // Si falla la conexión (el juego no está activo o la ruta es incorrecta)
        return null;
    }
}


// --- FUNCIÓN PARA ENVIAR DATOS AL SERVIDOR WEB ---
async function sendLiveGameUpdate() {
    const token = store.get('jwtToken');
    if (!token) return;
    
    // 🟢 LECTURA REAL DE DATOS
    const liveGameData = await getRealLiveGameData(); 

    if (!liveGameData || liveGameData.gameTime < 10) { 
        return;
    }

    try {
        await axios.post(
            `${BACKEND_BASE_URL}${LIVE_GAME_UPDATE_ENDPOINT}`,
            liveGameData,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            }
        );
        console.log(`[LIVE-DATA] Envío exitoso para GameTime: ${liveGameData.gameTime}`);
    } catch (error) {
        if (error.response && (error.response.status === 401 || error.response.status === 403)) {
             console.error('[LIVE-DATA] Token de sesión expirado.');
             store.delete('jwtToken');
        }
        // console.error(`[LIVE-DATA] Fallo al enviar a ${BACKEND_BASE_URL}:`, error.message);
    }
}

// --- VERIFICACIÓN DE LICENCIA ---
async function verifyLicense(key) {
    try {
        const response = await axios.post(
            `${BACKEND_BASE_URL}/api/license/verify`,
            { key },
            { headers: { 'Content-Type': 'application/json' } }
        );
        return response.data;
    } catch (error) {
        return { status: 'error', message: error.response?.data?.error || 'Error de conexión con el servidor.' };
    }
}

// --- FLUJO DE ARRANQUE PRINCIPAL ---
async function startApp() {
  const { default: Store } = await import('electron-store');
  store = new Store();

  const licenseKey = store.get('licenseKey');
  const token = store.get('jwtToken');

  if (licenseKey && token) {
    createOverlayWindow();
  } else {
    store.delete('licenseKey');
    store.delete('jwtToken');
    createLicenseWindow();
  }
}

app.whenReady().then(startApp);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// --- IPC DE VERIFICACIÓN ---
ipcMain.on('verify-license', async (event, key) => {
  const result = await verifyLicense(key);

  if ((result.status === 'active' || result.status === 'trial') && result.token) {
    store.set('licenseKey', key);
    store.set('jwtToken', result.token);
    createOverlayWindow();
    if (licenseWindow) licenseWindow.close();
  } else {
    const errorMessage = result.token ? result.message : 'Error: El servidor no devolvió un token de sesión.';
    if (licenseWindow && !licenseWindow.isDestroyed()) {
        licenseWindow.webContents.send('license-message', errorMessage || 'Clave inválida.');
    }
  }
});

ipcMain.on('window-control', (event, action) => {
  if (licenseWindow) {
    if (action === 'minimize') {
      licenseWindow.minimize();
    } else if (action === 'close') {
      licenseWindow.close();
    }
  }
});