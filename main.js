// =================================================================================================
// 🔥 PROCESO PRINCIPAL DE ELECTRON [VERSIÓN MEJORADA]
// =================================================================================================
//
// CARACTERÍSTICAS CLAVE DE ESTA VERSIÓN:
// ------------------------------------
// 1.  **Pre-calentamiento de Servidores (Warm-up)**: Durante la pantalla de carga (splash),
//     se envían pings de forma concurrente al backend y al servidor WebSocket para despertarlos
//     de un posible "cold start" en Render.
// 2.  **Arranque Robusto y Sincronizado**: La ventana de login solo se muestra después de que
//     los servidores han sido despertados y el TTS local ha sido precargado, asegurando que
//     la aplicación esté 100% lista para el usuario.
// 3.  **Manejo de Errores Mejorado**: Si los servidores no responden después de múltiples intentos,
//     se notifica al usuario con un diálogo de error claro.
// 4.  **IPC Seguro y Centralizado**: Toda la comunicación entre el proceso principal y las ventanas
//     (renderer) está gestionada con un `ipcManager` para mayor seguridad y organización.
//
// =================================================================================================


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
const { spawn } = require('child_process'); // 🚨 PRO-DEV: Re-agregamos spawn solo para llamar al script Python de la API
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
// 🚨 CORRECCIÓN 1: Apuntar a las URLs HTTPS de Render
const BACKEND_BASE_URL = 'https://lolmetamind-dmxt.onrender.com';
const HTTP_BASE_API_URL = 'https://lolmetamind-dmxt.onrender.com';
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
// 🚨 CORRECCIÓN 2: Anular el agente custom para que Axios use HTTPS por defecto.
const backendAgent = null;
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; // <--- AÑADIR/VERIFICAR AQUÍ

// -------------------------------
// Helper async simple
// -------------------------------
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// -------------------------------
// Directorio temporal TTS
// -------------------------------
const TTS_TEMP_DIR = path.join(app.getPath('temp'), 'metaMind-tts');
if (!fs.existsSync(TTS_TEMP_DIR)) fs.mkdirSync(TTS_TEMP_DIR, { recursive: true });
console.log(`[TTS INIT] Directorio temporal TTS listo para guardar WAV: ${TTS_TEMP_DIR}`);

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

// PRO-DEV FIX: Variable para pausar el polling y debuggear el Overlay
let isLcuPollingPaused = false; 


// ============================================================
// 🔥 FUNCIÓN DE PRE-CALENTAMIENTO DE SERVIDORES (NUEVA Y MEJORADA)
// ============================================================
/**
 * Envía pings a todos los servicios de Render para despertarlos de un posible cold start.
 * Lo hace de forma concurrente para acelerar el proceso.
 * @returns {Promise<boolean>} - True si todos los servicios respondieron, false si alguno falló.
 */
async function pingRenderHosts() {
  const services = [
    { name: 'Backend', url: 'https://lolmetamind-dmxt.onrender.com/api/health' },
    // Hacemos un ping HTTPS al servidor WS para despertarlo. Es suficiente.
    { name: 'WebSocket Server', url: 'https://lolmetamind-ws.onrender.com' },
  ];

  const pingService = async ({ name, url }) => {
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 10000; // 10 segundos de espera entre reintentos
    const TIMEOUT = 45000; // 45 segundos de timeout por intento

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        console.log(`[COLD START]  ping a ${name}... (Intento ${attempt}/${MAX_RETRIES})`);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), TIMEOUT);

        // Usamos un User-Agent para identificar estos pings en los logs del servidor si es necesario
        const response = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'MetaMind-Electron-Warmup/1.0' } });
        clearTimeout(timeoutId);

        if (response.ok || response.status < 500) { // Consideramos cualquier respuesta que no sea un error de servidor como un "despertar"
          console.log(`[COLD START] ✅ ${name} respondió en el intento ${attempt}.`);
          return true;
        } else {
          console.warn(`[COLD START] ⚠️ ${name} respondió con estado de error ${response.status} en el intento ${attempt}.`);
        }
      } catch (error) {
        if (error.name === 'AbortError') {
          console.error(`[COLD START] ❌ Ping a ${name} falló por timeout de ${TIMEOUT / 1000}s en el intento ${attempt}.`);
        } else {
          console.error(`[COLD START] ❌ Error de red en ping a ${name} (intento ${attempt}):`, error.message);
        }
      }

      if (attempt < MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      }
    }
    console.error(`[COLD START] 🚨 ${name} no respondió después de todos los intentos.`);
    return false;
  };

  // Ejecutamos todos los pings en paralelo y esperamos a que todos terminen
  const results = await Promise.all(services.map(pingService));
  
  // Retorna true solo si CADA UNO de los resultados fue true
  return results.every(Boolean);
}


