const { app, BrowserWindow, ipcMain, screen, protocol } = require('electron');
const path = require('path');
const Store = require('electron-store');
const net = require('net');
const WebSocket = require('ws');
const fs = require('fs');

// --- CORRECCIÓN FINAL PARA isDev (no usar electron-is-dev) ---
// isDev será true si NODE_ENV es 'development' (ej. con npm run electron:dev)
// isDev será false si NODE_ENV es 'production' (ej. cuando se empaqueta con electron-builder)
const isDev = process.env.NODE_ENV === 'development';
// --- FIN DE LA CORRECCIÓN ---

// URLs de tus servicios desplegados
const BACKEND_URL = 'https://lolmetamind-dmxt.onrender.com';
const FRONTEND_URL = 'https://lolmetamind-dmxt.onrender.com'; // Asegúrate de que esta es la URL donde tu frontend Next.js está desplegado

// Almacenamiento persistente
const store = new Store();

let licenseWindow;
let overlayWindow;
let wss; // WebSocket Server instance
let wsClient; // WebSocket client connected to the backend
let gameDataInterval;

const createLicenseWindow = () => {
  licenseWindow = new BrowserWindow({
    width: 600,
    height: 400,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
      contextIsolation: false,
    },
    icon: path.join(__dirname, 'assets', 'icon.ico'), // Asegúrate que el icono está en este path
  });

  const licenseHtmlPath = path.join(__dirname, 'static', 'license.html');
  const licenseHtml = fs.readFileSync(licenseHtmlPath, 'utf8');

  // Load the custom HTML directly
  licenseWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(licenseHtml)}`);

  // Opcional: Abre las DevTools para la ventana de licencia
  // licenseWindow.webContents.openDevTools({ mode: 'detach' });

  licenseWindow.on('closed', () => {
    licenseWindow = null;
    if (!overlayWindow) {
      app.quit(); // Si se cierra la ventana de licencia y no hay overlay, cierra la app
    }
  });
};


const createOverlayWindow = () => {
  if (overlayWindow) {
    overlayWindow.show();
    return;
  }

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  overlayWindow = new BrowserWindow({
    width: width,
    height: height,
    x: 0,
    y: 0,
    transparent: true,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      backgroundThrottling: false, // Evita que se ralentice en segundo plano
    },
    icon: path.join(__dirname, 'assets', 'icon.ico'), // Asegúrate que el icono está en este path
  });

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

  // Opcional: Abre las DevTools para la ventana de overlay (¡CRUCIAL para depurar el frontend del overlay!)
  overlayWindow.webContents.openDevTools({ mode: 'detach' });

  overlayWindow.on('closed', () => {
    overlayWindow = null;
    if (gameDataInterval) {
      clearInterval(gameDataInterval);
    }
    if (wsClient) {
      wsClient.close();
    }
    app.quit();
  });

  overlayWindow.setIgnoreMouseEvents(true); // Inicialmente ignorar eventos del ratón
};

app.whenReady().then(() => {
  protocol.registerFileProtocol('file', (request, callback) => {
    const filePath = path.normalize(request.url.substr(7));
    callback({ path: filePath });
  });

  const storedLicenseKey = store.get('licenseKey');
  if (storedLicenseKey) {
    verifyLicense(storedLicenseKey).then(result => {
      if (result.status === 'active') {
        createOverlayWindow();
      } else {
        createLicenseWindow();
      }
    });
  } else {
    createLicenseWindow();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const storedLicenseKey = store.get('licenseKey');
      if (storedLicenseKey) {
        verifyLicense(storedLicenseKey).then(result => {
          if (result.status === 'active') {
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

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// --- LÓGICA DE VERIFICACIÓN ---
async function verifyLicense(key) {
  const VERIFY_BACKEND_URL = BACKEND_URL; // Usamos la misma URL base
  try {
    const response = await fetch(`${VERIFY_BACKEND_URL}/api/license/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ licenseKey: key }),
    });

    if (!response.ok) {
      console.error('Respuesta no exitosa del servidor:', response.status, response.statusText);
      // Intentar leer el cuerpo de error si está disponible
      const errorBody = await response.text();
      return { status: 'invalid', message: `Error del servidor (${response.status}): ${errorBody || response.statusText}` };
    }
    return await response.json();
  } catch (error) {
    console.error('Error al verificar la licencia:', error);
    return { status: 'invalid', message: 'Error de conexión con el servidor. Revisa tu internet.' };
  }
}

