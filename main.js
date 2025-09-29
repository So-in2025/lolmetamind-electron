// main.js - VERSIÓN CORREGIDA

const { app, BrowserWindow, globalShortcut, screen, ipcMain, session } = require('electron');
const path = require('path');
const axios = require('axios');
const { shell } = require('electron');
const Store = require('electron-store');
const https = require('https');
const { fetchAndSendLcuData } = require('./lol-client-api');
const WebSocket = require('ws'); 

let wsClient; 
const store = new Store();
let pollingInterval = null;
let hasRunInitialLogin = false;

const isDevMode = !!process.defaultApp;

app.commandLine.appendSwitch('ignore-certificate-errors');
app.disableHardwareAcceleration();

let mainWindow;
let splashWindow;
let overlayWindow;

const USE_LOCAL_BACKEND = true;
const HTTP_BASE_API_URL = 'http://localhost:3000';
const WS_BASE_URL = 'ws://localhost:8080';
const BACKEND_BASE_URL = HTTP_BASE_API_URL;

const LIVE_GAME_UPDATE_ENDPOINT = '/api/live-game/update';
const USER_PROFILE_ENDPOINT = '/api/user/profile';

const INDEX_PATH = isDevMode ? 'http://localhost:3001' : `file://${path.join(__dirname, 'out', 'index.html')}`;
const OVERLAY_PATH = isDevMode ? 'http://localhost:3001/overlay' : `file://${path.join(__dirname, 'out', 'overlay.html')}`;

const backendAgent = new https.Agent({ rejectUnauthorized: false });

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Envía datos de polling (ej. LCU/Riot API) al proceso de renderizado (frontend).
 * @param {object} data - Los datos a enviar.
 */
function sendPollingDataToRenderer(data) {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('riot-profile-data', data);
    }
}

/**
 * 🔑 Obtiene el perfil completo del usuario (Invocador, Tagline, Región) desde la DB.
 * Persiste los datos en electron-store.
 * @param {string} username - Nombre de usuario para buscar.
 * @param {string} token - Token de autenticación del usuario.
 * @returns {Promise<boolean>} - Verdadero si el perfil se obtuvo y guardó con éxito.
 */
async function fetchAndStoreUserProfile(username, token) {
    if (!token || typeof token !== 'string' || token.length < 10) {
        console.error('[DB FETCH] ❌ Falla Crítica: Token inválido o no recibido. Saltando fetch.');
        return false;
    }

    const MAX_ATTEMPTS = 2;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        console.log(`[DB FETCH] 💾 Intentando obtener perfil (Intento ${attempt}/${MAX_ATTEMPTS})...`);
        try {
            const response = await axios.get(`${BACKEND_BASE_URL}${USER_PROFILE_ENDPOINT}`, {
                headers: { 'Authorization': `Bearer ${token}` },
                params: { username: username },
                httpsAgent: backendAgent,
                timeout: 20000
            });

            if (response.status === 200 && response.data) {
                // 🔴 CORRECCIÓN 1: Guardar explícitamente los campos críticos (SummonerName, Región, Tagline) 
                // para que lol-client-api.js pueda acceder a ellos directamente.
                store.set('userData', response.data);
                store.set('userSummonerName', response.data.summonerName);
                store.set('userRegion', response.data.region);
                store.set('userTagline', response.data.tagline); 
                
                console.log(`[DB FETCH] ✅ Perfil completo guardado para: ${response.data.summonerName}.`);
                console.log('[DB FETCH] Datos de usuario guardados:', JSON.stringify(response.data, null, 2));
                return true; // Éxito
            } else if (response.status === 404 || response.data?.message?.includes('incompleto')) {
                console.warn(`[DB FETCH] ⚠️ Perfil incompleto o no encontrado en la DB. Falla permanente.`);
                return false;
            }
        } catch (error) {
            console.error(`[DB FETCH] ❌ Fallo (Intento ${attempt}): ${error.message}`);
            if (attempt < MAX_ATTEMPTS) {
                console.log(`[DB FETCH] Esperando 1.5s antes de reintentar...`);
                await delay(1500);
            } else {
                console.error(`[DB FETCH] ❌ Fallo definitivo tras ${MAX_ATTEMPTS} intentos.`);
            }
        }
    }
    return false; // Fallo total
}

