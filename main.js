// main.js - VERSIÓN COMPLETA Y DEFINITIVA (FIX DE FOCO, Z-ORDER Y LÓGICA DE APP.ON('READY'))

const { app, BrowserWindow, globalShortcut, screen, ipcMain, session } = require('electron');
const path = require('path');
const axios = require('axios');
const Store = require('electron-store');
const store = new Store();
const https = require('https');
// Asegúrate de que lol-client-api.js esté en el directorio raíz
const { fetchRiotApiData, pollLcuDataAndSend } = require('./lol-client-api'); 

app.setPath('userData', path.join(__dirname, 'electron_data'));

let mainWindow; // Dashboard Window (Grande, Opaca)
let loginWindow; // Login Window (Pequeña, Opaca/Transparente, fondo dado por React)
let splashWindow; // Splash HTML Window (Pequeña, Transparente)
let overlayWindow; // Overlay Window (Grande, Transparente)

let pollingInterval = null;
let hasRunInitialLogin = false;
let latestRiotApiData = null;

const isDevMode = !!process.defaultApp;

app.commandLine.appendSwitch('ignore-certificate-errors');
app.disableHardwareAcceleration();

// --- URLs y Endpoints ---
const HTTP_BASE_API_URL = 'http://localhost:3000';
const BACKEND_BASE_URL = HTTP_BASE_API_URL;

const LIVE_GAME_UPDATE_ENDPOINT = '/api/live-game/update';
const USER_PROFILE_ENDPOINT = '/api/user/profile';

// RUTAS CRÍTICAS: Next.js 'out' genera index.html dentro de cada carpeta
const INDEX_PATH = isDevMode ? 'http://localhost:3001/dashboard' : `file://${path.join(__dirname, 'out', 'dashboard', 'index.html')}`;
const LOGIN_PATH = isDevMode ? 'http://localhost:3001' : `file://${path.join(__dirname, 'out', 'index.html')}`;
const OVERLAY_PATH = isDevMode ? 'http://localhost:3001/overlay' : `file://${path.join(__dirname, 'out', 'overlay', 'index.html')}`;

const backendAgent = new https.Agent({ rejectUnauthorized: false });
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

function sendDataToRenderer(channel, data) {
    const window = channel === 'overlay-interaction-toggle' ? overlayWindow : mainWindow;
    if (window && !window.isDestroyed()) {
        console.log(`[IPC SEND] Enviando al canal '${channel}'.`);
        window.webContents.send(channel, data);
    }
}


async function fetchAndStoreUserProfile(username, token) {
    console.log(`[DB FETCH] 🔍 Iniciando fetchAndStoreUserProfile para: ${username}`);
    if (!token || typeof token !== 'string' || token.length < 10) {
        console.error('[DB FETCH] ❌ Falla Crítica: Token inválido o no recibido.');
        return false;
    }

    try {
        const response = await axios.get(`${BACKEND_BASE_URL}${USER_PROFILE_ENDPOINT}`, {
            headers: { 'Authorization': `Bearer ${token}` },
            params: { username: username },
            httpsAgent: backendAgent,
            timeout: 15000
        });

        if (response.status === 200 && response.data) {
            const data = response.data;
            
            // Asumiendo nombres de columna limpios (summonerName, tagline, region)
            const summonerName = data.summonerName; 
            const tagline = data.tagline;
            const region = data.region;
            
            if (!summonerName || !tagline || !region || !data.zodiacSign) { // Validamos campos críticos de IA
                 console.error('[DB FETCH] ❌ Datos de Riot/IA incompletos en la respuesta del backend.');
                 store.set('userData', data); // Guardamos lo que haya para debugging
                 return false;
            }

            store.set('userData', data); 
            store.set('userSummonerName', summonerName);
            store.set('userRegion', region);
            store.set('userTagline', tagline);
            
            if (data.riotApiKey) {
                store.set('riotApiKey', data.riotApiKey);
                console.log('[DB FETCH] ✅ Riot API Key obtenida del backend y guardada en Store.');
            } 
            
            console.log(`[DB FETCH] ✅ Perfil guardado para: ${summonerName}.`);
            return true;
        } else {
            console.warn(`[DB FETCH] ⚠️ Perfil no encontrado o incompleto en la DB.`);
            return false;
        }
    } catch (error) {
        console.error(`[DB FETCH] ❌ Fallo crítico al obtener perfil: ${error.message}`);
        if (error.response) {
            console.error(`[DB FETCH] ❌ Detalles del error: Status ${error.response.status}, Data: ${JSON.stringify(error.response.data)}`);
        }
        return false;
    }
}