ipcMain.on('verify-license', async (event, key) => {
  console.log(`[Electron Main] Recibida clave para verificar: ${key}`);
  const result = await verifyLicense(key);
  console.log('[Electron Main] Resultado de verificación:', result);

  if (result.status === 'active' || result.status === 'trial') {
    store.set('licenseKey', key);
    createOverlayWindow();
    if (licenseWindow) licenseWindow.close();
    // Establecer la conexión WebSocket después de que la licencia sea activa
    setupWebSocketClient();
    setupLiveClientDataPolling();
  } else {
    // Asegurarse de que el mensaje de error se envíe de vuelta a la ventana de licencia
    licenseWindow.webContents.send('license-message', result.message || 'Clave inválida o expirada.');
  }
});

// Función para verificar si el cliente de LoL está ejecutándose
function isLoLClientRunning() {
  return new Promise((resolve) => {
    const client = new net.Socket();
    client.once('error', () => {
      resolve(false);
      client.destroy();
    });
    client.once('connect', () => {
      resolve(true);
      client.end();
    });
    // El cliente de LoL usa el puerto 2999 para su API de datos en vivo
    client.connect(2999, '127.0.0.1');
  });
}

// Configuración del cliente WebSocket
function setupWebSocketClient() {
    if (wsClient && wsClient.readyState === WebSocket.OPEN) {
        console.log('WebSocket client already open.');
        return;
    }

    const wsUrl = BACKEND_URL.replace('https', 'wss'); // Asume que tu WebSocket está en el mismo dominio
    wsClient = new WebSocket(wsUrl);

    wsClient.onopen = () => {
        console.log('Conectado al servidor WebSocket del backend.');
        if (overlayWindow) {
            overlayWindow.webContents.send('websocket-status', { connected: true });
        }
        // Enviar un mensaje inicial o de identificación si es necesario
        // wsClient.send(JSON.stringify({ type: 'client-id', id: app.id }));
    };

    wsClient.onmessage = (event) => {
        const message = JSON.parse(event.data);
        console.log('Mensaje del WebSocket del backend:', message);
        if (overlayWindow) {
            // Envía el mensaje directamente al proceso de renderizado del overlay
            overlayWindow.webContents.send('backend-message', message);
        }
    };

    wsClient.onclose = () => {
        console.log('Desconectado del servidor WebSocket del backend. Intentando reconectar en 5s...');
        if (overlayWindow) {
            overlayWindow.webContents.send('websocket-status', { connected: false });
        }
        setTimeout(setupWebSocketClient, 5000); // Intenta reconectar después de 5 segundos
    };

    wsClient.onerror = (error) => {
        console.error('Error en el WebSocket del backend:', error);
        if (overlayWindow) {
            overlayWindow.webContents.send('websocket-status', { connected: false, error: error.message });
        }
        wsClient.close(); // Forzar cierre para activar onclose y reconexión
    };
}


// Función para obtener datos del juego y enviarlos al backend via WebSocket
async function fetchGameData() {
  const clientRunning = await isLoLClientRunning();
  if (!clientRunning) {
    console.log('LoL client not running, skipping data fetch.');
    if (overlayWindow) overlayWindow.webContents.send('game-status', { running: false });
    return;
  }

  try {
    const res = await fetch('https://127.0.0.1:2999/liveclientdata/allgamedata', { agent: new (require('https').Agent)({ rejectUnauthorized: false }) });
    const data = await res.json();
    console.log('Datos del juego obtenidos:', data);

    if (overlayWindow) overlayWindow.webContents.send('game-status', { running: true, data });

    // Enviar datos al backend a través de WebSocket
    if (wsClient && wsClient.readyState === WebSocket.OPEN) {
      wsClient.send(JSON.stringify({ type: 'live-game-data', payload: data }));
    }

  } catch (error) {
    console.error('Error al obtener datos del juego:', error);
    if (overlayWindow) overlayWindow.webContents.send('game-status', { running: true, error: error.message });
  }
}

// Configura el polling de datos del cliente de LoL
function setupLiveClientDataPolling() {
  if (gameDataInterval) {
    clearInterval(gameDataInterval);
  }
  gameDataInterval = setInterval(fetchGameData, 15000); // Cada 15 segundos
  fetchGameData(); // Ejecutar inmediatamente al inicio
}