// main.js

const { app, BrowserWindow, globalShortcut, screen, ipcMain } = require('electron');
const path = require('path');
const axios = require('axios'); 
const { shell } = require('electron'); 
const Store = require('electron-store'); 
const { fetchAndSendLcuData } = require('./lol-client-api'); 

let wsClient; 
const store = new Store(); 
let pollingInterval = null; 

const isDev = process.env.NODE_ENV === 'development';

app.commandLine.appendSwitch('ignore-certificate-errors'); 
app.disableHardwareAcceleration();

let mainWindow; 
let overlayWindow; 

// 🚨 CORRECCIÓN CRÍTICA DE URL: Usar Render por defecto
const USE_LOCAL_BACKEND = process.env.DEBUG_BACKEND_LOCAL === 'true';

// Si no estamos haciendo debug local, usamos el endpoint de Render (el real).
const HTTP_BASE_URL = USE_LOCAL_BACKEND
    ? 'http://localhost:3000' 
    : 'https://lolmetamind-dmxt.onrender.com'; 

const WS_BASE_URL = USE_LOCAL_BACKEND
    ? 'ws://localhost:8080' 
    : 'wss://lolmetamind-ws.onrender.com'; 

const BACKEND_BASE_URL = HTTP_BASE_URL; 
const LIVE_GAME_UPDATE_ENDPOINT = '/api/live-game/update';
const LIVE_GAME_UPDATE_INTERVAL = 10000;


// --- LÓGICA DE POLLING LCU ---
function startLiveCoachPolling() {
    if (pollingInterval) clearInterval(pollingInterval); 
    fetchAndSendLcuData(BACKEND_BASE_URL, LIVE_GAME_UPDATE_ENDPOINT); 
    pollingInterval = setInterval(() => {
        fetchAndSendLcuData(BACKEND_BASE_URL, LIVE_GAME_UPDATE_ENDPOINT);
    }, LIVE_GAME_UPDATE_INTERVAL);
    console.log(`[LIVE COACH] Polling LCU iniciado.`);
}

function stopLiveCoachPolling() {
    if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
        console.log('[LIVE COACH] Polling LCU detenido.');
    }
}