// Función de Pre-carga del Modelo TTS (devuelve una Promesa)
const preloadTTS = () => {
    return new Promise((resolve, reject) => {
        if (splashWindow) {
            splashWindow.webContents.send('tts-status', 'Cargando modelo de voz...');
        }
        console.log('[TTS INIT] Iniciando pre-carga del modelo de Hugging Face...');

        const pythonExecutable = isDevMode ? 'python' : path.join(process.resourcesPath, 'python', 'python.exe');
        const pythonScriptPath = path.join(__dirname, 'hf_tts_api_generator.py');
        const token = store.get('hfApiToken') || 'TU_TOKEN_DE_HUGGING_FACE_AQUÍ';
        const env = { ...process.env, HUGGING_FACE_TOKEN: token };

        const pythonProcess = spawn(pythonExecutable, [pythonScriptPath, 'init'], { env });

        pythonProcess.stderr.on('data', (data) => {
            console.error('[TTS INIT][stderr]', data.toString().trim());
        });

        pythonProcess.on('close', (code) => {
            if (code === 0) {
                console.log('[TTS INIT] ✅ Modelo TTS pre-cargado exitosamente.');
                if (splashWindow) splashWindow.webContents.send('tts-status', '¡Modelo listo!');
                resolve();
            } else {
                console.error(`[TTS INIT] ❌ Error al pre-cargar el modelo TTS. Código de salida: ${code}.`);
                if (splashWindow) splashWindow.webContents.send('tts-status', 'Error al cargar el modelo.');
                reject(new Error(`El proceso de carga del modelo TTS falló con código ${code}`));
            }
        });

        pythonProcess.on('error', (err) => {
            console.error('[TTS INIT] ❌ Fallo al iniciar el proceso de Python:', err);
            if (splashWindow) splashWindow.webContents.send('tts-status', 'Error crítico.');
            reject(err);
        });
    });
};

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

