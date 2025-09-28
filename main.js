// main.js

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
let hasRunInitialLogin = false; // Bandera para el guard

const isDevMode = !!process.defaultApp; 

app.commandLine.appendSwitch('ignore-certificate-errors');
app.disableHardwareAcceleration();

let mainWindow;
let splashWindow;
let overlayWindow;

// TUS VARIABLES ORIGINALES:
const USE_LOCAL_BACKEND = process.env.DEBUG_BACKEND_LOCAL === 'true';

// La URL base para todas las llamadas API es el puerto 3000.
const HTTP_BASE_API_URL = 'http://localhost:3000'; 
const WS_BASE_URL = 'ws://localhost:8080'; 
const BACKEND_BASE_URL = isDevMode ? HTTP_BASE_API_URL : 'https://lolmetamind-dmxt.onrender.com';

const LIVE_GAME_UPDATE_ENDPOINT = '/api/live-game/update';
const USER_PROFILE_ENDPOINT = '/api/user/profile'; // Endpoint de su Backend para obtener perfil completo

// 🚨 CLAVE: La INTERFAZ de Electron carga desde el puerto 3001.
const INDEX_PATH = isDevMode ? 'http://localhost:3001' : `file://${path.join(__dirname, 'out', 'index.html')}`; 
const OVERLAY_PATH = isDevMode ? 'http://localhost:3001/overlay' : `file://${path.join(__dirname, 'out', 'overlay.html')}`; 

// Agente HTTPS para el backend
const backendAgent = new https.Agent({ rejectUnauthorized: false });

// 🔑 CLAVE: Helper function para crear un delay (SOLUCIONA EL REFERENCEERROR)
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * 🔑 CLAVE: Obtiene el perfil completo del usuario (Invocador, Tagline, Región) desde la DB.
 * Implementa hasta 2 intentos para manejar fallos transitorios.
 */
async function fetchAndStoreUserProfile(username, token) {
    
    if (!token || typeof token !== 'string' || token.length < 10) {
        console.error('[DB FETCH] ❌ Falla Crítica: Token inválido o no recibido. Saltando fetch.');
        return; 
    }

    store.set('userToken', token);
    
    // ----------------------------------------------------
    // 🔑 LÓGICA DE REINTENTO
    // ----------------------------------------------------
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

            // Si el status es 200, procede. Si es 404 (incompleto), lo manejamos aquí.
            if (response.status === 200 && response.data.summonerName && response.data.tagline && response.data.region) {
                const { summonerName, tagline, region } = response.data; 
                
                store.set('userSummonerName', summonerName);
                store.set('userTagline', tagline);
                store.set('userRegion', region);
                console.log(`[DB FETCH] ✅ Perfil completo guardado: ${summonerName}#${tagline} en ${region}.`);
                return; // Éxito total: salir de la función
            } else if (response.status === 404 || response.data?.message?.includes('incompleto')) {
                // Si la respuesta es 404 (o incompleta), asumimos que la data no existe.
                 console.warn(`[DB FETCH] ⚠️ Perfil incompleto o no encontrado en la DB. Falla permanente.`);
                 return; 
            }
            
        } catch (error) {
            // Captura errores 401, 500, o fallos de red.
            console.error(`[DB FETCH] ❌ Fallo (Intento ${attempt}): ${error.message}`);

            // Solo reintentamos si no es el último intento.
            if (attempt < MAX_ATTEMPTS) {
                console.log(`[DB FETCH] Esperando 1.5s antes de reintentar...`);
                await delay(1500); 
            } else {
                console.error(`[DB FETCH] ❌ Fallo definitivo tras ${MAX_ATTEMPTS} intentos.`);
            }
        }
    }
}

function createSplashWindow() {
    console.log('[MAIN] -> Creada Splash Window.'); 
    splashWindow = new BrowserWindow({
        width: 400,
        height: 400,
        transparent: true,
        frame: false,
        alwaysOnTop: true,
        center: true,
        backgroundColor: '#00000000', 
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
    console.log('[MAIN] -> Creando Main Window.'); 
    mainWindow = new BrowserWindow({
        width: 500,    
        height: 720,
        minWidth: 500, 
        minHeight: 720,
        show: false, 
        frame: false, 
        transparent: true, 
        backgroundColor: '#00000000', 
        
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            //webSecurity: !isDevMode 
        },
    });

    mainWindow.loadURL(INDEX_PATH);
    console.log(`[MAIN] -> Modo Dev detectado: ${isDevMode}.`);
    console.log(`[MAIN] -> Main Window cargando URL: ${INDEX_PATH}`); 

    // 🚨 MANEJO DE LA TRANSICIÓN SPLASH -> MAIN
    mainWindow.once('ready-to-show', () => {
        console.log('[MAIN] -> Main Window lista para mostrar. Iniciando timeout.'); 
        setTimeout(() => {
            if (splashWindow) {
                splashWindow.close(); 
                splashWindow = null;
            }
            mainWindow.show();
            mainWindow.center();
            /*if (isDevMode) { 
                mainWindow.webContents.openDevTools();
            }*/
        }, 4000); 
    });
    
    mainWindow.on('closed', () => {
        mainWindow = null;
        if (overlayWindow) { overlayWindow.close(); overlayWindow = null; }
    });
}

function createOverlayWindow() {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
        overlayWindow.focus();
        return;
    }
    
    overlayWindow = new BrowserWindow({
        width: 400,
        height: 150,
        x: 100, 
        y: 100,
        transparent: true,
        frame: false,
        alwaysOnTop: true,
        skipTaskbar: true,
        show: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: !isDevMode
        }
    });

    overlayWindow.loadURL(OVERLAY_PATH);
    overlayWindow.setIgnoreMouseEvents(true); 
    
    overlayWindow.on('closed', () => (overlayWindow = null));
}


