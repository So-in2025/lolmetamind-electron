const { app, BrowserWindow, globalShortcut, screen, ipcMain } = require('electron');
const path = require('path');
const { io } = require('socket.io-client');
const fetch = require('node-fetch');

let store; 
const isDev = process.env.NODE_ENV !== 'production';

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

  // Lógica de WebSocket y peticiones
  const SOCKET_URL = 'wss://lolmetamind.onrender.com';
  const BACKEND_URL = 'https://lolmetamind.onrender.com';
  const RIOT_API_URL = 'https://127.0.0.1:2999/liveclientdata/allgamedata';

  const socket = io(SOCKET_URL, { transports: ['websocket'], reconnectionAttempts: 5 });
  socket.on('connect', () => overlayWindow.webContents.send('websocket-status', 'Conectado'));
  socket.on('disconnect', () => overlayWindow.webContents.send('websocket-status', 'Desconectado'));
  socket.on('game_event', (data) => overlayWindow.webContents.send('new-game-event', data));

  setInterval(async () => {
    try {
      const response = await fetch(RIOT_API_URL);
      if (!response.ok) return;
      const gameData = await response.json();
      const activePlayer = gameData.allPlayers.find(p => p.summonerName === gameData.activePlayer.summonerName);
      if (!activePlayer) return;
      
      const gameState = {
        championName: activePlayer.championName,
        items: activePlayer.items.map(item => item.itemID),
        gameTime: gameData.gameData.gameTime,
      };

      const buildResponse = await fetch(`${BACKEND_URL}/api/builds`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ championName: gameState.championName, items: gameState.items }) });
      if(buildResponse.ok) overlayWindow.webContents.send('new-build-advice', await buildResponse.json());

      const strategyResponse = await fetch(`${BACKEND_URL}/api/recommendation`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(gameState) });
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

// --- FUNCIÓN PARA CREAR LA VENTANA DE LICENCIA ---
function createLicenseWindow() {
  licenseWindow = new BrowserWindow({
    width: 500,  // Aumentado el ancho
    height: 350, // Aumentada la altura
    frame: false, // ¡Sin marco del sistema!
    transparent: true, // Fondo transparente para nuestro estilo LOL
    title: 'Verificación de Licencia - LoL MetaMind',
    resizable: false,
    webPreferences: {
      nodeIntegration: true, 
      contextIsolation: false, 
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // HTML embebido para la ventana de licencia con estilo LOL
  const licenseHtml = `
    <html>
      <head>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&display=swap'); /* Fuente similar a la de LoL */
          body { 
            font-family: 'Roboto', sans-serif; 
            text-align: center; 
            background: rgba(3, 26, 33, 0.9); /* Fondo oscuro transparente */
            color: #F0E6D2; /* Blanco roto */
            margin: 0;
            padding: 0;
            overflow: hidden; /* Evitar barras de desplazamiento */
            display: flex; 
            flex-direction: column; 
            justify-content: flex-start; /* Ajuste para la barra de título */
            align-items: center; 
            height: 100vh;
            border: 2px solid #C89B3C; /* Borde dorado */
            border-radius: 8px; /* Bordes ligeramente redondeados */
            box-shadow: 0 0 15px rgba(200, 155, 60, 0.5); /* Sombra dorada */
          }
          .title-bar {
            -webkit-app-region: drag; /* Permite arrastrar la ventana */
            width: 100%;
            padding: 8px 15px;
            background-color: #1A283B; /* Color oscuro para la barra de título */
            color: #C89B3C;
            text-align: left;
            font-size: 1.1em;
            font-weight: bold;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid #785A28;
            border-top-left-radius: 6px; /* Para que coincida con el borde del body */
            border-top-right-radius: 6px;
          }
          .title-bar-buttons {
            -webkit-app-region: no-drag; /* Los botones no arrastran la ventana */
            display: flex;
          }
          .title-bar-buttons button {
            background-color: transparent;
            border: none;
            color: #F0E6D2;
            font-size: 1.2em;
            cursor: pointer;
            padding: 0 5px;
            margin-left: 5px;
          }
          .title-bar-buttons button:hover {
            color: #E6E6E6;
            background-color: rgba(255,255,255,0.1);
          }
          .content-area {
            -webkit-app-region: no-drag; /* El contenido no arrastra la ventana */
            flex-grow: 1; /* Permite que el contenido ocupe el espacio restante */
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            width: 100%;
            padding: 0 20px;
          }
          h2 { color: #C89B3C; margin-bottom: 10px; font-size: 1.8em; text-shadow: 1px 1px 3px rgba(0,0,0,0.6); }
          p { margin-bottom: 20px; font-size: 1em; color: #BFBFBF;}
          input { 
            width: 80%; max-width: 350px; padding: 12px; margin-top: 10px; 
            border: 1px solid #785A28; background-color: #091428; 
            color: #F0E6D2; border-radius: 5px; font-size: 1.1em;
            box-shadow: inset 0 0 5px rgba(0,0,0,0.5);
          }
          button { 
            margin-top: 20px; padding: 12px 30px; background-color: #0BC6E3; 
            color: #031A21; border: none; cursor: pointer; font-weight: bold; 
            border-radius: 5px; transition: background-color 0.3s ease, transform 0.1s ease;
            text-transform: uppercase; letter-spacing: 1px;
            box-shadow: 0 4px 8px rgba(0,0,0,0.4);
          }
          button:hover { background-color: #07A4BF; transform: translateY(-2px); }
          button:active { transform: translateY(0); }
          #message { margin-top: 15px; color: #FF4D4D; font-weight: bold; font-size: 1.1em; }
        </style>
      </head>
      <body>
        <div class="title-bar">
          <span>LoL MetaMind - Licencia</span>
          <div class="title-bar-buttons">
            <button onclick="require('electron').ipcRenderer.send('window-control', 'minimize')">-</button>
            <button onclick="require('electron').ipcRenderer.send('window-control', 'close')">x</button>
          </div>
        </div>
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

// --- LÓGICA DE VERIFICACIÓN ---
async function verifyLicense(key) {
  const BACKEND_URL = 'https://lolmetamind.onrender.com';
  try {
    const response = await fetch(`${BACKEND_URL}/api/license/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ licenseKey: key }),
    });
    return await response.json();
  } catch (error) {
    console.error('Error al verificar la licencia:', error);
    return { status: 'invalid', message: 'Error de conexión con el servidor. Revisa tu internet.' };
  }
}

// --- FLUJO DE ARRANQUE PRINCIPAL ---
async function startApp() {
  const { default: Store } = await import('electron-store');
  store = new Store();

  const licenseKey = store.get('licenseKey');
  if (licenseKey) {
    const result = await verifyLicense(licenseKey);
    if (result.status === 'active') {
      createOverlayWindow();
    } else {
      store.delete('licenseKey');
      createLicenseWindow();
    }
  } else {
    createLicenseWindow();
  }
}

app.whenReady().then(startApp);

ipcMain.on('verify-license', async (event, key) => {
  const result = await verifyLicense(key);
  if (result.status === 'active') {
    store.set('licenseKey', key);
    createOverlayWindow();
    if (licenseWindow) licenseWindow.close();
  } else {
    licenseWindow.webContents.send('license-message', result.message || 'Clave inválida o expirada.');
  }
});

// Listener para los botones de la barra de título personalizada
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