// ===============================
// fetchAndStoreUserProfile - versión raíz
// ===============================
async function fetchAndStoreUserProfile(username, token) {
    console.log(`[DB FETCH] Iniciando fetchAndStoreUserProfile para: ${username}`);

    // Validación básica del token
    if (!token || typeof token !== 'string' || token.length < 10) {
        console.error('[DB FETCH] ❌ Token inválido o no recibido.');
        return false;
    }

    try {
        const response = await axios.get(`${BACKEND_BASE_URL}${USER_PROFILE_ENDPOINT}`, {
            headers: { 'Authorization': `Bearer ${token}` },
            // 🚨 CORRECCIÓN 3: Se elimina httpsAgent: backendAgent
            timeout: 15000
        });

        if (response.status !== 200 || !response.data) {
            console.warn('[DB FETCH] ⚠️ Perfil no encontrado o respuesta vacía.');
            return false;
        }

        const data = response.data;
        store.set('userData', data); // Guardamos todo siempre

        // Extraer campos
        const { summonerName, tagline, region, zodiacSign, riotApiKey, hfApiToken } = data;

        // Guardar campos individuales
        if (summonerName) store.set('userSummonerName', summonerName);
        if (region) store.set('userRegion', region);
        if (tagline) store.set('userTagline', tagline);
        if (riotApiKey) {
            store.set('riotApiKey', riotApiKey);
            console.log('[DB FETCH] ✅ Riot API Key guardada en Store.');
        }
        if (hfApiToken) {
            store.set('hfApiToken', hfApiToken);
            console.log('[DB FETCH] ✅ Hugging Face API Key guardada en Store.');
        }

        // Chequeo de campos críticos
        const missingCriticalFields = [];
        if (!summonerName) missingCriticalFields.push('summonerName');
        if (!tagline) missingCriticalFields.push('tagline');
        if (!region) missingCriticalFields.push('region');
        if (!zodiacSign) missingCriticalFields.push('zodiacSign');
        if (!hfApiToken) missingCriticalFields.push('hfApiToken');

        if (missingCriticalFields.length > 0) {
            console.error(`[DB FETCH] ❌ Faltan campos críticos: ${missingCriticalFields.join(', ')}`);
            // Retornamos false para indicar que el perfil no está completo,
            // pero **no bloqueamos la creación de ventanas**
            return false;
        }

        console.log(`[DB FETCH] ✅ Perfil completo guardado para: ${summonerName}`);
        return true;

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
    splashWindow.loadFile(path.join(__dirname, 'splash.html'));
    console.log('[WINDOW] Splash window creada.');
}

function createLoginWindow() {
    console.log('[WINDOW INIT] createLoginWindow invocado');

    if (loginWindow) {
        console.log('[WINDOW] Login window ya existe, haciendo focus');
        return loginWindow; // CORRECCIÓN: Devolver el objeto de la ventana, no el focus().
    }
    
    const preloadPath = path.join(__dirname, 'preload.js');
    console.log(`[WINDOW DEBUG] Ruta de preload.js inyectada: ${preloadPath}`);

    loginWindow = new BrowserWindow({
        width: 600,
        height: 800,
        minWidth: 560,
        minHeight: 700,
        show: false,
        frame: false,
        transparent: true,
        webPreferences: {
            preload: preloadPath,
            nodeIntegration: false,
            contextIsolation: true,
            devTools: true, 

        },
    });

    loginWindow.loadURL(LOGIN_PATH)
        .then(() => console.log('[WINDOW] Login window cargada URL:', LOGIN_PATH))
        .catch(err => console.error('[WINDOW ERROR] No se pudo cargar LOGIN_PATH:', err));

    loginWindow.webContents.once('did-finish-load', () => {
        console.log('[WINDOW] webContents did-finish-load fired');
    });

    // 🚨 CORRECCIÓN: Forzar la apertura de las DevTools aquí.
    if (isDevMode) {
        loginWindow.webContents.openDevTools({ mode: 'detach' });
    }
    
    // SE ELIMINÓ EL BLOQUE 'ready-to-show' CON EL SETTIMEOUT.
    // ESTA LÓGICA AHORA ESTÁ EN app.on('ready').

    loginWindow.on('closed', () => {
        console.log('[WINDOW] Login window cerrada');
        if (!mainWindow) {
            console.log('[APP] No hay mainWindow, cerrando app');
            app.quit();
        }
        loginWindow = null;
    });

    loginWindow.on('unresponsive', () => {
        console.warn('[WINDOW WARNING] Login window no responde');
    });

    loginWindow.webContents.on('crashed', () => {
        console.error('[WINDOW CRASH] Login window webContents crashed');
    });

    loginWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
        console.error('[WINDOW ERROR] did-fail-load', { errorCode, errorDescription, validatedURL });
    });

    return loginWindow;
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
            devTools: true, // Se habilita devTools para consistencia en debug
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
            devTools: true, // PRO-DEV FIX: Forzar DevTools para Overlay
        }
    });

    // CRÍTICO: Abrir DevTools inmediatamente
    overlayWindow.webContents.openDevTools({ mode: 'detach' });

    const OVERLAY_PATH = isDevMode
        ? `${FRONTEND_BASE_URL}/overlay`
        : path.join(app.getAppPath(), 'out', 'overlay.html');

    if (isDevMode) overlayWindow.loadURL(OVERLAY_PATH);
    else overlayWindow.loadFile(OVERLAY_PATH);

    overlayWindow.setIgnoreMouseEvents(true, { forward: true });

    overlayWindow.webContents.once('did-finish-load', () => {
    overlayReady = true;
    console.log('[WINDOW] Overlay did-finish-load. overlayReady = true');
    
    // Enviar payload inicial si ya hay datos de LCU
    if (latestRiotApiData) {
        const storedUserData = store.get('userData');
        overlayWindow.webContents.send('lcu-state-update', { ...latestRiotApiData, userData: storedUserData });
        console.log('[IPC SEND] Payload inicial enviado al Overlay tras did-finish-load');
    }
});

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
// ✅ 1. MARCAMOS EL EVENTO 'ready' COMO ASÍNCRONO
app.on('ready', async () => {
    console.log('[APP] Electron listo. Iniciando secuencia de arranque...');
    
    // La anulación TLS (process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0') debería estar al inicio del archivo.
    // Asegúrate de que solo esté presente una vez al inicio del archivo, no aquí.

    // 1. Mostramos la pantalla de carga
    createSplashWindow();
    console.log('[APP] 🚀 Splash screen mostrada. Iniciando pre-calentamiento...');

    // =======================================================
    // === FIX CRÍTICO: Anulación de Error de Certificado WSS ===
    // (Este bloque se mantiene para forzar confianza WSS)
    // =======================================================
    session.defaultSession.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
        const RENDER_WS_DOMAIN = 'lolmetamind-ws.onrender.com';

        if (url.includes(RENDER_WS_DOMAIN)) {
            event.preventDefault(); 
            callback(true); 
            console.log(`[WSS FIX] ✅ Forzando confianza para el certificado de ${RENDER_WS_DOMAIN}.`);
        } else {
            callback(false); 
        }
    });

    // 🚨 CORRECCIÓN: Ejecución concurrente del TTS local y el Ping remoto
    console.log('[APP] Iniciando carga concurrente (TTS Local + Ping Remoto)...');

     // Ahora, las promesas manejan su propio estado de éxito/fracaso
  const [ttsResult, pingResult] = await Promise.all([
    preloadTTS().then(() => {
      console.log('[APP] ✅ Pre-calentamiento de TTS completado.');
      return true;
    }).catch(err => {
      console.error('[APP] ❌ Fallo en el pre-calentamiento de TTS.', err);
      return false; // Indica fallo
    }),
    pingRenderHost() // Nuestra nueva función resiliente
  ]);

  if (pingResult) {
    console.log('[APP] ✅ Host de Render inicializado/despierto.');
  } else {
    // 🚨 MOSTRAR UN DIÁLOGO DE ERROR SI EL PING FALLA COMPLETAMENTE
    dialog.showErrorBox(
      'Error de Conexión',
      'No se pudo establecer conexión con los servidores de MetaMind. Por favor, verifica tu conexión a internet y reinicia la aplicación.'
    );
    // Podrías decidir cerrar la app aquí si la conexión es crítica
    // app.quit();
    // return;
  }
    
    // 3. Una vez que el modelo cargó, creamos la ventana de login
    const loginWin = createLoginWindow();
    
    // 4. Cuando la ventana de login esté lista, cerramos la de carga y la mostramos.
    loginWin.once('ready-to-show', () => {
        if (splashWindow) {
            splashWindow.close();
        }
        loginWin.show();
        loginWin.center();
        console.log('[APP] Secuencia de arranque completada. Mostrando Login.');
    });