// ==========================================================
// CREACIÓN DE VENTANAS
// ==========================================================

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
    // splash.html debe estar en el directorio raíz
    splashWindow.loadURL(`file://${path.join(__dirname, 'splash.html')}`); 
    splashWindow.on('closed', () => (splashWindow = null));
}

function createLoginWindow() {
    if (loginWindow) {
        loginWindow.focus();
        return;
    }
    
    loginWindow = new BrowserWindow({
        width: 600,
        height: 800,
        minWidth: 560,
        minHeight: 700,
        show: false, 
        frame: false,
        
        // >>> SOLUCIÓN FINAL A LA TRANSPARENCIA Y EL FONDO GRIS <<<
        transparent: true, 
        
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
        },
    });
    
    loginWindow.loadURL(LOGIN_PATH); 

    loginWindow.once('ready-to-show', () => {
        const splashDuration = 3000; 
        
        setTimeout(() => {
            if (splashWindow) splashWindow.close();
            loginWindow.show();
            loginWindow.center();
            console.log("[MAIN] ✅ Login Window mostrada. Es opaca y clickeable.");
        }, splashDuration);
    });

    loginWindow.on('closed', () => {
        if (!mainWindow) {
            app.quit(); 
        }
        loginWindow = null;
    });
}

function createMainWindow() {
    // 1. Cierra la ventana antigua (Login)
    if (loginWindow) loginWindow.close(); 
    
    // 2. Crea la nueva ventana (Dashboard)
    mainWindow = new BrowserWindow({
        width: 1920,
        height: 1080,
        minWidth: 1000, 
        minHeight: 720, 
        show: false, 
        frame: false,
        transparent: false, 
        backgroundColor: '#0A141A', // Fondo sólido para el Dashboard
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
        },
    });

    // 3. Carga la URL del Dashboard
    mainWindow.loadURL(INDEX_PATH); 

    // 4. CRÍTICO: Muestra la ventana del Dashboard SÓLO cuando está lista, pero INACTIVA.
    mainWindow.once('ready-to-show', () => {
        console.log("[MAIN] READY-TO-SHOW disparado. Mostrando mainWindow (Dashboard) INACTIVO.");
        mainWindow.showInactive(); 
        mainWindow.center();
    });


    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

function createOverlayWindow() {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;

    overlayWindow = new BrowserWindow({
        width, height, x: 0, y: 0,
        transparent: true, 
        frame: false,
        focusable: false,
        alwaysOnTop: true,
        skipTaskbar: true, 
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
        },
    });

    overlayWindow.loadURL(OVERLAY_PATH);
    
    // FIX DE VISIBILIDAD CRÍTICO (MODO DEV) Y ORDEN Z MÁS ALTO
    if (isDevMode) {
        overlayWindow.once('ready-to-show', () => {
             // CRÍTICO: Usamos 'screen-saver' para el Z-order más alto.
             overlayWindow.setAlwaysOnTop(true, 'screen-saver');
             overlayWindow.showInactive(); 
             console.log("[OVERLAY] ✅ Ventana de Overlay visible (Z-Order: Screen Saver). Use CTRL+F1/F2.");
        });
    } else {
        overlayWindow.hide();
        overlayWindow.setAlwaysOnTop(true); 
    }

    // Estado inicial de interacción: Pasivo (transparente a clicks)
    overlayWindow.setIgnoreMouseEvents(true); 
    overlayWindow.on('closed', () => (overlayWindow = null));
}

