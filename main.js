// ===============================
// ETAPA 1: IMPORTS, CONFIG Y TTS
// ===============================

// -------------------------------
// Electron core y utilidades
// -------------------------------
const { app, BrowserWindow, globalShortcut, screen, ipcMain, session, powerSaveBlocker } = require('electron');
const path = require('path');               // Construir paths cross-platform
const fs = require('fs');                   // Leer/escribir TTS, store, logs
const util = require('util');               // Promisify y utils de debugging
const axios = require('axios');             // Llamadas HTTP backend / Riot API
const https = require('https');             // Custom agent HTTPS que ignora certificados locales
const { spawn } = require('child_process'); // Para Coqui TTS

// -------------------------------
// Almacenamiento persistente
// -------------------------------
const Store = require('electron-store');
const store = new Store();                  // Guarda tokens, API keys, userData

// -------------------------------
// League Client / Riot API Helpers
// -------------------------------
const {
    fetchRiotApiData,        // Obtiene perfil de Riot API
    pollLcuDataAndSend,      // Polling continuo de LCU (live game state)
    sendLcuCommand,          // Enviar comandos a LCU
    getLcuCredentials        // Obtener credenciales LCU locales
} = require('./lol-client-api');

// -------------------------------
// Config app y entorno
// -------------------------------
app.setPath('userData', path.join(__dirname, 'electron_data')); // Carpeta persistente
const isDevMode = !!process.defaultApp;                         // Detecta desarrollo

// Ignorar certificados locales y desactivar aceleración hardware
app.commandLine.appendSwitch('ignore-certificate-errors');
app.disableHardwareAcceleration();

// -------------------------------
// Paths y Endpoints
// -------------------------------
const HTTP_BASE_API_URL = 'http://localhost:3001'; // Requests HTTP
const BACKEND_BASE_URL = 'http://localhost:3000';
const FRONTEND_BASE_URL = 'http://localhost:3001';

// Endpoints backend específicos
const LIVE_GAME_UPDATE_ENDPOINT = '/api/live-game/update';
const USER_PROFILE_ENDPOINT = '/api/user/profile';

// Paths de ventanas según dev o build
const INDEX_PATH = isDevMode
    ? `${FRONTEND_BASE_URL}/dashboard`
    : `file://${path.join(__dirname, 'out', 'dashboard', 'index.html')}`;
const LOGIN_PATH = isDevMode
    ? `${FRONTEND_BASE_URL}`
    : `file://${path.join(__dirname, 'out', 'index.html')}`;

// HTTPS agent custom (ignora certificados locales)
const backendAgent = new https.Agent({ rejectUnauthorized: false });

// -------------------------------
// Helper async simple
// -------------------------------
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// -------------------------------
// Directorio temporal TTS
// -------------------------------
const TTS_TEMP_DIR = path.join(app.getPath('temp'), 'metaMind-tts');
if (!fs.existsSync(TTS_TEMP_DIR)) fs.mkdirSync(TTS_TEMP_DIR, { recursive: true });
console.log(`[TTS INIT] Directorio temporal TTS listo: ${TTS_TEMP_DIR}`);

// ===============================
// ETAPA 2: VARIABLES GLOBALES Y VENTANAS
// ===============================

// -------------------------------
// Variables globales de la app
// -------------------------------
let mainWindow;      // Dashboard principal
let loginWindow;     // Ventana login
let splashWindow;    // Splash inicial
let overlayWindow;   // Overlay tipo coach en juego

let pollingInterval = null;        // Polling de LCU
let hasRunInitialLogin = false;    // Evita login duplicado
let latestRiotApiData = null;      // Últimos datos de Riot API

// -------------------------------
// IPC helper para enviar datos al renderer
// -------------------------------
function sendDataToRenderer(channel, data) {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(channel, data);
    }
}

function sendDataToOverlay(channel, data) {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
        overlayWindow.webContents.send(channel, data);
    }
}

