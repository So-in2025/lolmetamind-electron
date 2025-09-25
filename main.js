const { app, BrowserWindow, globalShortcut, screen, ipcMain } = require('electron');
const path = require('path');
const { io } = require('socket.io-client');
const fetch = require('node-fetch');
const https = require('https'); // Necesario para el agente HTTPS

let store; // Se inicializará de forma asíncrona

// --- CORRECCIÓN DE DETECCIÓN DE ENTORNO ---
const isDev = process.env.NODE_ENV === 'development';

app.commandLine.appendSwitch('ignore-certificate-errors');
app.disableHardwareAcceleration();

let overlayWindow;
let licenseWindow;

// --- FUNCIÓN PARA CREAR LA VENTANA DEL OVERLAY ---
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

  // --- LÓGICA DE WEBSOCKET Y PETICIONES CON TOKEN JWT (CORREGIDO) ---
  const token = store.get('jwtToken');
  if (token) {
    const SOCKET_URL = 'wss://lolmetamind-websockets.onrender.com';
    const socket = io(SOCKET_URL, {
        query: { token }, // Usamos el token para autenticarnos
        transports: ['websocket'],
        reconnectionAttempts: 5
    });

    socket.on('connect', () => overlayWindow.webContents.send('websocket-status', 'Conectado'));
    socket.on('disconnect', () => overlayWindow.webContents.send('websocket-status', 'Desconectado'));
    socket.on('connect_error', (err) => overlayWindow.webContents.send('websocket-status', `Error: ${err.message}`));
    socket.on('game_event', (data) => overlayWindow.webContents.send('new-game-event', data));
  } else {
      console.error("CRÍTICO: No se encontró token para la conexión WebSocket.");
      overlayWindow.webContents.send('websocket-status', 'Error: Sin Token');
  }

  const BACKEND_URL = 'https://lolmetamind-dmxt.onrender.com';
  const RIOT_API_URL = 'https://127.0.0.1:2999/liveclientdata/allgamedata';

  setInterval(async () => {
    try {
      // --- CORRECCIÓN DE CERTIFICADO ---
      const agent = new https.Agent({ rejectUnauthorized: false });
      const response = await fetch(RIOT_API_URL, { agent });
      // --- FIN DE CORRECCIÓN ---

      if (!response.ok) return;
      const gameData = await response.json();
      const activePlayer = gameData.allPlayers.find(p => p.summonerName === gameData.activePlayer.summonerName);
      if (!activePlayer) return;

      const gameState = {
        championName: activePlayer.championName,
        items: activePlayer.items.map(item => item.itemID),
        gameTime: gameData.gameData.gameTime,
      };

      const currentToken = store.get('jwtToken');
      const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${currentToken}` };

      const buildResponse = await fetch(`${BACKEND_URL}/api/builds`, { method: 'POST', headers, body: JSON.stringify(gameState) });
      if(buildResponse.ok) overlayWindow.webContents.send('new-build-advice', await buildResponse.json());

      const strategyResponse = await fetch(`${BACKEND_URL}/api/recommendation`, { method: 'POST', headers, body: JSON.stringify(gameState) });
      if(strategyResponse.ok) overlayWindow.webContents.send('new-strategy-advice', await strategyResponse.json());

    } catch (error) {
      if (error.code !== 'ECONNREFUSED') console.error('Error obteniendo datos del juego:', error.message);
    }
  }, 15000);

  // Atajos de teclado
  globalShortcut.register('CommandOrControl+F1', () => {
    overlayWindow.setIgnoreMouseEvents(false);
    overlayWindow.focus();
    overlayWindow.webContents.send('set-edit-mode', true);
  });
  globalShortcut.register('CommandOrControl+F2', () => {
    overlayWindow.setIgnoreMouseEvents(true, { forward: true });
    overlayWindow.webContents.send('set-edit-mode', false);
  });
  overlayWindow.webContents.on('did-finish-load', () => {
    if (isDev) {
        overlayWindow.webContents.send('set-edit-mode', true);
    }
  });
  if (isDev) {
    overlayWindow.webContents.openDevTools({ mode: 'detach' });
  }
}

// --- FUNCIÓN PARA CREAR LA VENTANA DE LICENCIA (COMPLETA) ---
function createLicenseWindow() {
  licenseWindow = new BrowserWindow({
    width: 500,
    height: 350,
    frame: false,
    transparent: true,
    title: 'Verificación de Licencia - LoL MetaMind',
    resizable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  const licenseHtml = `
    <html>
      <head>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&display=swap');
          body { font-family: 'Roboto', sans-serif; text-align: center; background: rgba(3, 26, 33, 0.9); color: #F0E6D2; margin: 0; padding: 0; overflow: hidden; display: flex; flex-direction: column; justify-content: flex-start; align-items: center; height: 100vh; border: 2px solid #C89B3C; border-radius: 8px; box-shadow: 0 0 15px rgba(200, 155, 60, 0.5); }
          .title-bar { -webkit-app-region: drag; width: 100%; padding: 8px 15px; background-color: #1A283B; color: #C89B3C; text-align: left; font-size: 1.1em; font-weight: bold; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #785A28; border-top-left-radius: 6px; border-top-right-radius: 6px; }
          .title-bar-buttons { -webkit-app-region: no-drag; display: flex; }
          .title-bar-buttons button { background-color: transparent; border: none; color: #F0E6D2; font-size: 1.2em; cursor: pointer; padding: 0 5px; margin-left: 5px; }
          .title-bar-buttons button:hover { color: #E6E6E6; background-color: rgba(255,255,255,0.1); }
          .content-area { -webkit-app-region: no-drag; flex-grow: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; width: 100%; padding: 0 20px; }
          h2 { color: #C89B3C; margin-bottom: 10px; font-size: 1.8em; text-shadow: 1px 1px 3px rgba(0,0,0,0.6); }
          p { margin-bottom: 20px; font-size: 1em; color: #BFBFBF;}
          input { width: 80%; max-width: 350px; padding: 12px; margin-top: 10px; border: 1px solid #785A28; background-color: #091428; color: #F0E6D2; border-radius: 5px; font-size: 1.1em; box-shadow: inset 0 0 5px rgba(0,0,0,0.5); }
          button { margin-top: 20px; padding: 12px 30px; background-color: #0BC6E3; color: #031A21; border: none; cursor: pointer; font-weight: bold; border-radius: 5px; transition: background-color 0.3s ease, transform 0.1s ease; text-transform: uppercase; letter-spacing: 1px; box-shadow: 0 4px 8px rgba(0,0,0,0.4); }
          button:hover { background-color: #07A4BF; transform: translateY(-2px); }
          #message { margin-top: 15px; color: #FF4D4D; font-weight: bold; font-size: 1.1em; }
        </style>
      </head>
      <body>
        <div class="title-bar"><span>LoL MetaMind - Licencia</span><div class="title-bar-buttons"><button onclick="require('electron').ipcRenderer.send('window-control', 'minimize')">-</button><button onclick="require('electron').ipcRenderer.send('window-control', 'close')">x</button></div></div>
        <div class="content-area">
          <h2>Introduce tu Clave de Licencia</h2>
          <p>Puedes encontrar tu clave en tu perfil en el sitio web de LoL MetaMind.</p>
          <input type="text" id="licenseKey" placeholder="Pega tu clave aquí..."/>
          <button id="verifyBtn">Verificar</button>
          <p id="message"></p>
        </div>
        <script>
          const { ipcRenderer } = require('electron');
          document.getElementById('verifyBtn').addEventListener('click', () => {
            const key = document.getElementById('licenseKey').value;
            ipcRenderer.send('verify-license', key);
          });
          ipcRenderer.on('license-message', (event, message) => {
            document.getElementById('message').innerText = message;
          });
        </script>
      </body>
    </html>
  `;
  licenseWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(licenseHtml)}`);
}

// --- LÓGICA DE VERIFICACIÓN (SIN CAMBIOS) ---
async function verifyLicense(key) {
  const BACKEND_URL = 'https://lolmetamind-dmxt.onrender.com';
  try {
    const response = await fetch(`${BACKEND_URL}/api/license/verify`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ licenseKey: key }) });
    return await response.json();
  } catch (error) {
    console.error('Error al verificar la licencia:', error);
    return { status: 'invalid', message: 'Error de conexión con el servidor.' };
  }
}

// --- FLUJO DE ARRANQUE PRINCIPAL (CORREGIDO) ---
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

// --- IPC DE VERIFICACIÓN (CORREGIDO) ---
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

// --- LISTENERS FINALES (SIN CAMBIOS) ---
ipcMain.on('window-control', (event, action) => {
  if (licenseWindow) {
    if (action === 'minimize') {
      licenseWindow.minimize();
    } else if (action === 'close') {
      licenseWindow.close();
    }
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