// --- LÓGICA COMPLETA DE WEBSOCKETS (RESTAURADA) ---
function setupWebSocketClient() {
    if (wsClient) { wsClient.close(1000, 'Reconnecting'); }
    wsClient = new WebSocket(WS_BASE_URL); 

    wsClient.on('open', () => {
        console.log('WebSocket conectado a:', WS_BASE_URL);
    });

    wsClient.on('message', (data) => {
        const message = data.toString();
        if (mainWindow) {
            mainWindow.webContents.send('ws-message', message);
        }
    });

    wsClient.on('close', () => { 
        console.log('WebSocket desconectado. Reconectando en 5s...'); 
        setTimeout(setupWebSocketClient, 5000);
    });

    wsClient.on('error', (error) => {
        console.error('Error de WebSocket:', error.message);
    });
}

// --- LÓGICA DE LIVE GAME POLLING ---
function startLiveGamePolling() {
    if (pollingInterval) clearInterval(pollingInterval);
    
    pollingInterval = setInterval(async () => {
        console.log('[LCU POLLING] 🏃‍♀️ Ejecutando rutina de Polling de LCU/Riot API/Estratégico...');
        await fetchAndSendLcuData(BACKEND_BASE_URL, LIVE_GAME_UPDATE_ENDPOINT);
        
    }, 5000); 
    
    console.log('[LCU POLLING] 🟢 LCU Polling Iniciado. (Intervalo 5s).');
}

function stopLiveGamePolling() {
    if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
        console.log('[LCU POLLING] 🛑 LCU Polling Detenido.');
    }
}


// =========================================================================
// MANEJO DE EVENTOS IPC (Control de Ventana y Login)
// =========================================================================

// 🚨 CORRECCIÓN IPC: Cierre de ventana
ipcMain.on('closeWindow', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.close();
    } else {
        app.quit(); // Si mainWindow ya se cerró, cierra la aplicación
    }
});
// 🚨 CORRECCIÓN IPC: Minimizar ventana
ipcMain.on('minimizeWindow', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.minimize();
    }
});

// 🔑 NUEVO LISTENER: Para guardar la clave API desde el Dashboard.
ipcMain.on('set-riot-api-key', (event, apiKey) => {
    store.set('riotApiKey', apiKey);
    console.log(`[MAIN STORE] ✅ Clave API Riot guardada.`);
    // Opcional: reiniciar el polling para probar la nueva clave inmediatamente.
    // if (pollingInterval) startLiveGamePolling();
});


// ----------------------------------------------------
// INICIO DEL CICLO DE VIDA DE LA APLICACIÓN
// ----------------------------------------------------

console.log('[MAIN] -> INICIO DEL PROCESO: Cargando Electron'); 
app.on('ready', () => {
    console.log('[MAIN] -> APP READY. Creando ventanas y registrando IPC...'); 
    
    // 🔑 CLAVE 3: Registro del Listener IPC post-login
    console.log(`[MAIN] -> Registrando listener IPC 'user-logged-in'...`);
    ipcMain.on('user-logged-in', async (event, userData) => {
        // 🔑 GUARDIA PERMANENTE: Si ya corrimos el flujo una vez, ignoramos el segundo.
        if (hasRunInitialLogin) {
            console.warn(`[IPC RECEPCIÓN] ⚠️ Evento de login duplicado para ${userData.username} ignorado.`);
            return;
        }
        hasRunInitialLogin = true; // Activar bandera permanentemente

        console.log(`[IPC RECEPCIÓN] ✅ EVENTO RECIBIDO. Usuario: ${userData.username}. INICIANDO PROCESOS POST-LOGIN.`);
        
        // 1. Guardar el token REAL en el store para el polling (Este es el que funciona, longitud 167)
        store.set('userToken', userData.token); 

        // 2. Fetch de datos completos del invocador y guardarlos en el store
        // CRÍTICO: El AWAIT asegura que el perfil se intente obtener antes de iniciar el polling.
        await fetchAndStoreUserProfile(userData.username, userData.token); 
        
        // 3. Iniciar el Polling (Ahora con el token REAL en el store)
        startLiveGamePolling();
    });


    // 1. Inicia el Splash
    createSplashWindow();
    
    // 2. Crea la ventana principal (oculta)
    createMainWindow(); 
    
    // setupWebSocketClient();
});

app.on('window-all-closed', () => { 
    if (process.platform !== 'darwin') { 
        stopLiveGamePolling(); 
        app.quit(); 
    } 
});

app.on('activate', () => { if (mainWindow === null) { createMainWindow(); } });