async function fetchAndStoreUserProfile(username, token) {
    console.log(`[DB FETCH] Iniciando fetchAndStoreUserProfile para: ${username}`);
    
    if (!token || typeof token !== 'string' || token.length < 10) {
        console.error('[DB FETCH] ❌ Token inválido o no recibido.');
        return false;
    }

    try {
        const response = await axios.get(`${BACKEND_BASE_URL}${USER_PROFILE_ENDPOINT}`, {
            headers: { 'Authorization': `Bearer ${token}` },
            httpsAgent: backendAgent,
            timeout: 15000
        });

        if (response.status === 200 && response.data) {
            const data = response.data;

            const { summonerName, tagline, region, riotApiKey } = data;
            if (!summonerName || !tagline || !region || !data.zodiacSign) {
                console.error('[DB FETCH] ❌ Datos incompletos en la respuesta del backend.');
                store.set('userData', data);
                return false;
            }

            store.set('userData', data);
            store.set('userSummonerName', summonerName);
            store.set('userRegion', region);
            store.set('userTagline', tagline);
            if (riotApiKey) {
                store.set('riotApiKey', riotApiKey);
                console.log('[DB FETCH] ✅ Riot API Key guardada en Store.');
            }

            console.log(`[DB FETCH] ✅ Perfil guardado para: ${summonerName}`);
            return true;
        } else {
            console.warn('[DB FETCH] ⚠️ Perfil no encontrado o incompleto.');
            return false;
        }
    } catch (error) {
        console.error(`[DB FETCH] ❌ Error al obtener perfil: ${error.message}`);
        if (error.response) {
            console.error(`[DB FETCH] Status: ${error.response.status}, Data: ${JSON.stringify(error.response.data)}`);
        }
        return false;
    }
}

// ===============================
// ETAPA 2A: CREACIÓN DE VENTANAS
// ===============================

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
    console.log('[WINDOW] Splash window cargada');

    splashWindow.on('closed', () => {
        splashWindow = null;
        console.log('[WINDOW] Splash window cerrada');
    });
}

function createLoginWindow() {
    if (loginWindow) return loginWindow.focus();

    loginWindow = new BrowserWindow({
        width: 600,
        height: 800,
        minWidth: 560,
        minHeight: 700,
        show: false,
        frame: false,
        transparent: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
        },
    });

    loginWindow.loadURL(LOGIN_PATH);
    console.log('[WINDOW] Login window cargada');

    loginWindow.once('ready-to-show', () => {
        const splashDuration = 3000;
        setTimeout(() => {
            if (splashWindow) splashWindow.close();
            loginWindow.show();
            loginWindow.center();
            console.log('[WINDOW] Login window mostrada');
        }, splashDuration);
    });

    loginWindow.on('closed', () => {
        if (!mainWindow) app.quit();
        loginWindow = null;
        console.log('[WINDOW] Login window cerrada');
    });
}

function createMainWindow() {
    if (loginWindow) loginWindow.close();

    mainWindow = new BrowserWindow({
        width: 1920,
        height: 1080,
        minWidth: 1000,
        minHeight: 720,
        show: false,
        frame: false,
        backgroundColor: '#0A141A',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
        },
    });

    mainWindow.loadURL(INDEX_PATH);
    console.log('[WINDOW] Main dashboard cargada');

    mainWindow.once('ready-to-show', () => {
        mainWindow.showInactive();
        mainWindow.center();
        console.log('[WINDOW] Main dashboard mostrada');
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
        console.log('[WINDOW] Main window cerrada');
    });
}

function createOverlayWindow() {
    if (overlayWindow) return;

    const primaryDisplay = screen.getPrimaryDisplay();
    overlayWindow = new BrowserWindow({
        title: 'MetaMind Coach Overlay',
        width: primaryDisplay.workAreaSize.width,
        height: primaryDisplay.workAreaSize.height,
        frame: false,
        hasShadow: false,
        alwaysOnTop: true,
        level: 'floating',
        skipTaskbar: true,
        resizable: false,
        show: false,
        transparent: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false,
            webSecurity: false,
        }
    });

    const OVERLAY_PATH = isDevMode
        ? `${FRONTEND_BASE_URL}/overlay`
        : path.join(app.getAppPath(), 'out', 'overlay.html');

    if (isDevMode) overlayWindow.loadURL(OVERLAY_PATH);
    else overlayWindow.loadFile(OVERLAY_PATH);

    overlayWindow.setIgnoreMouseEvents(true, { forward: true });

    overlayWindow.once('ready-to-show', () => {
        overlayWindow.show();
        console.log('[WINDOW] Overlay window creada y lista');
    });

    overlayWindow.on('closed', () => {
        overlayWindow = null;
        console.log('[WINDOW] Overlay window cerrada');
    });
}

