// main.js - VERSIÓN FINAL-FINAL, COMPLETA Y UNIFICADA

const { app, BrowserWindow, globalShortcut, screen, ipcMain } = require('electron');
const path = require('path');
const axios = require('axios');
const Store = require('electron-store');
const https = require('https');
const { LcuApiHandler } = require('./lol-client-api'); // <-- IMPORTAMOS LA NUEVA CLASE "MANEJADORA"

const store = new Store();
let hasRunInitialLogin = false;
let lcuHandler = null; // <-- ÚNICA VARIABLE GLOBAL PARA EL MANEJADOR LCU

const isDevMode = !!process.defaultApp;

app.commandLine.appendSwitch('ignore-certificate-errors');
app.disableHardwareAcceleration();

let mainWindow;
let splashWindow;
let overlayWindow;

const USE_LOCAL_BACKEND = true;
const HTTP_BASE_API_URL = 'http://localhost:3000';
const BACKEND_BASE_URL = HTTP_BASE_API_URL;

const LIVE_GAME_UPDATE_ENDPOINT = '/api/live-game/update';
const USER_PROFILE_ENDPOINT = '/api/user/profile';

const INDEX_PATH = isDevMode ? 'http://localhost:3001' : `file://${path.join(__dirname, 'out', 'index.html')}`;
const OVERLAY_PATH = isDevMode ? 'http://localhost:3001/overlay' : `file://${path.join(__dirname, 'out', 'overlay.html')}`;

const backendAgent = new https.Agent({ rejectUnauthorized: false });

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// --- FUNCIONES COMPLETAS (INCLUIDAS) ---

/**
 * Envía datos al proceso de renderizado (frontend).
 * @param {string} channel - El canal IPC.
 * @param {object} data - Los datos a enviar.
 */
function sendDataToRenderer(channel, data) {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(channel, data);
    }
    // 🔑 AÑADIDO: También enviamos los datos al overlay
    if (overlayWindow && !overlayWindow.isDestroyed()) {
        overlayWindow.webContents.send(channel, data);
    }

    // 🔑 LÓGICA DE VISIBILIDAD DEL OVERLAY
    const gamePhase = data?.lcuState?.gameflow?.phase;
    if (overlayWindow) {
        if (gamePhase === 'ChampSelect' || gamePhase === 'InProgress') {
            if (!overlayWindow.isVisible()) {
                console.log(`[Overlay] Mostrando overlay. Fase de juego: ${gamePhase}`);
                overlayWindow.showInactive(); // showInactive para que no robe el foco
            }
        } else {
            if (overlayWindow.isVisible()) {
                console.log(`[Overlay] Ocultando overlay. Fase de juego: ${gamePhase}`);
                overlayWindow.hide();
            }
        }
    }
}


/**
 * Obtiene el perfil completo del usuario desde la DB.
 */
async function fetchAndStoreUserProfile(username, token) {
    if (!token || typeof token !== 'string' || token.length < 10) {
        console.error('[DB FETCH] ❌ Falla Crítica: Token inválido o no recibido. Saltando fetch.');
        return false;
    }
    const MAX_ATTEMPTS = 2;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
            const response = await axios.get(`${BACKEND_BASE_URL}${USER_PROFILE_ENDPOINT}`, {
                headers: { 'Authorization': `Bearer ${token}` },
                params: { username: username },
                httpsAgent: backendAgent,
                timeout: 20000
            });
            if (response.status === 200 && response.data) {
                store.set('userData', response.data);
                store.set('userSummonerName', response.data.summonerName);
                store.set('userRegion', response.data.region);
                store.set('userTagline', response.data.tagline);
                if (response.data.riotApiKey) {
                    store.set('riotApiKey', response.data.riotApiKey);
                    console.log('[DB FETCH] ✅ Riot API Key obtenida del perfil y guardada.');
                }
                console.log(`[DB FETCH] ✅ Perfil completo guardado para: ${response.data.summonerName}.`);
                return true;
            }
        } catch (error) {
            console.error(`[DB FETCH] ❌ Fallo (Intento ${attempt}): ${error.message}`);
            if (attempt < MAX_ATTEMPTS) await delay(1500);
        }
    }
    return false;
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
            if (splashWindow) splashWindow.close();
            mainWindow.show();
            mainWindow.center();
        }, 3000);
    });
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
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

// =========================================================================
// MANEJO DE EVENTOS IPC Y LÓGICA DE LA APLICACIÓN
// =========================================================================