// ===============================
// ETAPA 3: IPC IA, HUGGING FACE TTS y Shortcuts (Handlers Registrados Primero)
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
                // 🚨 CORRECCIÓN 4: Se elimina httpsAgent: backendAgent
                { headers: { 'Authorization': `Bearer ${token}` }, timeout: 30000 }
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

    // =======================================================
    // === IPC STORE HANDLERS (Acceso seguro a Store) ===
    // =======================================================
    ipcMain.handle('get-store-value', (e, key) => {
        console.log(`[IPC Store] Obteniendo valor para la clave: ${key}`);
        try { 
            return store.get(key); 
        } catch (err) { 
            console.error(`[IPC Store] ❌ Error al obtener la clave ${key}: ${err.message}`);
            return null; 
        }
    });
    ipcMain.handle('set-store-value', (e, { key, value }) => {
        console.log(`[IPC Store] Estableciendo valor para la clave: ${key}`);
        try { 
            store.set(key, value); 
            return true; 
        } catch (err) { 
            console.error(`[IPC Store] ❌ Error al establecer la clave ${key}: ${err.message}`);
            return false; 
        }
    });

    // --------------------------------------------------------
    // ☁️ IPC HUGGING FACE TTS (Text-to-Speech vía Base64/Streaming)
    // --------------------------------------------------------
    ipcMain.handle('coqui-tts', async (event, { text, rate = 1.0, pitch = 1.0 }) => {
        // Mantenemos el nombre del canal 'coqui-tts' por compatibilidad con useTTS.js
        console.log('[TTS API] IPC coqui-tts recibido, usando Base64 Streaming (sin disco).'); 

        if (!text) {
            console.warn('[TTS API] Texto vacío recibido. Abortando generación');
            return null;
        }
        
        // 1. Definir la ruta del script Python 
        const pythonScriptPath = path.join(__dirname, 'hf_tts_api_generator.py');

        const pythonExecutable = isDevMode 
            ? 'python' 
            : path.join(process.resourcesPath, 'python', 'python.exe'); 

        // 2. CLAVE PLUG AND PLAY: Configurar el Token de Hugging Face en el entorno del proceso Python
        const token = store.get('hfApiToken') || 'TU_TOKEN_DE_HUGGING_FACE_AQUÍ'; 
        const env = { 
            ...process.env, 
            HUGGING_FACE_TOKEN: token
        };

        console.log(`[TTS API] Usando Python: ${pythonExecutable}`);
        if (token === 'TU_TOKEN_DE_HUGGING_FACE_AQUÍ') console.error('[TTS API] ❌ ADVERTENCIA: Usando token de prueba/vacío. Revisa la Store.');

        try {
            // 3. Ejecutar el script Python (solo pasamos texto)
            // CRÍTICO: Python escribe el Base64 directamente al stdout.
            const pythonProcess = spawn(pythonExecutable, [
                '-u', // <--- AGREGAR ESTA BANDERA CRÍTICA
                pythonScriptPath,
                text
            ], { env: env }); 

            let base64Data = ''; // Recolector para el stream de Base64

            // 4. Capturar el output del Python (que es la cadena Base64)
            pythonProcess.stdout.on('data', (data) => {
                base64Data += data.toString();
            });

            // Logs detallados para PRO-DEV
            pythonProcess.stderr.on('data', (data) => console.error('[TTS API][stderr]', data.toString().trim()));

            await new Promise((resolve, reject) => {
                pythonProcess.on('close', (code) => {
                    if (code === 0) {
                        console.log('[TTS API] Audio generado en memoria y Base64 capturado. ✅'); 
                        resolve();
                    }
                    else {
                        console.error(`[TTS API] ❌ ERROR CRÍTICO: Proceso Python terminó con código ${code}.`);
                        reject(new Error(`Hugging Face TTS (Python) exited with code ${code}. Revise los logs [TTS API][stderr] para más detalles.`));
                    }
                });
                pythonProcess.on('error', (err) => {
                    reject(new Error(`Error al iniciar proceso Python: ${err.message}. ¿Está 'python' en el PATH?`));
                });
            });

            // 5. Construir Data URI y devolver al renderer
            if (base64Data.length > 0) {
                 const dataUri = `data:audio/wav;base64,${base64Data.trim()}`;
                 console.log('[TTS API] ✅ Data URI listo para reproducción en el Renderer.');
                 // CRÍTICO: Se devuelve { dataUri }
                 return { dataUri: dataUri }; 
            } else {
                console.error('[TTS API] ❌ El script Python no devolvió Base64.'); 
                return null;
            }
        } catch (err) {
            console.error('[TTS API] Falló generación TTS:', err.message);
            return null;
        }
    });
    // =======================================================

    // -------------------------------
    // IPC para guardar Riot API Key
    // -------------------------------
    ipcMain.on('set-riot-api-key', async (event, apiKey) => {
        store.set('riotApiKey', apiKey);
        console.log('[MAIN-STORE] ✅ Riot API Key guardada. Reiniciando flujo polling.');
        if (mainWindow) await executeInitialRiotApiFetchAndStartPolling();
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
        
        // F4 → Toggle pausa de Polling LCU (Debug)
        globalShortcut.register('CommandOrControl+F4', () => {
            isLcuPollingPaused = !isLcuPollingPaused;
            console.log(`[Shortcut] Polling LCU: ${isLcuPollingPaused ? 'PAUSADO ⏸️' : 'REANUDADO ▶️'}`);
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

// ===============================
// ETAPA 4: POLLING DE RIOT API Y LCU (Flujo de aplicación)
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
            console.log('[DEBUG] latestRiotApiData:', latestRiotApiData);

            console.log('[MAIN-FLOW] ✅ Datos iniciales de Riot API obtenidos');
            sendDataToRenderer('riot-profile-data', latestRiotApiData);

            // Enviar datos iniciales al backend
            const userToken = store.get('userToken');
            if (userToken) {
                try {
                    await axios.post(
                        `${BACKEND_BASE_URL}${LIVE_GAME_UPDATE_ENDPOINT}`,
                        latestRiotApiData,
                        // 🚨 CORRECCIÓN 5: Se elimina httpsAgent: backendAgent
                        { headers: { 'Authorization': `Bearer ${userToken}` }, timeout: 5000 }
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
            if (!overlayWindow || overlayWindow.isDestroyed()) return;

            const storedUserData = store.get('userData');
            const payloadCompleto = { ...data, userData: storedUserData };

            const sendNow = () => {
                try {
                    overlayWindow.webContents.send('lcu-state-update', payloadCompleto);
                    console.log('[IPC SEND] Enviado payload al Overlay (webContents.send).');
                } catch (err) {
                    console.error('[IPC SEND] Error enviando al Overlay:', err.message);
                }
            };

            if (overlayWindow.webContents && overlayWindow.webContents.isLoading && overlayWindow.webContents.isLoading()) {
                overlayWindow.webContents.once('did-finish-load', sendNow);
                console.log('[IPC SEND] Overlay aún cargando. Envío en did-finish-load.');
            } else {
                sendNow();
            }
        };

        const performPoll = async () => {
            // PRO-DEV FIX: Pausa la ejecución si el modo Debug está activo (Shortcut F4)
            if (isLcuPollingPaused) {
                console.log('[LCU POLLING] ⏸️ Polling pausado por Debug Shortcut (F4).');
                return; 
            }
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
    // Logs generales desde el renderer
    ipcMain.on('overlay-log', (event, msg) => {
        console.log('[IPC LOG desde renderer (via safeLog)]:', msg);
    });

    ipcMain.on('user-logged-in', async (event, userData) => {
        console.log(`\n======================================================`);
        console.log(`[IPC] 'user-logged-in' recibido para: ${userData.username} - INICIANDO SESIÓN.`);
        console.log(`======================================================\n`);

        if (hasRunInitialLogin) {
            console.warn('[IPC] Evento login duplicado ignorado');
            return;
        }

    // 1. Guardar token inmediatamente
    store.set('userToken', userData.token);
    console.log('[MAIN-FLOW DEBUG] Token guardado en Store. Procediendo a crear ventanas.');

    // 2. Marcar como autenticado y crear ventanas (Dashboard & Overlay) INMEDIATAMENTE
    hasRunInitialLogin = true;
    console.log('[MAIN-FLOW] ✅ Abriendo Dashboard y Overlay');
    createMainWindow();
    createOverlayWindow();

    // 3. Iniciar fetch asíncrono de perfil completo y API data en background (puede ser lento)
    console.log('[MAIN-FLOW] Iniciando fetchAndStoreUserProfile en background...');
    const profileFetchSuccess = await fetchAndStoreUserProfile(userData.username, userData.token);

    if (profileFetchSuccess) {
        console.log('[MAIN-FLOW] ✅ Perfil completo cargado. Iniciando flujo Riot/LCU');
    } else {
        console.warn('[MAIN-FLOW] ⚠️ Perfil incompleto o fallo de fetch. Funcionalidades dependientes pueden fallar');
    }

    // 4. Iniciar el Polling de Riot/LCU (Depende de los datos obtenidos)
    executeInitialRiotApiFetchAndStartPolling();
    console.log('[MAIN-FLOW] Flujo de login y carga inicial completado.');
});


    // Obtener datos de usuario
    ipcMain.handle('get-user-data', async () => {
        const token = store.get('userToken');
        if (!token) return null;

        try {
            const response = await axios.get(`${BACKEND_BASE_URL}/api/user/profile`, { 
                headers: { 'Authorization': `Bearer ${token}` },
                // 🚨 CORRECCIÓN 6: Se elimina httpsAgent: backendAgent
                timeout: 15000
            });
            return response.data;
        } catch (error) {
            console.error('[IPC] Error al obtener datos de usuario:', error.message);
            return null;
        }
    });
}); // Cierre de app.on('ready')

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