// --- LÓGICA DE WEBSOCKET CLIENT ---
function setupWebSocketClient() {
    const WS = require('ws'); 
    const token = store.get('userToken') || 'MOCK_TOKEN'; 

    // 🚨 Usa WS_BASE_URL (que ahora apunta a wss://lolmetamind-ws.onrender.com)
    wsClient = new WS(`${WS_BASE_URL}?token=${token}`); 

    wsClient.on('open', () => {
        console.log('[WS-CLIENT] Conectado al servidor WebSocket del backend (Render).');
    });

    wsClient.on('message', (data) => {
        try {
            const message = JSON.parse(data.toString());
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

// --- CONFIGURACIÓN DE IPC (INTER-PROCESS COMMUNICATION) ---
function setupIpcHandlers() {
    // IPC para Persistencia de Sesión
    ipcMain.handle('session:set-state', (event, state) => {
        store.set('authState', state);
        store.set('isAuthenticated', state.isAuthenticated);
        store.set('summonerProfile', state.summonerProfile);
        store.set('userToken', state.userToken || store.get('userToken'));

        if (state.userToken) {
            setupWebSocketClient();
        }
    });
    
    ipcMain.handle('session:get-state', () => {
        return {
            isAuthenticated: store.get('isAuthenticated') || false,
            summonerProfile: store.get('summonerProfile') || null,
            userToken: store.get('userToken') || null,
        };
    });

    // IPC CRÍTICO: Google Auth (Ventana Externa)
    ipcMain.handle('auth:google', async () => {
        // 🚨 LOG: Proceso iniciado
        console.log('[AUTH FLOW] -> Solicitud de inicio de sesión de Google recibida desde el frontend.');
        
        return new Promise((resolve, reject) => {
            const authUrl = `${BACKEND_BASE_URL}/api/auth/google`;
            
            // 🚨 LOG: URL de inicio de sesión
            console.log(`[AUTH FLOW] 🌐 Abriendo ventana de autenticación a: ${authUrl}`);
            
            const authWindow = new BrowserWindow({
                width: 600,
                height: 800,
                show: true,
                webPreferences: { nodeIntegration: false }
            });

            authWindow.loadURL(authUrl);

            authWindow.webContents.on('will-redirect', (event, url) => {
                const urlObj = new URL(url);
                
                // 🚨 LOG: Redirección detectada
                console.log(`[AUTH FLOW] ➡️ Redirección detectada. Hostname: ${urlObj.hostname}`);
                
                // Verificamos si la redirección es la URL final que esperamos (Vercel)
                if (urlObj.pathname === '/auth-callback' || urlObj.hostname === 'couchmetamind.vercel.app') { 
                    event.preventDefault();
                    
                    const token = urlObj.searchParams.get('token');
                    const isNewUser = urlObj.searchParams.get('isNewUser') === 'true';

                    if (token) {
                        // 🚨 LOG: Token interceptado con éxito
                        console.log(`[AUTH FLOW] ✅ Token JWT interceptado. Redirigiendo a Dashboard/Onboarding.`);
                        
                        store.set('isAuthenticated', true);
                        store.set('userToken', token);
                        authWindow.close();
                        
                        resolve({ success: true, isNewUser: isNewUser, userToken: token }); 
                    } else {
                        // 🚨 LOG: Redirección a la URL final, pero sin token
                        console.error('[AUTH FLOW] ❌ Redirección final sin token. Revisar el backend de Render.');
                        authWindow.close();
                        reject(new Error('No se recibió el token de autenticación desde el backend.'));
                    }
                }
            });

            authWindow.on('closed', () => {
                // 🚨 LOG: Ventana cerrada
                console.log('[AUTH FLOW] ℹ️ Ventana de autenticación cerrada (por usuario o por éxito).');
                // Debemos manejar esto solo si no se resolvió antes
            });
        }).catch(error => {
            console.error('[AUTH FLOW] 💥 ERROR DURANTE EL PROCESO DE AUTH:', error.message);
            return { success: false, message: error.message }; 
        });
    });
    
    // IPC para Onboarding (Guardar Perfil)
    ipcMain.handle('config:set-profile', async (event, data) => {
        const token = store.get('userToken');
        
        try {
            // Usa la URL de Render
            const response = await axios.post(`${BACKEND_BASE_URL}/api/user/profile/set`, data, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.status === 200) {
                store.set('summonerProfile', response.data.profileData); 
                return { success: true, profileData: response.data.profileData };
            }

            return { success: false, message: `Error del Backend: ${response.status}` };

        } catch (error) {
            console.error('[ONBOARDING] ❌ Error al procesar perfil:', error.message);
            return { success: false, message: 'Fallo al conectar o procesar el perfil.' };
        }
    });
    
    // IPC para controlar visibilidad del overlay
    ipcMain.on('overlay:set-visibility', (event, visible) => {
        if (overlayWindow) {
            visible ? overlayWindow.show() : overlayWindow.hide();
        }
    });
}


// --- LÓGICA DE VENTANAS ---
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1200, 
    height: 780,
    minWidth: 900,
    minHeight: 600,
    frame: false, // 🚨 CAMBIO 1: Eliminamos el marco del sistema operativo
    transparent: true, // 🚨 CAMBIO 2: Hacemos la ventana transparente
    title: 'LolMetaMind - Coach Estratégico',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  const urlToLoad = `file://${path.join(app.getAppPath(), 'out', 'index.html')}`; 

  mainWindow.loadURL(urlToLoad);
  
  if (isDev) { 
      mainWindow.webContents.openDevTools(); 
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
    show: false, // Inicialmente oculto
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  overlayWindow.setIgnoreMouseEvents(true, { forward: true });

  // CARGA AUTÓNOMA: Usamos el archivo local
  const urlToLoad = `file://${path.join(app.getAppPath(), 'out', 'overlay.html')}`; 

  overlayWindow.loadURL(urlToLoad);
}

// --- LÓGICA DE ARRANQUE ---
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
    setupIpcHandlers();
    createMainWindow();
    createOverlayWindow();
    setupWebSocketClient();
    startLiveCoachPolling(); 
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