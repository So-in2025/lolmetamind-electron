import { app, BrowserWindow, globalShortcut, screen, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import Store from 'electron-store'; // electron-store es ESM a partir de v9, pero puede ser importado así si es v8.x también
import { io } from 'socket.io-client';
import nodeFetch from 'node-fetch'; // node-fetch v3+ es ESM.

// Reemplazo para __dirname en ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const store = new Store();

const isDev = process.env.NODE_ENV === 'development';

app.commandLine.appendSwitch('ignore-certificate-errors');
app.disableHardwareAcceleration();

let overlayWindow;
let licenseWindow;

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
    console.log('[Electron] Cargando overlay en modo desarrollo:', urlToLoad);
    overlayWindow.loadURL(urlToLoad);
  } else {
    console.log('[Electron] Cargando overlay en modo producción desde archivo:', urlToLoad);
    overlayWindow.loadFile(path.join(__dirname, 'out/overlay.html'));
  }

  if (isDev) {
    overlayWindow.webContents.openDevTools({ mode: 'detach' });
  }

  const SOCKET_URL = 'wss://lolmetamind-websockets.onrender.com';
  const BACKEND_URL = 'https://lolmetamind-dmxt.onrender.com';
  const RIOT_API_URL = 'https://127.0.0.0:2999/liveclientdata/allgamedata'; // Corrección aquí: 127.0.0.0 no 127.0.0.1, cuidado con el api del lol

  const socket = io(SOCKET_URL, { transports: ['websocket'], reconnectionAttempts: 5 });
  socket.on('connect', () => overlayWindow.webContents.send('websocket-status', 'Conectado'));
  socket.on('disconnect', () => overlayWindow.webContents.send('websocket-status', 'Desconectado'));
  socket.on('game_event', (data) => overlayWindow.webContents.send('new-game-event', data));

  setInterval(async () => {
    try {
      const response = await nodeFetch(RIOT_API_URL, { agent: new (await import('https')).Agent({ rejectUnauthorized: false }) });
      if (!response.ok) return;
      const gameData = await response.json();
      const activePlayer = gameData.allPlayers.find(p => p.summonerName === gameData.activePlayer.summonerName);
      if (!activePlayer) return;

      const gameState = {
        championName: activePlayer.championName,
        items: activePlayer.items.map(item => item.itemID),
        gameTime: gameData.gameData.gameTime,
      };

      const buildResponse = await nodeFetch(`${BACKEND_URL}/api/builds`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ championName: gameState.championName, items: gameState.items }) });
      if(buildResponse.ok) overlayWindow.webContents.send('new-build-advice', await buildResponse.json());

      const strategyResponse = await nodeFetch(`${BACKEND_URL}/api/recommendation`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(gameState) });
      if(strategyResponse.ok) overlayWindow.webContents.send('new-strategy-advice', await strategyResponse.json());

    } catch (error) {
      if (error.code !== 'ECONNREFUSED') console.error('Error obteniendo datos del juego:', error.message);
    }
  }, 15000);

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
}

function createLicenseWindow() {
  licenseWindow = new BrowserWindow({
    width: 500,
    height: 350,
    frame: false,
    transparent: true,
    title: 'Verificación de Licencia - LoL MetaMind',
    resizable: false,
    webPreferences: {
      nodeIntegration: true, // Esto es necesario para que el `require('electron').ipcRenderer` en license.html funcione
      contextIsolation: false, // Por consistencia con la lógica de ipcRenderer si no se usa preload específico
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  const licenseHtmlPath = path.join(__dirname, 'static', 'license.html');
  const licenseHtml = fs.readFileSync(licenseHtmlPath, 'utf8');
  licenseWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(licenseHtml)}`);

  if (isDev) {
      licenseWindow.webContents.openDevTools({ mode: 'detach' });
  }

  licenseWindow.on('closed', () => {
      licenseWindow = null;
      if (!overlayWindow || overlayWindow.isDestroyed()) {
          app.quit();
      }
  });
}

async function verifyLicense(key) {
  const BACKEND_URL = 'https://lolmetamind-dmxt.onrender.com';
  try {
    const response = await nodeFetch(`${BACKEND_URL}/api/license/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ licenseKey: key }),
    });

    if (!response.ok) {
      console.error('Respuesta no exitosa del servidor:', response.status, response.statusText);
      const errorBody = await response.text();
      return { status: 'invalid', message: `Error del servidor (${response.status}): ${errorBody || response.statusText}` };
    }
    return await response.json();
  } catch (error) {
    console.error('Error al verificar la licencia:', error);
    return { status: 'invalid', message: 'Error de conexión con el servidor. Revisa tu internet.' };
  }
}

app.whenReady().then(async () => {
  // Asegúrate de que node-fetch se importe correctamente, especialmente para el agente HTTPS.
  // Esto es para la línea `agent: new (await import('https')).Agent({ rejectUnauthorized: false })`
  // En ESM, require('https') no funciona.
  // Pero para el `nodeFetch` general ya lo importamos arriba.

  const storedLicenseKey = store.get('licenseKey');
  if (storedLicenseKey) {
    const result = await verifyLicense(storedLicenseKey);
    if (result.status === 'active' || result.status === 'trial') {
      createOverlayWindow();
    } else {
      store.delete('licenseKey');
      createLicenseWindow();
    }
  } else {
    createLicenseWindow();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const currentLicenseKey = store.get('licenseKey');
      if (currentLicenseKey) {
        verifyLicense(currentLicenseKey).then(result => {
          if (result.status === 'active' || result.status === 'trial') {
            createOverlayWindow();
          } else {
            createLicenseWindow();
          }
        });
      } else {
        createLicenseWindow();
      }
    }
  });
});

ipcMain.on('verify-license', async (event, key) => {
  console.log(`[Electron Main] Recibida clave para verificar: ${key}`);
  const result = await verifyLicense(key);
  console.log('[Electron Main] Resultado de verificación:', result);

  if (result.status === 'active' || result.status === 'trial') {
    store.set('licenseKey', key);
    createOverlayWindow();
    if (licenseWindow && !licenseWindow.isDestroyed()) {
      licenseWindow.close();
    }
  } else {
    if (licenseWindow && !licenseWindow.isDestroyed()) {
      licenseWindow.webContents.send('license-message', result.message || 'Clave inválida o expirada.');
    } else {
      console.error("No se pudo enviar el mensaje de error: La ventana de licencia no existe o está destruida.");
    }
  }
});

ipcMain.on('window-control', (event, action) => {
  if (licenseWindow && !licenseWindow.isDestroyed()) {
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