app.on('ready', () => {
    console.log('[MAIN] -> APP READY. Creando ventanas y registrando IPC...');

    ipcMain.on('closeWindow', () => app.quit());
    ipcMain.on('minimizeWindow', () => mainWindow?.minimize());

    ipcMain.on('user-logged-in', async (event, userData) => {
        if (hasRunInitialLogin) {
            console.warn(`[IPC RECEPCIÓN] ⚠️ Evento de login duplicado para ${userData.username} ignorado.`);
            return;
        }
        hasRunInitialLogin = true;

        console.log(`[IPC RECEPCIÓN] ✅ EVENTO RECIBIDO. Usuario: ${userData.username}. INICIANDO PROCESOS POST-LOGIN.`);
        store.set('userToken', userData.token);
        
        const profileFetchSuccess = await fetchAndStoreUserProfile(userData.username, userData.token);

        if (profileFetchSuccess) {
            // 🔑 INICIALIZACIÓN DEL MANEJADOR LCU
            lcuHandler = new LcuApiHandler(
                (data) => sendDataToRenderer('riot-profile-data', data), // Función para enviar datos al frontend
                BACKEND_BASE_URL,
                LIVE_GAME_UPDATE_ENDPOINT
            );
            lcuHandler.start();
            console.log('[MAIN] ✅ Manejador LCU inicializado y arrancado.');
        } else {
            console.error('[IPC RECEPCIÓN] ⚠️ No se pudo obtener el perfil del usuario. No se iniciará el LCU Handler.');
        }

        if (mainWindow && !mainWindow.isDestroyed()) {
             mainWindow.setIgnoreMouseEvents(false);
             console.log('[IPC RECEPCIÓN] 🖱️ Reactivando eventos de ratón para el Dashboard.');
        }
    });

    ipcMain.handle('get-user-data', async () => store.get('userData'));

    ipcMain.on('set-riot-api-key', async (event, apiKey) => {
        store.set('riotApiKey', apiKey);
        console.log(`[MAIN STORE] ✅ Clave API Riot guardada.`);
        if (lcuHandler) {
            lcuHandler.restart();
        }
    });
    
    // IPC para la creación de runas
    ipcMain.handle('create-rune-page', async (event, runeData) => {
        if (lcuHandler) {
            return await lcuHandler.createRunePage(runeData);
        }
        return { error: 'LCU Handler no está inicializado.' };
    });

    const makeAIRequest = async (endpoint, payload = {}) => {
        const token = store.get('userToken');
        if (!token) return { error: 'Usuario no autenticado.' };
        try {
            const response = await axios.post(`${BACKEND_BASE_URL}${endpoint}`, payload, {
                headers: { 'Authorization': `Bearer ${token}` },
                httpsAgent: backendAgent, 
                timeout: 30000 
            });
            return response.data;
        } catch (error) {
            console.error(`[AI Request Error] en ${endpoint}:`, error.message);
            return { error: `Error al contactar el backend para la IA: ${error.message}` };
        }
    };

    ipcMain.handle('get-meta-analysis', () => makeAIRequest('/api/ai/get-meta'));
    ipcMain.handle('get-recommendations', (event, payload) => makeAIRequest('/api/ai/get-recommendations', payload));
    ipcMain.handle('get-weekly-challenges', () => makeAIRequest('/api/ai/get-weekly-challenges'));
    ipcMain.handle('analyze-matches', (event, payload) => makeAIRequest('/api/ai/analyze-matches', payload));

    // INICIO DEL CICLO DE VIDA DE LA APLICACIÓN
    createSplashWindow();
    createMainWindow();
    createOverlayWindow();
});

app.on('window-all-closed', () => {
    if (lcuHandler) lcuHandler.stop(); // Detenemos el manejador al cerrar
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});


app.whenReady().then(() => {
    globalShortcut.register('Alt+O', () => {
        if (overlayWindow) {
            const isIgnoringMouseEvents = overlayWindow.isIgnoringMouseEvents();
            overlayWindow.setIgnoreMouseEvents(!isIgnoringMouseEvents);
            
            const isNowInteractive = !isIgnoringMouseEvents;
            console.log(`[Shortcut] Alt+O presionado. El overlay ahora es: ${isNowInteractive ? 'INTERACTIVO' : 'NO INTERACTIVO'}`);
            
            overlayWindow.webContents.send('overlay-interaction-toggle', isNowInteractive);
        }
    });
});