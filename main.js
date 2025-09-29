// main.js - VERSIÓN COMPLETA Y FINAL

const { app, BrowserWindow, globalShortcut, screen, ipcMain, session } = require('electron');
const path = require('path');
const axios = require('axios');
const { shell } = require('electron');
const Store = require('electron-store');
const https = require('https');
const { fetchAndSendLcuData } = require('./lol-client-api'); // Asegúrate que este archivo exista
const WebSocket = require('ws'); // Asegúrate de tener 'ws' instalado

let wsClient; // Cliente WebSocket para LCU
const store = new Store();
let pollingInterval = null;
let hasRunInitialLogin = false; // Bandera para el guard de login

const isDevMode = !!process.defaultApp;

// Desactiva la validación de certificados (útil para desarrollo con certificados auto-firmados)
app.commandLine.appendSwitch('ignore-certificate-errors');
// Deshabilita la aceleración de hardware para evitar problemas de renderizado en algunas GPUs
app.disableHardwareAcceleration();

let mainWindow;
let splashWindow;
let overlayWindow; // Ventana para el overlay en juego

// Configuración de URLs del backend
const USE_LOCAL_BACKEND = true; // Cambiar a false si usas un backend remoto en producción
const HTTP_BASE_API_URL = 'http://localhost:3000'; // URL de tu backend HTTP
const WS_BASE_URL = 'ws://localhost:8080'; // URL de tu servidor WebSocket (si lo usas)
const BACKEND_BASE_URL = HTTP_BASE_API_URL; // Alias principal para el backend HTTP

// Endpoints específicos de tu backend
const LIVE_GAME_UPDATE_ENDPOINT = '/api/live-game/update';
const USER_PROFILE_ENDPOINT = '/api/user/profile';

// Rutas para las vistas del frontend (Next.js)
const INDEX_PATH = isDevMode ? 'http://localhost:3001' : `file://${path.join(__dirname, 'out', 'index.html')}`;
const OVERLAY_PATH = isDevMode ? 'http://localhost:3001/overlay' : `file://${path.join(__dirname, 'out', 'overlay.html')}`;

// Agente HTTPS para ignorar certificados auto-firmados en llamadas al backend
const backendAgent = new https.Agent({ rejectUnauthorized: false });

// Función de utilidad para retrasos
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
                store.set('userData', response.data);
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

/**
 * Crea la ventana de splash (carga inicial).
 */
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

/**
 * Crea la ventana principal de la aplicación (el dashboard).
 */
function createMainWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 1280,
        minHeight: 800,
        show: false, // Ocultar hasta que esté lista
        frame: false,
        transparent: true,
        backgroundColor: '#00000000', // Fondo transparente
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
        },
    });

    mainWindow.loadURL(INDEX_PATH);

    // Muestra la ventana principal después de que el splash termine
    mainWindow.once('ready-to-show', () => {
        setTimeout(() => {
            if (splashWindow) {
                splashWindow.close();
            }
            mainWindow.show();
            mainWindow.center();
        }, 3000); // 3 segundos de splash
    });
    
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
    // Solo para desarrollo: abrir DevTools
    if (isDevMode) {
        mainWindow.webContents.openDevTools();
    }
}

/**
 * Crea la ventana de overlay (para mostrar información en juego).
 */
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
    overlayWindow.setIgnoreMouseEvents(true); // Permite clics a través del overlay
    overlayWindow.hide(); // Ocultar por defecto

    overlayWindow.on('closed', () => (overlayWindow = null));
}

/**
 * Inicia la conexión WebSocket para LCU.
 * (Esta función parece haber sido comentada en tus logs, pero se mantiene aquí por completitud)
 */
function setupWebSocketClient() {
    if (wsClient) {
        wsClient.close();
    }
    wsClient = new WebSocket(WS_BASE_URL);

    wsClient.onopen = () => console.log('[WS] Conectado al servidor WebSocket');
    wsClient.onmessage = (event) => {
        console.log('[WS] Mensaje recibido:', event.data);
        // Aquí puedes procesar los mensajes del backend WebSocket
        // y enviarlos al frontend si es necesario.
    };
    wsClient.onerror = (error) => console.error('[WS] Error WebSocket:', error);
    wsClient.onclose = () => console.log('[WS] Conexión WebSocket cerrada');
}


/**
 * Inicia el polling para datos de LCU y Riot API.
 * Llama a fetchAndSendLcuData (que debe estar en lol-client-api.js).
 */
function startLiveGamePolling() {
    if (pollingInterval) clearInterval(pollingInterval);
    pollingInterval = setInterval(async () => {
        console.log('[LCU POLLING] 🏃‍♀️ Ejecutando rutina de Polling...');
        // Asegúrate de que fetchAndSendLcuData reciba la clave API de Riot
        // desde store.get('riotApiKey') dentro de lol-client-api.js
        await fetchAndSendLcuData(BACKEND_BASE_URL, LIVE_GAME_UPDATE_ENDPOINT, store.get('riotApiKey'));
    }, 15000); // Cada 15 segundos
    console.log('[LCU POLLING] 🟢 LCU Polling Iniciado.');
}

