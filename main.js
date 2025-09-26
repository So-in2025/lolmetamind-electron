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
const LOCKFILE_PATH = path.join(process.env.LOCALAPPDATA || (process.platform == 'darwin' ? process.env.HOME + '/Library/Application Support' : process.platform == 'linux' ? process.env.HOME + '/.config' : process.platform == 'HOME' + '/AppData/Local'), 'Riot Games/League of Legends/lockfile');

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

    if (isDev) {
      overlayWindow.loadURL(urlToLoad);
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

// CÓDIGO CORREGIDO EN main.js
  wsClient.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      // Ahora el log mostrará la acción del consejo (Ej: 'STATUS' o 'ANALYSIS')
      console.log('[WS-CLIENT] Mensaje recibido del backend. Acción:', message.priorityAction); 

      // FIX CRÍTICO: Usamos un canal IPC fijo ('live-coach-update') y enviamos el mensaje completo.
      if (overlayWindow) {
        // La clave 'live-coach-update' es el CANAL IPC
        // 'message' es el objeto COMPLETO del servidor {realtimeAdvice:..., priorityAction:...}
        overlayWindow.webContents.send('live-coach-update', message); 
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
    createOverlayWindow();
    registerGlobalShortcuts();
    setupWebSocketClient();
    fetchLiveGameData(); // Primera llamada inmediata
    getLcuCredentials(); // Verifica credenciales LCU
    
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