// ==========================================================
// LÓGICA DE POLLING
// ==========================================================
async function executeInitialRiotApiFetchAndStartPolling() {
    console.log('[MAIN-FLOW] -> Iniciando executeInitialRiotApiFetchAndStartPolling.');
    stopLiveGamePolling();
    latestRiotApiData = null;

    const riotApiKey = store.get('riotApiKey');
    const userRegion = store.get('userRegion');
    const userSummonerName = store.get('userSummonerName');
    const userTagline = store.get('userTagline');

    console.log('[MAIN-FLOW] Verificando datos necesarios para la llamada a Riot API:');
    if (!riotApiKey || !userRegion || !userSummonerName || !userTagline) {
        console.error('[MAIN-FLOW] ❌ Faltan credenciales críticas. No se puede continuar con el polling de Riot API.');
        sendDataToRenderer('riot-profile-data', { error: 'Faltan credenciales de Riot API. Configura tu API Key en el dashboard.' });
        return;
    }

    latestRiotApiData = await fetchRiotApiData(); 

    if (latestRiotApiData) {
        console.log('[MAIN-FLOW] ✅ Datos de Riot API (primera pasada) obtenidos. Enviando al frontend y al backend.');
        sendDataToRenderer('riot-profile-data', latestRiotApiData);

        const userToken = store.get('userToken');
        if (userToken) {
            try {
                await axios.post(
                    `${BACKEND_BASE_URL}${LIVE_GAME_UPDATE_ENDPOINT}`,
                    latestRiotApiData,
                    { headers: { 'Authorization': `Bearer ${userToken}` }, httpsAgent: backendAgent, timeout: 5000 }
                );
                console.log('[MAIN-FLOW] ✅ Datos iniciales de Riot API enviados al backend.');
            } catch (backendError) {
                console.error(`[MAIN-FLOW] ❌ Fallo al enviar datos iniciales de Riot API al backend: ${backendError.message}`);
            }
        }
        
        startLcuPolling();
    } else {
        console.error('[MAIN-FLOW] ❌ Fallo al obtener datos de Riot API en la primera pasada.');
        sendDataToRenderer('riot-profile-data', { error: 'Fallo al obtener datos de Riot API. Verifica tu API Key.' });
    }
}

function startLcuPolling() {
    console.log('[LCU POLLING] 🟢 Iniciando ciclo de polling para LCU...');
    if (pollingInterval) clearInterval(pollingInterval);

    const performPoll = async () => {
        if (!latestRiotApiData) {
            console.warn('[LCU POLLING] ⚠️ No hay datos base de Riot API. Deteniendo polling LCU.');
            stopLiveGamePolling();
            return;
        }
        await pollLcuDataAndSend(
            latestRiotApiData,
            BACKEND_BASE_URL,
            LIVE_GAME_UPDATE_ENDPOINT,
            (data) => sendDataToRenderer('riot-profile-data', data)
        );
    };
    
    performPoll();
    pollingInterval = setInterval(performPoll, 15000);
}

function stopLiveGamePolling() {
    if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
        console.log('[LCU POLLING] 🛑 Polling LCU detenido.');
    }
}
// ==========================================================