/**
 * Detiene el polling.
 */
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

    // --- IPC para control de ventana ---
    ipcMain.on('closeWindow', () => {
        app.quit();
    });
    ipcMain.on('minimizeWindow', () => {
        mainWindow?.minimize();
    });

    // --- IPC para autenticación y datos de usuario ---
    ipcMain.on('user-logged-in', async (event, userData) => {
        if (hasRunInitialLogin) {
            console.warn(`[IPC RECEPCIÓN] ⚠️ Evento de login duplicado para ${userData.username} ignorado.`);
            return;
        }
        hasRunInitialLogin = true; 

        console.log(`[IPC RECEPCIÓN] ✅ EVENTO RECIBIDO. Usuario: ${userData.username}. INICIANDO PROCESOS POST-LOGIN.`);

        store.set('userToken', userData.token);
        console.log('[IPC RECEPCIÓN] Token de usuario guardado en el store.');

        // CRÍTICO: El AWAIT asegura que el perfil se intente obtener antes de iniciar el polling.
        const profileFetchSuccess = await fetchAndStoreUserProfile(userData.username, userData.token);

        // SOLO SI TUVIMOS ÉXITO AL OBTENER EL PERFIL, INICIAMOS EL POLLING
        if (profileFetchSuccess) {
            startLiveGamePolling();
        } else {
            console.error('[IPC RECEPCIÓN] ⚠️ No se pudo obtener el perfil del usuario. No se iniciará el polling de LCU/Riot API.');
        }

        if (mainWindow && !mainWindow.isDestroyed()) {
             // Reactivar eventos de ratón para el Dashboard después de la carga inicial
             mainWindow.setIgnoreMouseEvents(false);
             console.log('[IPC RECEPCIÓN] 🖱️ Reactivando eventos de ratón para el Dashboard. Clics y arrastre habilitados.');
        }
    });

    ipcMain.handle('get-user-data', async (event) => {
        const userData = store.get('userData');
        console.log('[IPC Handle] Sirviendo userData al frontend:', JSON.stringify(userData ? { summonerName: userData.summonerName, username: userData.username } : 'no data', null, 2));
        return userData;
    });

    // --- IPC para la configuración de la clave API de Riot ---
    ipcMain.on('set-riot-api-key', (event, apiKey) => {
        store.set('riotApiKey', apiKey);
        console.log(`[MAIN STORE] ✅ Clave API Riot guardada.`);
        // Reiniciar polling para que la nueva clave se aplique inmediatamente.
        stopLiveGamePolling();
        startLiveGamePolling();
    });

    // --- IPC para llamadas a la IA (a través de tu backend) ---
    // Estas llamadas actúan como un proxy seguro hacia tu backend
    const makeAIRequest = async (endpoint, payload = {}) => {
        const token = store.get('userToken');
        if (!token) {
            console.error(`[AI Request] Error: Usuario no autenticado para ${endpoint}`);
            return { error: 'Usuario no autenticado. Por favor, inicia sesión.' };
        }

        try {
            const response = await axios.post(`${BACKEND_BASE_URL}${endpoint}`, payload, {
                headers: { 'Authorization': `Bearer ${token}` },
                httpsAgent: backendAgent, // Usar el agente para certificados
                timeout: 30000 // Aumenta el timeout para respuestas de IA
            });
            return response.data;
        } catch (error) {
            console.error(`[AI Request Error] en ${endpoint}:`, error.message);
            // Si el backend responde con un error 4xx o 5xx, intenta enviar el mensaje de error del backend
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
    // setupWebSocketClient(); // Comentado según tu configuración original, descomentar si lo usas
    createOverlayWindow(); // Crea la ventana de overlay al inicio
});

// Cuando todas las ventanas estén cerradas, la app se cierra (excepto en macOS)
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        stopLiveGamePolling(); // Detener el polling al cerrar la app
        app.quit();
    }
});

// En macOS, la app permanece activa hasta que el usuario la cierra explícitamente con Cmd + Q
app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
    }
});

// --- Manejo de Atajos Globales (Ejemplo: Abrir/Cerrar Overlay) ---
app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.whenReady().then(() => {
    // Ejemplo: Atajo para alternar el overlay (Alt+O)
    globalShortcut.register('Alt+O', () => {
        if (overlayWindow) {
            if (overlayWindow.isVisible()) {
                overlayWindow.hide();
                overlayWindow.setIgnoreMouseEvents(true);
            } else {
                overlayWindow.showInactive(); // Muestra sin quitar el foco del juego
                overlayWindow.setIgnoreMouseEvents(false); // Permite interacción con el overlay si es necesario
            }
        }
    });
});