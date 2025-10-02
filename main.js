// main.js - VERSIÓN COMPLETA Y DEFINITIVA (FIX DE FOCO, Z-ORDER Y LÓGICA DE APP.ON('READY'))

const { app, BrowserWindow, globalShortcut, screen, ipcMain, session } = require('electron');
const { powerSaveBlocker } = require('electron');

const path = require('path');
const axios = require('axios');
const Store = require('electron-store');
const store = new Store();
const https = require('https');
const { fetchRiotApiData, pollLcuDataAndSend, sendLcuCommand, getLcuCredentials } = require('./lol-client-api'); 

app.setPath('userData', path.join(__dirname, 'electron_data'));

let mainWindow; // Dashboard Window (Grande, Opaca)
let loginWindow; // Login Window (Pequeña, Opaca/Transparente, fondo dado por React)
let splashWindow; // Splash HTML Window (Pequeña, Transparente)

let pollingInterval = null;
let hasRunInitialLogin = false;
let latestRiotApiData = null;
let overlayWindow; // Ventana para el Coach/Overlay (Transparente, sin foco)

const isDevMode = !!process.defaultApp;

app.commandLine.appendSwitch('ignore-certificate-errors');
app.disableHardwareAcceleration();

// --- URLs y Endpoints (CORREGIDO) ---
// El backend de Next.js corre en el puerto 3001 según tu package.json
const HTTP_BASE_API_URL = 'http://localhost:3001';
// 1. El BACKEND (donde viven tus APIs como /api/user/profile) está en el puerto 3000.
const BACKEND_BASE_URL = 'http://localhost:3000';
// 2. El FRONTEND (donde viven tus páginas de React/Next.js) está en el puerto 3001.
const FRONTEND_BASE_URL = 'http://localhost:3001';
// 3. Los endpoints de la API se definen por separado.
const LIVE_GAME_UPDATE_ENDPOINT = '/api/live-game/update';
const USER_PROFILE_ENDPOINT = '/api/user/profile';
// 4. Las RUTAS a las páginas de la aplicación deben apuntar al FRONTEND_BASE_URL (puerto 3001).
//    Se ha añadido la sintaxis correcta con backticks (`).
const INDEX_PATH = isDevMode ? `${FRONTEND_BASE_URL}/dashboard` : `file://${path.join(__dirname, 'out', 'dashboard', 'index.html')}`;
const LOGIN_PATH = isDevMode ? `${FRONTEND_BASE_URL}` : `file://${path.join(__dirname, 'out', 'index.html')}`;

const backendAgent = new https.Agent({ rejectUnauthorized: false });
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));


function sendDataToRenderer(channel, data) {
    // ✅ MEJORA: Añadida la comprobación !isDestroyed() por consistencia
    if (mainWindow && !mainWindow.isDestroyed()) {
        console.log(`[IPC SEND] Enviando al canal '${channel}'.`);
        mainWindow.webContents.send(channel, data);
    }
}

// main.js

async function fetchAndStoreUserProfile(username, token) {
    console.log(`[DB FETCH] 🔍 Iniciando fetchAndStoreUserProfile para: ${username}`);
    if (!token || typeof token !== 'string' || token.length < 10) {
        console.error('[DB FETCH] ❌ Falla Crítica: Token inválido o no recibido.');
        return false;
    }

    try {
        // 🚨 CORRECCIÓN CLAVE: Se elimina la propiedad 'params'.
        // Tu API de backend (`/api/user/profile/route.js`) está diseñada para
        // identificar al usuario a través del token JWT en la cabecera 'Authorization',
        // no a través de un parámetro de URL. Al quitar 'params', la petición
        // ahora coincide con lo que tu API espera.
        const response = await axios.get(`${BACKEND_BASE_URL}${USER_PROFILE_ENDPOINT}`, {
            headers: { 'Authorization': `Bearer ${token}` },
            // params: { username: username }, // <-- ESTA LÍNEA HA SIDO ELIMINADA
            httpsAgent: backendAgent,
            timeout: 15000
        });

        if (response.status === 200 && response.data) {
            const data = response.data;
            
            const summonerName = data.summonerName; 
            const tagline = data.tagline;
            const region = data.region;
            
            if (!summonerName || !tagline || !region || !data.zodiacSign) {
                 console.error('[DB FETCH] ❌ Datos de Riot/IA incompletos en la respuesta del backend.');
                 store.set('userData', data);
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
        show: false, // Empieza oculta
        frame: false,
        transparent: true, // Vuelve a ser transparente
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
        },
    });
    
    loginWindow.loadURL(LOGIN_PATH); 

    // Esta es la lógica original que funcionaba: espera a que la ventana esté lista,
    // espera a que termine el splash, y luego la muestra.
    loginWindow.once('ready-to-show', () => {
        const splashDuration = 3000; 
        
        setTimeout(() => {
            if (splashWindow) splashWindow.close();
            loginWindow.show();
            loginWindow.center();
            console.log("[MAIN] ✅ Login Window mostrada.");
        }, splashDuration);
    });

    loginWindow.on('closed', () => {
        if (!mainWindow) {
            app.quit(); 
        }
        loginWindow = null;
    });
}

