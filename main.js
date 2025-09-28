// main.js

const { app, BrowserWindow, globalShortcut, screen, ipcMain, session } = require('electron');
const path = require('path');
const axios = require('axios');
const { shell } = require('electron');
const Store = require('electron-store');
const { fetchAndSendLcuData } = require('./lol-client-api'); // Asumiendo que esta función existe
const WebSocket = require('ws');

let wsClient;
const store = new Store(); // Asumiendo que Store fue importado correctamente
let pollingInterval = null;
const isDev = process.env.NODE_ENV === 'development';
app.commandLine.appendSwitch('ignore-certificate-errors');
app.disableHardwareAcceleration();

let mainWindow;
let splashWindow;
let overlayWindow;

// TUS VARIABLES ORIGINALES:
const USE_LOCAL_BACKEND = process.env.DEBUG_BACKEND_LOCAL === 'true';
const HTTP_BASE_URL = USE_LOCAL_BACKEND ? 'http://localhost:3000' : 'https://lolmetamind-dmxt.onrender.com';
const WS_BASE_URL = USE_LOCAL_BACKEND ? 'ws://localhost:8080' : 'wss://lolmetamind-ws.onrender.com';
const BACKEND_BASE_URL = HTTP_BASE_URL;
const LIVE_GAME_UPDATE_ENDPOINT = '/api/live-game/update';

const INDEX_PATH = isDev ? 'http://localhost:3000' : `file://${path.join(__dirname, 'out', 'index.html')}`;
const OVERLAY_PATH = isDev ? 'http://localhost:3000/overlay' : `file://${path.join(__dirname, 'out', 'overlay.html')}`;

// 🚨 LÓGICA DE LOGIN CON GOOGLE ELIMINADA.

function createSplashWindow() {
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
    // Configuración de la ventana principal (Login Flotante / Dashboard)
    mainWindow = new BrowserWindow({
        // 🚨 Configuración Flotante y Estabilidad (debe coincidir con LoginScreen.jsx)
        width: 500,    
        height: 720,
        minWidth: 500, // Fijamos el tamaño para evitar redimensionamiento
        minHeight: 720,
        show: false, // CRÍTICO: Ocultar inicialmente
        frame: false, 
        transparent: true, 
      // 🚨 CORRECCIÓN CRÍTICA: FONDOS FANTASMAS
        backgroundColor: '#00000000', 
        
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: !isDev 
        },
    });

    mainWindow.loadURL(INDEX_PATH);

    // 🚨 MANEJO DE LA TRANSICIÓN SPLASH -> MAIN
    mainWindow.once('ready-to-show', () => {
        // Cuando el contenido de Login/Dashboard está cargado, esperamos 4 segundos.
        setTimeout(() => {
            if (splashWindow) {
                splashWindow.close(); 
                splashWindow = null;
            }
            // Mostramos la ventana principal SOLO después del delay
            mainWindow.show();
            mainWindow.center();
            if (isDev) { 
                mainWindow.webContents.openDevTools();
            }
        }, 4000); // 4 SEGUNDOS DE SPLASH
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
    
    // Configuración de la ventana de Overlay (Coach flotante)
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
            webSecurity: !isDev
        }
    });

    overlayWindow.loadURL(OVERLAY_PATH);
    overlayWindow.setIgnoreMouseEvents(true); 
    
    overlayWindow.on('closed', () => (overlayWindow = null));
}


// --- LÓGICA COMPLETA DE WEBSOCKETS (Tu código original) ---
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

// --- LÓGICA COMPLETA DE LIVE GAME POLLING (Tu código original) ---
function startLiveGamePolling() {
    if (pollingInterval) clearInterval(pollingInterval);
    pollingInterval = setInterval(async () => {
        try {
            const response = await fetchAndSendLcuData(null, 'GET', '/lol-gameflow/v1/session');
            const gameState = response?.phase || 'None';
            
            if (mainWindow) { mainWindow.webContents.send('live-game-update', { state: gameState }); }
            
            if (gameState === 'InProgress') {
                const gameDataResponse = await fetchAndSendLcuData(null, 'GET', '/lol-liveclientdata/allgamedata');
                if (gameDataResponse) { 
                    await axios.post(`${BACKEND_BASE_URL}${LIVE_GAME_UPDATE_ENDPOINT}`, gameDataResponse); 
                }
            }
        } catch (error) { 
            if (mainWindow) { mainWindow.webContents.send('live-game-update', { state: 'None', error: 'Cliente no detectado' }); } 
        }
    }, 5000);
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

// El frontend (LoginScreen.jsx) envía este evento al proceso principal 
ipcMain.on('user-logged-in', (event, userData) => {
    console.log(`[IPC] Usuario ${userData.username} autenticado. Abriendo Overlay.`);
    // createOverlayWindow(); // Tu lógica para abrir el Overlay
});


// ----------------------------------------------------
// INICIO DEL CICLO DE VIDA DE LA APLICACIÓN
// ----------------------------------------------------

app.on('ready', () => {
    // 1. Inicia el Splash (única ventana visible inicialmente)
    createSplashWindow();
    
    // 2. Crea la ventana principal (oculta) INMEDIATAMENTE
    createMainWindow(); 
    
    // Iniciar las funciones de monitoreo si es necesario
    // setupWebSocketClient(); 
    // startLiveGamePolling();
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') { app.quit(); } });
app.on('activate', () => { if (mainWindow === null) { createMainWindow(); } });