function createSplashWindow() {
    splashWindow = new BrowserWindow({
        width: 400,
        height: 400,
        transparent: true,
        frame: false,
        alwaysOnTop: true,
        center: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
        },
    });
    splashWindow.loadURL(`file://${path.join(__dirname, 'splash.html')}`);
    splashWindow.on('closed', () => (splashWindow = null));
}

function createMainWindow() {
    mainWindow = new BrowserWindow({
        width: 1920,
        height: 1080,
        minWidth: 1920,
        minHeight: 1080,
        show: false,
        frame: false,
        transparent: true,
        backgroundColor: '#00000000',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
        },
    });

    mainWindow.loadURL(INDEX_PATH);

    mainWindow.once('ready-to-show', () => {
        setTimeout(() => {
            if (splashWindow) {
                splashWindow.close();
            }
            mainWindow.show();
            mainWindow.center();
        }, 3000);
    });
    
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
    if (isDevMode) {
       // mainWindow.webContents.openDevTools();
    }
}

function createOverlayWindow() {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;

    overlayWindow = new BrowserWindow({
        width: width,
        height: height,
        x: 0,
        y: 0,
        transparent: true,
        frame: false,
        focusable: false,
        alwaysOnTop: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
        },
    });

    overlayWindow.loadURL(OVERLAY_PATH);
    overlayWindow.setIgnoreMouseEvents(true); 
    overlayWindow.hide();

    overlayWindow.on('closed', () => (overlayWindow = null));
}

function setupWebSocketClient() {
    if (wsClient) {
        wsClient.close();
    }
    wsClient = new WebSocket(WS_BASE_URL);

    wsClient.onopen = () => console.log('[WS] Conectado al servidor WebSocket');
    wsClient.onmessage = (event) => {
        console.log('[WS] Mensaje recibido:', event.data);
    };
    wsClient.onerror = (error) => console.error('[WS] Error WebSocket:', error);
    wsClient.onclose = () => console.log('[WS] Conexión WebSocket cerrada');
}


/**
 * Inicia el polling para datos de LCU y Riot API.
 */
function startLiveGamePolling() {
    if (pollingInterval) clearInterval(pollingInterval);
    pollingInterval = setInterval(async () => {
        console.log('[LCU POLLING] 🏃‍♀️ Ejecutando rutina de Polling...');
        
        // 🔴 CORRECCIÓN 2: Pasar la función de envío IPC (sendPollingDataToRenderer)
        // para que lol-client-api.js pueda enviar los datos de Riot API al frontend.
        await fetchAndSendLcuData(
            BACKEND_BASE_URL, 
            LIVE_GAME_UPDATE_ENDPOINT, 
            sendPollingDataToRenderer // Argumento corregido (el tercer argumento ahora es el ipcSender)
        );
        
    }, 15000); // Cada 15 segundos
    console.log('[LCU POLLING] 🟢 LCU Polling Iniciado.');
}

function stopLiveGamePolling() {
    if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
        console.log('[LCU POLLING] 🛑 LCU Polling Detenido.');
    }
}

// =========================================================================
// MANEJO DE EVENTOS IPC (Inter-Process Communication)
// =========================================================================