// --- FUNCIÓN PARA CREAR LA VENTANA DEL OVERLAY ---
function createOverlayWindow() {
    if (overlayWindow) return;

    // Obtener las dimensiones de la pantalla principal
    const primaryDisplay = screen.getPrimaryDisplay();

    overlayWindow = new BrowserWindow({
        title: 'MetaMind Coach Overlay',
        width: primaryDisplay.workAreaSize.width,
        height: primaryDisplay.workAreaSize.height,
        transparent: true,
        frame: false,
        hasShadow: false,
        alwaysOnTop: true,

        // 🚨 LA LÍNEA MÁGICA QUE SOLUCIONA EL PROBLEMA VISUAL 🚨
        // 'screen-saver' es un nivel de apilamiento especial que se asegura
        // de que esta ventana se renderice por encima de las ventanas de aplicaciones normales.
        level: 'floating',

        fullscreen: true,
        skipTaskbar: true,
        resizable: false,
        show: false,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    // 🚨 2. SOLUCIÓN DE RUTA: Apunta al puerto correcto (3001) para el modo desarrollo
    const OVERLAY_PATH = isDevMode ? `${FRONTEND_BASE_URL}/overlay` : path.join(app.getAppPath(), 'out', 'overlay.html');

    if (isDevMode) {
        overlayWindow.loadURL(OVERLAY_PATH);
         // 🚨 ESTE ES EL CÓDIGO MÁS IMPORTANTE AHORA 🚨
        // Abre las herramientas de desarrollador para la ventana del overlay en una ventana separada.
        overlayWindow.webContents.openDevTools({ mode: 'detach' });
    } else {
        overlayWindow.loadFile(OVERLAY_PATH);
    }

    // Por defecto, la ventana ignora los clics del ratón (click-through)
    overlayWindow.setIgnoreMouseEvents(true, { forward: true });

    overlayWindow.once('ready-to-show', () => {
        overlayWindow.show();
        console.log('[Electron] Overlay Window creado y listo.');
    });

    overlayWindow.on('closed', () => {
        overlayWindow = null;
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

    // 🚨 1. LA LÓGICA AHORA ESTÁ AQUÍ 🚨
    // Esta función se encarga de enriquecer los datos del juego con los datos del usuario.
    const overlayIpcSender = (data) => {
        // Verificamos si la ventana del overlay existe y está lista
        if (overlayWindow && !overlayWindow.isDestroyed() && overlayWindow.webContents) {
            
            // Obtenemos los datos del usuario guardados en el store en este preciso momento.
            const storedUserData = store.get('userData');

            // Creamos un nuevo paquete de datos (payload) que combina ambas informaciones.
            const payloadCompleto = {
                ...data, // Esto incluye lcuStatus, gamePhase, draftData
                userData: storedUserData // ¡Añadimos el usuario al paquete!
            };

            // Enviamos el paquete completo al overlay.
            console.log('[IPC SEND] Enviando payload completo al OVERLAY...');
            overlayWindow.webContents.send('lcu-state-update', payloadCompleto); 
        }
    };

    const performPoll = async () => {
        try {
            if (!latestRiotApiData) {
                console.warn('[LCU POLLING] ⚠️ No hay datos base de Riot API. Deteniendo polling LCU.');
                stopLiveGamePolling();
                return;
            }
            
            // 🚨 2. LA LLAMADA SE MANTIENE IGUAL 🚨
            // Le pasamos nuestra nueva y más inteligente función 'overlayIpcSender'.
            await pollLcuDataAndSend(
                latestRiotApiData,
                BACKEND_BASE_URL,
                LIVE_GAME_UPDATE_ENDPOINT,
                (data) => sendDataToRenderer('riot-profile-data', data), // La función para el dashboard (sin cambios)
                overlayIpcSender // La función para el overlay (ahora enriquecida)
            );
        } catch (error) {
            console.error(`[LCU POLLING] ❌ Error en un ciclo de sondeo, el siguiente ciclo continuará. Error: ${error.message}`);
        }
    };
    
    performPoll(); // Ejecutar la primera vez
    
    // 🚨 3. (OPCIONAL PERO RECOMENDADO) VELOCIDAD DE SONDEO 🚨
    // Cambiado a 3 segundos para una mayor reactividad.
    pollingInterval = setInterval(performPoll, 3000); 
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

    // =================================================================
    //  क्षेत्र MANEJADORES DE IPC GLOBALES (LOGIN, CIERRE, ETC.)
    // =================================================================

    // 1. Escucha la orden de cerrar la aplicación desde el LoginScreen
    ipcMain.on('close-app', () => {
        console.log('[MAIN] Recibida orden para cerrar la aplicación.');
        app.quit();
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
            createOverlayWindow(); 
            
            // 2. INICIAR EL POLLING CON DELAY
            setTimeout(() => {
                 console.log('[MAIN-FLOW] Retardo de 1.5s completado. Iniciando flujo de datos Riot/LCU.');
                 executeInitialRiotApiFetchAndStartPolling();
                 
            }, 1500);
        } else {
            console.error('[MAIN-FLOW] ❌ Fallo al obtener perfil. Permanece en Login.');
        }
    });

    ipcMain.handle('get-user-data', async () => {
        console.log('[MAIN] El Dashboard está pidiendo los datos del usuario.');
        const token = store.get('userToken');
        if (!token) {
            console.error('[MAIN] No se encontró token para get-user-data');
            return null;
        }
        try {
            // NOTA: Asegúrate de que tu backend tenga una ruta como '/api/user/me' o '/api/user/profile'
            // que devuelva los datos del usuario usando el token.
            const response = await axios.get(`${BACKEND_BASE_URL}/api/user/profile`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            console.log('[MAIN] Datos de usuario obtenidos con éxito.');
            return response.data;
        } catch (error) {
            console.error('[MAIN] Error al obtener datos del usuario desde el backend:', error.message);
            return null;
        }
    });

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


    // 🚨 NUEVO HANDLER: Comando LCU genérico para inyección de runas 🚨
    ipcMain.handle('lcu-command', async (event, method, endpoint, payload) => {
        try {
            // Asumo que tiene una función para obtener las credenciales LCU
            const creds = getLcuCredentials(); // Función que lee el lockfile
            
            if (!creds) {
                return { error: 'LCU CORE OFFLINE. Inyección fallida.' };
            }
            
            // Ejecuta el comando real en su lol-client-api.js
            const result = await sendLcuCommand(creds, method, endpoint, payload);
            
            return { success: result };
        } catch (error) {
            // Manejo de errores de su lol-client-api.js (ej. 404, 500, timeout)
            const errorMessage = error.message || 'Error desconocido en el Core LCU.';
            console.error(`[LCU COMMAND FAIL] Error al ejecutar comando: ${errorMessage}`);
            return { error: `Comando LCU fallido: ${errorMessage}` };
        }
    });
    ipcMain.handle('get-meta-analysis', (e, payload) => makeAIRequest('/api/ai/get-meta', payload));
    ipcMain.handle('get-recommendations', (e, payload) => makeAIRequest('/api/ai/get-recommendations', payload));
    ipcMain.handle('get-weekly-challenges', (e, payload) => makeAIRequest('/api/ai/get-weekly-challenges', payload));
    ipcMain.handle('analyze-matches', (e, payload) => makeAIRequest('/api/ai/analyze-matches', payload));
    ipcMain.handle('get-strategic-advice', (e, payload) => makeAIRequest('/api/ai/strategy-coach', payload));
    ipcMain.handle('get-live-coaching', (e, payload) => makeAIRequest('/api/ai/live-coach', payload));


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

});