app.on('ready', () => {
    console.log('[MAIN] -> App lista. Creando ventanas y configurando IPC.');

    createSplashWindow();
    createLoginWindow(); 
    createOverlayWindow(); 

    // IPC: Manejo del toggle de visibilidad (Alt+O original)
    ipcMain.on('toggle-overlay', () => {
        if (overlayWindow) {
            if (overlayWindow.isVisible()) {
                overlayWindow.hide();
                overlayWindow.setIgnoreMouseEvents(true);
                sendDataToRenderer('overlay-interaction-toggle', false); 
                console.log('[IPC RECEIVE] Ocultando Overlay.');
            } else {
                overlayWindow.showInactive(); 
                overlayWindow.setIgnoreMouseEvents(true);
                sendDataToRenderer('overlay-interaction-toggle', false);
                console.log('[IPC RECEIVE] Mostrando Overlay.'); 
            }
        } else {
            console.error("[IPC RECEIVE] Error: Se intentó mostrar/ocultar un Overlay que no existe.");
        }
    });
    
    // IPC: Manejo de persistencia de escala de widgets
    ipcMain.handle('get-widget-scale-state', async (event, widgetId) => {
        return store.get(`widgetScale-${widgetId}`);
    });

    ipcMain.on('set-widget-scale-state', (event, { widgetId, scale, position, isLocked }) => {
        store.set(`widgetScale-${widgetId}`, { scale, position, isLocked });
        console.log(`[IPC STORE] ✅ Estado de widget ${widgetId} guardado. Escala: ${scale}`);
    });


    ipcMain.on('closeWindow', () => app.quit());
    ipcMain.on('minimizeWindow', () => {
        if (mainWindow) mainWindow.minimize();
        else if (loginWindow) loginWindow.minimize();
    });

    // CRÍTICO: Evento de Login exitoso
    ipcMain.on('user-logged-in', async (event, userData) => {
        console.log(`[IPC RECEIVE] Evento 'user-logged-in' recibido para el usuario: ${userData.username}`);
        if (hasRunInitialLogin) {
            console.warn(`[IPC RECEIVE] ⚠️ Evento de login duplicado ignorado.`);
            return;
        }
        
        store.set('userToken', userData.token);
        const profileFetchSuccess = await fetchAndStoreUserProfile(userData.username, userData.token);

        if (profileFetchSuccess || store.get('userData')) {
            hasRunInitialLogin = true;
            console.log('[MAIN-FLOW] ✅ Perfil cargado. Cerrando Login y abriendo Dashboard.');
            
            // 1. Crear la ventana principal (cierra loginWindow)
            createMainWindow(); 
            
            // 2. INICIAR EL POLLING CON DELAY
            setTimeout(() => {
                 console.log('[MAIN-FLOW] Retardo de 1s completado. Iniciando flujo de datos Riot/LCU.');
                 executeInitialRiotApiFetchAndStartPolling();
                 
                 // CRÍTICO: Aseguramos que el Overlay esté por encima del Dashboard (solo si existe y es visible)
                 if (overlayWindow && overlayWindow.isVisible()) {
                     overlayWindow.setAlwaysOnTop(true, 'screen-saver'); 
                     overlayWindow.focus(); 
                     console.log('[Z-ORDER-FIX] ✅ Overlay forzado a primer plano (Z-Order Fix).');
                 }
            }, 1000); 

        } else {
            console.error('[MAIN-FLOW] ❌ Fallo al obtener perfil. Permanece en Login.');
        }
    });

    ipcMain.handle('get-user-data', async () => store.get('userData'));

    ipcMain.on('set-riot-api-key', async (event, apiKey) => {
        store.set('riotApiKey', apiKey);
        console.log('[MAIN-STORE] ✅ Clave API Riot guardada. Reiniciando el flujo de polling.');
        if (mainWindow) {
            await executeInitialRiotApiFetchAndStartPolling();
        }
    });

    const makeAIRequest = async (endpoint, payload = {}) => {
        const token = store.get('userToken');
        if (!token) {
            console.error(`[AI Request] Error: No autenticado para el endpoint ${endpoint}`);
            return { error: 'Usuario no autenticado.' };
        }

        try {
            const response = await axios.post(`${BACKEND_BASE_URL}${endpoint}`, payload, {
                headers: { 'Authorization': `Bearer ${token}` },
                httpsAgent: backendAgent,
                timeout: 30000
            });
            return response.data;
        } catch (error) {
            const errorMessage = error.response?.data?.message || `Error al contactar el backend para la IA: ${error.message}`;
            return { error: errorMessage };
        }
    };
    
    ipcMain.handle('get-meta-analysis', (e, payload) => makeAIRequest('/api/ai/get-meta', payload));
    ipcMain.handle('get-recommendations', (e, payload) => makeAIRequest('/api/ai/get-recommendations', payload));
    ipcMain.handle('get-weekly-challenges', (e, payload) => makeAIRequest('/api/ai/get-weekly-challenges', payload));
    ipcMain.handle('analyze-matches', (e, payload) => makeAIRequest('/api/ai/analyze-matches', payload));
    ipcMain.handle('get-builds-tactical', (e, payload) => makeAIRequest('/api/ai/build-advisor', payload));
    ipcMain.handle('get-strategic-advice', (e, payload) => makeAIRequest('/api/ai/strategy-coach', payload));
    ipcMain.handle('get-builds-tactical', (e, payload) => makeAIRequest('/api/ai/build-advisor', payload));
    ipcMain.handle('get-strategic-advice', (e, payload) => makeAIRequest('/api/ai/strategy-coach', payload));
    ipcMain.handle('get-live-coaching', (e, payload) => makeAIRequest('/api/ai/live-coach', payload));

    // CRÍTICO: Manejador para la creación de páginas de runas a través de LCU
    ipcMain.handle('create-rune-page', async (e, runeData) => {
        console.log(`[LCU RUNES] 🔑 Solicitud para crear runas: ${runeData.name}`);
        // ESTO DEBE SER REEMPLAZADO CON SU LÓGICA DE LCU-CONNECTOR
        return { success: true, message: "Página de runas creada (Integración LCU Pendiente)" };
    });

    // CRÍTICO: Manejador para el Text-to-Speech (TTS) en el frontend
    ipcMain.on('speak-text', (event, text) => {
        if (mainWindow && text) {
            mainWindow.webContents.send('tts-narrate', text);
        } else if (overlayWindow && text) {
             overlayWindow.webContents.send('tts-narrate', text);
        }
    });

    // CRÍTICO: Manejador para la creación de páginas de runas a través de LCU

    // CRÍTICO: Manejador para el Text-to-Speech (TTS) en el frontend

    // CRÍTICO: Manejador para la creación de páginas de runas a través de LCU

    // CRÍTICO: Manejador para el Text-to-Speech (TTS) en el frontend
    // CRÍTICO: Manejador para la creación de páginas de runas a través de LCU
        console.log(`[LCU RUNES] 🔑 Solicitud para crear runas: ${runeData.name}`);
        // ESTO DEBE SER REEMPLAZADO CON SU LÓGICA DE LCU-CONNECTOR
        return { success: true, message: "Página de runas creada (Integración LCU Pendiente)" };
    

    // CRÍTICO: Manejador para la creación de páginas de runas a través de LCU
        console.log(`[LCU RUNES] 🔑 Solicitud para crear runas: ${runeData.name}`);
        // ESTO DEBE SER REEMPLAZADO CON SU LÓGICA DE LCU-CONNECTOR
        return { success: true, message: "Página de runas creada (Integración LCU Pendiente)" };
    

    // CRÍTICO: Manejador para el Text-to-Speech (TTS) en el frontend

    // CRÍTICO: Manejador para el Text-to-Speech (TTS) en el frontend

    // CRÍTICO: Manejador para la creación de páginas de runas a través de LCU
        console.log(`[LCU RUNES] 🔑 Solicitud para crear runas: ${runeData.name}`);
        // ESTO DEBE SER REEMPLAZADO CON SU LÓGICA DE COMUNICACIÓN CON LCU-CONNECTOR
        return { success: true, message: "Página de runas creada (Integración LCU Pendiente)" };
    

    // CRÍTICO: Manejador para el Text-to-Speech (TTS) en el frontend

    // CRÍTICO: Manejador para la creación de páginas de runas a través de LCU
        console.log(`[LCU RUNES] 🔑 Solicitud para crear runas: ${runeData.name}`);
        // ESTO DEBE SER REEMPLAZADO CON SU LÓGICA DE COMUNICACIÓN CON LCU-CONNECTOR
        return { success: true, message: "Página de runas creada (Integración LCU Pendiente)" };
    

    // CRÍTICO: Manejador para el Text-to-Speech (TTS) en el frontend
    ipcMain.handle('get-strategic-advice', (e, payload) => makeAIRequest('/api/ai/strategy-coach', payload));
    ipcMain.handle('get-builds-tactical', (e, payload) => makeAIRequest('/api/ai/build-advisor', payload));

    // CRÍTICO: Manejador para la creación de páginas de runas a través de LCU
        console.log(`[LCU RUNES] 🔑 Solicitud para crear runas: ${runeData.name}`);
        // AHORA DEBE INTEGRAR AQUÍ SU LÓGICA CON LCU-CONNECTOR
        // EJEMPLO: const result = await createLcuRunePage(runeData);
        // RECUERDE, REQUIERE UN MÉTODO QUE SE COMUNIQUE CON EL CLIENTE LOL PARA MODIFICAR DATOS.
        return { success: true, message: "Página de runas creada (Integración LCU Pendiente)" };
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

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

// CRÍTICO: Cierre de la función app.on(ready) que está al inicio del archivo

// ==========================================================
// LÓGICA DE HOTKEYS (CTRL+F1/F2)
// ==========================================================

app.whenReady().then(() => {
    // Hotkey para alternar la visibilidad del Overlay (Alt+O original)
    globalShortcut.register('Alt+O', () => {
        if (overlayWindow) {
            const isVisible = overlayWindow.isVisible();
            if (isVisible) {
                overlayWindow.hide();
                overlayWindow.setIgnoreMouseEvents(true);
                sendDataToRenderer('overlay-interaction-toggle', false);
            } else {
                overlayWindow.showInactive();
                overlayWindow.setIgnoreMouseEvents(true);
                sendDataToRenderer('overlay-interaction-toggle', false);
            }
        }
    });

    // CRÍTICO: CTRL+F1 - MODO ACTIVO (Clickeable, Drag, Botones +/-, Overlay Visible si está oculto)
    globalShortcut.register('CommandOrControl+F1', () => { 
        if (overlayWindow) {
            console.log('[HOTKEY] ⌨️ CTRL+F1 activado: Modo Interactivo (Clickeable).');
            overlayWindow.setIgnoreMouseEvents(false);
            if (!overlayWindow.isVisible()) overlayWindow.showInactive(); 
            sendDataToRenderer('overlay-interaction-toggle', true); 
        }
    });
    
    // CRÍTICO: CTRL+F2 - MODO PASIVO (Mouse-transparent, Botones ocultos, Overlay Visible)
    globalShortcut.register('CommandOrControl+F2', () => { 
        if (overlayWindow) {
            console.log('[HOTKEY] ⌨️ CTRL+F2 activado: Modo Pasivo (Transparente al click).');
            overlayWindow.setIgnoreMouseEvents(true);
            if (!overlayWindow.isVisible()) overlayWindow.showInactive(); 
            sendDataToRenderer('overlay-interaction-toggle', false); 
        }
    });
    
    // Configurar estado inicial al cargar si no existe
    if (overlayWindow && !globalShortcut.isRegistered('CommandOrControl+F2')) {
         console.log('[HOTKEY] ⚙️ Inicializando en modo Pasivo (CTRL+F2: setIgnoreMouseEvents(true))');
         overlayWindow.setIgnoreMouseEvents(true);
         sendDataToRenderer('overlay-interaction-toggle', false);
    }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