// ===============================
// ETAPA 2B: APP READY
// ===============================
app.on('ready', () => {
    console.log('[APP] Electron listo, creando ventanas iniciales...');

    createSplashWindow();
    createLoginWindow();

    console.log('[APP] Ventanas iniciales creadas ✅');

// ===============================
// ETAPA 3: POLLING DE RIOT API Y LCU
// ===============================

    async function executeInitialRiotApiFetchAndStartPolling() {
        console.log('[MAIN-FLOW] -> Iniciando flujo inicial de Riot API y LCU');

        // Detener cualquier polling activo
        stopLiveGamePolling();
        latestRiotApiData = null;

        // Obtener credenciales de Store
        const riotApiKey = store.get('riotApiKey');
        const userRegion = store.get('userRegion');
        const userSummonerName = store.get('userSummonerName');
        const userTagline = store.get('userTagline');

        if (!riotApiKey || !userRegion || !userSummonerName || !userTagline) {
            console.error('[MAIN-FLOW] ❌ Credenciales faltantes. Abortando polling.');
            sendDataToRenderer('riot-profile-data', { error: 'Faltan credenciales de Riot API.' });
            return;
        }

        try {
            // Fetch inicial de datos de Riot API
            latestRiotApiData = await fetchRiotApiData();
            if (!latestRiotApiData) throw new Error('No se recibieron datos de Riot API');

            console.log('[MAIN-FLOW] ✅ Datos iniciales de Riot API obtenidos');
            sendDataToRenderer('riot-profile-data', latestRiotApiData);

            // Enviar datos iniciales al backend
            const userToken = store.get('userToken');
            if (userToken) {
                try {
                    await axios.post(
                        `${BACKEND_BASE_URL}${LIVE_GAME_UPDATE_ENDPOINT}`,
                        latestRiotApiData,
                        { headers: { 'Authorization': `Bearer ${userToken}` }, httpsAgent: backendAgent, timeout: 5000 }
                    );
                    console.log('[MAIN-FLOW] ✅ Datos iniciales enviados al backend');
                } catch (backendError) {
                    console.error(`[MAIN-FLOW] ❌ Fallo al enviar datos al backend: ${backendError.message}`);
                }
            }

            // Iniciar polling LCU
            startLcuPolling();

        } catch (error) {
            console.error('[MAIN-FLOW] ❌ Fallo al obtener datos iniciales de Riot API:', error.message);
            sendDataToRenderer('riot-profile-data', { error: 'Fallo al obtener datos de Riot API.' });
        }
    }

    // -------------------------------
    // Inicia el polling de LCU
    // -------------------------------
    function startLcuPolling() {
        console.log('[LCU POLLING] 🟢 Iniciando polling LCU...');
        if (pollingInterval) clearInterval(pollingInterval);

        const overlayIpcSender = (data) => {
            if (overlayWindow && !overlayWindow.isDestroyed()) {
                const storedUserData = store.get('userData');
                const payloadCompleto = { ...data, userData: storedUserData };
                console.log('[IPC SEND] Enviando payload completo al Overlay...');
                overlayWindow.webContents.send('lcu-state-update', payloadCompleto);
            }
        };

        const performPoll = async () => {
            try {
                if (!latestRiotApiData) {
                    console.warn('[LCU POLLING] ⚠️ No hay datos base de Riot API. Deteniendo polling.');
                    stopLiveGamePolling();
                    return;
                }

                await pollLcuDataAndSend(
                    latestRiotApiData,
                    BACKEND_BASE_URL,
                    LIVE_GAME_UPDATE_ENDPOINT,
                    (data) => sendDataToRenderer('riot-profile-data', data),
                    overlayIpcSender
                );

            } catch (error) {
                console.error(`[LCU POLLING] ❌ Error en ciclo de polling: ${error.message}`);
            }
        };

        // Ejecutar inmediatamente y luego cada 3 segundos
        performPoll();
        pollingInterval = setInterval(performPoll, 3000);
    }

    // -------------------------------
    // Detiene el polling activo de LCU
    // -------------------------------
    function stopLiveGamePolling() {
        if (pollingInterval) {
            clearInterval(pollingInterval);
            pollingInterval = null;
            console.log('[LCU POLLING] 🛑 Polling detenido');
        }
    }

    // -------------------------------
    // Integración con evento login
    // -------------------------------
    ipcMain.on('user-logged-in', async (event, userData) => {
        console.log(`[IPC] 'user-logged-in' recibido para: ${userData.username}`);

        if (hasRunInitialLogin) {
            console.warn('[IPC] Evento login duplicado ignorado');
            return;
        }

        // Guardar token en Store
        store.set('userToken', userData.token);

        // Fetch de perfil y guardado en Store
        const profileFetchSuccess = await fetchAndStoreUserProfile(userData.username, userData.token);

        if (profileFetchSuccess || store.get('userData')) {
            hasRunInitialLogin = true;
            console.log('[MAIN-FLOW] ✅ Perfil cargado, cerrando Login y abriendo Dashboard');

            createMainWindow();
            createOverlayWindow();

            // Iniciar flujo Riot API + LCU
            console.log('[MAIN-FLOW] Iniciando flujo Riot/LCU tras login exitoso');
            executeInitialRiotApiFetchAndStartPolling();
        } else {
            console.error('[MAIN-FLOW] ❌ Fallo al obtener perfil. Permaneciendo en Login');
        }
    });

    // Obtener datos de usuario
    ipcMain.handle('get-user-data', async () => {
        const token = store.get('userToken');
        if (!token) return null;

        try {
            const response = await axios.get(`${BACKEND_BASE_URL}/api/user/profile`, { 
                headers: { 'Authorization': `Bearer ${token}` },
                httpsAgent: backendAgent,
                timeout: 15000
            });
            return response.data;
        } catch (error) {
            console.error('[IPC] Error al obtener datos de usuario:', error.message);
            return null;
        }
    });

// ===============================
// ETAPA 4: IPC IA, Coqui TTS y Shortcuts
// ===============================

// -------------------------------
// Helper para requests a backend IA
// -------------------------------
    const makeAIRequest = async (endpoint, payload = {}) => {
        const token = store.get('userToken');
        if (!token) return { error: 'Usuario no autenticado.' };

        try {
            const response = await axios.post(
                `${BACKEND_BASE_URL}${endpoint}`,
                payload,
                { headers: { 'Authorization': `Bearer ${token}` }, httpsAgent: backendAgent, timeout: 30000 }
            );
            console.log(`[AI REQUEST] ${endpoint} ✅ Respuesta recibida`);
            return response.data;
        } catch (error) {
            console.error(`[AI REQUEST] ${endpoint} ❌ Error: ${error.message}`);
            return { error: error.response?.data?.message || `Error al contactar backend IA: ${error.message}` };
        }
    };

    // -------------------------------
    // Handlers IPC IA
    // -------------------------------
    ipcMain.handle('get-meta-analysis', (e, payload) => makeAIRequest('/api/ai/get-meta', payload));
    ipcMain.handle('get-recommendations', (e, payload) => makeAIRequest('/api/ai/get-recommendations', payload));
    ipcMain.handle('get-weekly-challenges', (e, payload) => makeAIRequest('/api/ai/get-weekly-challenges', payload));
    ipcMain.handle('analyze-matches', (e, payload) => makeAIRequest('/api/ai/analyze-matches', payload));
    ipcMain.handle('get-strategic-advice', (e, payload) => makeAIRequest('/api/ai/strategy-coach', payload));
    ipcMain.handle('get-live-coaching', (e, payload) => makeAIRequest('/api/ai/live-coach', payload));

    // -------------------------------
    // IPC LCU (Comandos directos al cliente de LoL)
    // -------------------------------
    ipcMain.handle('lcu-command', async (event, method, endpoint, payload) => {
        try {
            const creds = getLcuCredentials();
            if (!creds) return { error: 'LCU OFFLINE. Inyección fallida.' };

            const result = await sendLcuCommand(creds, method, endpoint, payload);
            console.log(`[LCU COMMAND] ${method} ${endpoint} ✅ Comando ejecutado`);
            return { success: result };
        } catch (error) {
            console.error(`[LCU COMMAND FAIL] ${method} ${endpoint} ❌ Error: ${error.message}`);
            return { error: `Comando LCU fallido: ${error.message}` };
        }
    });

    // -------------------------------
    // IPC COQUI TTS (Text-to-Speech avanzado)
    // -------------------------------
    ipcMain.handle('coqui-tts', async (event, { text, rate = 1.0, pitch = 1.0 }) => {
        console.log('[TTS] IPC coqui-tts recibido:', text);

        if (!text) {
            console.warn('[TTS] Texto vacío recibido. Abortando generación');
            return null;
        }

        try {
            const filePath = path.join(TTS_TEMP_DIR, `tts-${Date.now()}.wav`);
            console.log('[TTS] Archivo de salida:', filePath);

            const pythonProcess = spawn('python', [
                '-m', 'coqui_ai.cli',
                '--voice', 'alloy',
                '--text', text,
                '--rate', rate.toString(),
                '--pitch', pitch.toString(),
                '--output', filePath
            ]);

            pythonProcess.stdout.on('data', (data) => console.log('[TTS][stdout]', data.toString()));
            pythonProcess.stderr.on('data', (data) => console.log('[TTS][stderr]', data.toString()));

            await new Promise((resolve, reject) => {
                pythonProcess.on('close', (code) => {
                    if (code === 0) resolve();
                    else reject(new Error(`Coqui TTS exited with code ${code}`));
                });
            });

            console.log('[TTS] Audio generado correctamente ✅');
            return { filePath };
        } catch (err) {
            console.error('[TTS] Falló generación Coqui TTS:', err.message);
            return null;
        }
    });

    // -------------------------------
    // IPC para guardar Riot API Key
    // -------------------------------
    ipcMain.on('set-riot-api-key', async (event, apiKey) => {
        store.set('riotApiKey', apiKey);
        console.log('[MAIN-STORE] ✅ Riot API Key guardada. Reiniciando flujo polling.');
        if (mainWindow) await executeInitialRiotApiFetchAndStartPolling();
    });

    // -------------------------------
    // IPC para cerrar ventana (legacy)
    // -------------------------------
    ipcMain.on('closeWindow', () => {
        console.log('[IPC] Cierre de ventana solicitado (legacy closeWindow)');
        app.quit();
    });

    // -------------------------------
    // SHORTCUTS GLOBALES
    // -------------------------------
    try {
        // F1 → Modo interactivo (overlay recibe clicks)
        globalShortcut.register('CommandOrControl+F1', () => {
            if (overlayWindow) {
                overlayWindow.setIgnoreMouseEvents(false);
                console.log('[Shortcut] Modo Interactivo activado');
            }
        });

        // F2 → Modo click-through (overlay ignora clicks)
        globalShortcut.register('CommandOrControl+F2', () => {
            if (overlayWindow) {
                overlayWindow.setIgnoreMouseEvents(true, { forward: true });
                console.log('[Shortcut] Modo Click-Through activado');
            }
        });

        // F3 → Toggle visibilidad overlay
        globalShortcut.register('CommandOrControl+F3', () => {
            if (overlayWindow) {
                overlayWindow.isVisible() ? overlayWindow.hide() : overlayWindow.show();
                console.log('[Shortcut] Toggle Overlay Visibility');
            }
        });

        console.log('[SHORTCUTS] Global shortcuts registradas correctamente');
    } catch (err) {
        console.error('[SHORTCUTS] Error registrando global shortcuts:', err.message);
    }

    // -------------------------------
    // IPC para control de ventana principal y login
    // -------------------------------
    ipcMain.on('close-app', () => {
        console.log('[IPC] Cierre de aplicación solicitado');
        app.quit();
    });
    ipcMain.on('minimizeWindow', () => {
        if (mainWindow) mainWindow.minimize();
        else if (loginWindow) loginWindow.minimize();
        console.log('[IPC] Minimizar ventana ejecutado');
    });
});
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        stopLiveGamePolling();
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        if (!loginWindow && !mainWindow) {
            createSplashWindow();
            createLoginWindow();
        }
    }
});

app.on('will-quit', () => globalShortcut.unregisterAll());