app.on('ready', () => {
    console.log('[MAIN] -> APP READY. Creando ventanas y registrando IPC...');

    ipcMain.on('closeWindow', () => {
        app.quit();
    });
    ipcMain.on('minimizeWindow', () => {
        mainWindow?.minimize();
    });

    ipcMain.on('user-logged-in', async (event, userData) => {
        if (hasRunInitialLogin) {
            console.warn(`[IPC RECEPCIÓN] ⚠️ Evento de login duplicado para ${userData.username} ignorado.`);
            return;
        }
        hasRunInitialLogin = true; 

        console.log(`[IPC RECEPCIÓN] ✅ EVENTO RECIBIDO. Usuario: ${userData.username}. INICIANDO PROCESOS POST-LOGIN.`);

        store.set('userToken', userData.token);
        console.log('[IPC RECEPCIÓN] Token de usuario guardado en el store.');

        const profileFetchSuccess = await fetchAndStoreUserProfile(userData.username, userData.token);

        if (profileFetchSuccess) {
            startLiveGamePolling();
        } else {
            console.error('[IPC RECEPCIÓN] ⚠️ No se pudo obtener el perfil del usuario. No se iniciará el polling de LCU/Riot API.');
        }

        if (mainWindow && !mainWindow.isDestroyed()) {
             mainWindow.setIgnoreMouseEvents(false);
             console.log('[IPC RECEPCIÓN] 🖱️ Reactivando eventos de ratón para el Dashboard. Clics y arrastre habilitados.');
        }
    });

    ipcMain.handle('get-user-data', async (event) => {
        // Devolver todo el objeto userData (que ahora incluye SummonerName, Region, Tagline)
        const userData = store.get('userData');
        console.log('[IPC Handle] Sirviendo userData al frontend:', JSON.stringify(userData ? { summonerName: userData.summonerName, username: userData.username } : 'no data', null, 2));
        return userData;
    });

    ipcMain.on('set-riot-api-key', (event, apiKey) => {
        store.set('riotApiKey', apiKey);
        console.log(`[MAIN STORE] ✅ Clave API Riot guardada.`);
        stopLiveGamePolling();
        startLiveGamePolling();
    });

    const makeAIRequest = async (endpoint, payload = {}) => {
        const token = store.get('userToken');
        if (!token) {
            console.error(`[AI Request] Error: Usuario no autenticado para ${endpoint}`);
            return { error: 'Usuario no autenticado. Por favor, inicia sesión.' };
        }

        try {
            const response = await axios.post(`${BACKEND_BASE_URL}${endpoint}`, payload, {
                headers: { 'Authorization': `Bearer ${token}` },
                httpsAgent: backendAgent, 
                timeout: 30000 
            });
            return response.data;
        } catch (error) {
            console.error(`[AI Request Error] en ${endpoint}:`, error.message);
            if (error.response && error.response.data && error.response.data.message) {
                return { error: error.response.data.message };
            }
            return { error: `Error al contactar el backend para la IA: ${error.message}` };
        }
    };

    ipcMain.handle('get-meta-analysis', () => makeAIRequest('/api/ai/get-meta'));
    ipcMain.handle('get-recommendations', (event, payload) => makeAIRequest('/api/ai/get-recommendations', payload));
    ipcMain.handle('get-weekly-challenges', () => makeAIRequest('/api/ai/get-weekly-challenges'));
    ipcMain.handle('analyze-matches', (event, payload) => makeAIRequest('/api/ai/analyze-matches', payload));


    // ----------------------------------------------------
    // INICIO DEL CICLO DE VIDA DE LA APLICACIÓN
    // ----------------------------------------------------
    createSplashWindow();
    createMainWindow();
    // setupWebSocketClient();
    createOverlayWindow(); 
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        stopLiveGamePolling();
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
    }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.whenReady().then(() => {
    globalShortcut.register('Alt+O', () => {
        if (overlayWindow) {
            if (overlayWindow.isVisible()) {
                overlayWindow.hide();
                // Ocultar implica que NO puede interactuar
                overlayWindow.setIgnoreMouseEvents(true); 
            } else {
                overlayWindow.showInactive(); 
                // Mostrar implica que SI puede interactuar. La lógica del frontend se encarga de cambiar a 'pointer-events-none'
                overlayWindow.setIgnoreMouseEvents(false); 
            }
            // Enviar un evento IPC al frontend para que el hook 'useInteractiveWidget' detecte el cambio.
            overlayWindow.webContents.send('overlay-interaction-toggle', overlayWindow.isVisible());
        }
    });
});