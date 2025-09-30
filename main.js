// main.js - VERSIÓN CORREGIDA Y MEJORADA CON HOTKEYS Y IPC PERSISTENTE (FIX VISIBILIDAD OVERLAY)

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
        transparent: true, // La ventana es sólida.
        //backgroundColor: '#1E2328', // Fondo sólido (lol-dark-blue)
        
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
            // Ya no necesitamos setIgnoreMouseEvents(false) si transparent es false
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

