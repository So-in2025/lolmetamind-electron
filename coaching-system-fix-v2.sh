#!/bin/bash
# coaching-system-fix-v2.sh - Script de Corrección Sintáctica y Reingeniería del Overlay (Hextech Modular)
# CORRIGE: Error "Expected unicode escape" en template literals de Next.js/SWC.

LOG_PREFIX="[HEXTECH-REFACTOR-V2]"
NODE_PORT=3001
APP_NAME="lolmetamind-electron"
MAIN_JS_FILE="main.js"
OVERLAY_PAGE_FILE="src/app/overlay/page.jsx"
SCALE_CONTEXT_FILE="src/context/ScaleContext.jsx"
DRAG_WRAPPER_FILE="src/components/widgets/DragAndScaleWidget.jsx"
USE_INTERACTIVE_HOOK_FILE="src/hooks/useInteractiveWidget.js"

echo "=========================================================="
echo "$LOG_PREFIX 🚀 Aplicando Fix Sintáctico y Reingeniería Hextech"
echo "=========================================================="

# --- ESTRATEGIA DE CORRECCIÓN: Uso de Heredoc sin comillas con escape de \$ para garantizar sintaxis JS correcta ---

# 1.1. Modificar main.js (Hotkeys, IPC para Escala, e Interacción)
echo "$LOG_PREFIX 📝 Actualizando $MAIN_JS_FILE: Configurando CTRL+F1/F2 y IPC de Escala."

cat << EOF_MAIN_JS > "$MAIN_JS_FILE"
// main.js - VERSIÓN CORREGIDA Y MEJORADA CON HOTKEYS Y IPC PERSISTENTE

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
const INDEX_PATH = isDevMode ? 'http://localhost:3001/dashboard' : \`file://\${path.join(__dirname, 'out', 'dashboard', 'index.html')}\`;
const LOGIN_PATH = isDevMode ? 'http://localhost:3001' : \`file://\${path.join(__dirname, 'out', 'index.html')}\`;
const OVERLAY_PATH = isDevMode ? 'http://localhost:3001/overlay' : \`file://\${path.join(__dirname, 'out', 'overlay', 'index.html')}\`;

const backendAgent = new https.Agent({ rejectUnauthorized: false });
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

function sendDataToRenderer(channel, data) {
    const window = channel === 'overlay-interaction-toggle' ? overlayWindow : mainWindow;
    if (window && !window.isDestroyed()) {
        console.log(\`[IPC SEND] Enviando al canal '\${channel}'.\`);
        window.webContents.send(channel, data);
    }
}


async function fetchAndStoreUserProfile(username, token) {
    console.log(\`[DB FETCH] 🔍 Iniciando fetchAndStoreUserProfile para: \${username}\`);
    if (!token || typeof token !== 'string' || token.length < 10) {
        console.error('[DB FETCH] ❌ Falla Crítica: Token inválido o no recibido.');
        return false;
    }

    try {
        const response = await axios.get(\`\${BACKEND_BASE_URL}\${USER_PROFILE_ENDPOINT}\`, {
            headers: { 'Authorization': \`Bearer \${token}\` },
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
            
            console.log(\`[DB FETCH] ✅ Perfil guardado para: \${summonerName}.\`);
            return true;
        } else {
            console.warn(\`[DB FETCH] ⚠️ Perfil no encontrado o incompleto en la DB.\`);
            return false;
        }
    } catch (error) {
        console.error(\`[DB FETCH] ❌ Fallo crítico al obtener perfil: \${error.message}\`);
        if (error.response) {
            console.error(\`[DB FETCH] ❌ Detalles del error: Status \${error.response.status}, Data: \${JSON.stringify(error.response.data)}\`);
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
    splashWindow.loadURL(\`file://\${path.join(__dirname, 'splash.html')}\`); 
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

function createMainWindow() {
    // 1. Cierra la ventana antigua (Login)
    if (loginWindow) loginWindow.close(); 
    
    // 2. Crea la nueva ventana (Dashboard)
    mainWindow = new BrowserWindow({
        // CRÍTICO: Reduje el minWidth/minHeight para evitar problemas en monitores pequeños en desarrollo.
        width: 1920,
        height: 1080,
        minWidth: 1000, // Ajustado
        minHeight: 720, // Ajustado
        show: false, // Inicia oculto para evitar el flash blanco
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

    // 4. CRÍTICO: Muestra la ventana del Dashboard SÓLO cuando está lista.
    mainWindow.once('ready-to-show', () => {
        console.log("[MAIN] READY-TO-SHOW disparado. Mostrando mainWindow (Dashboard).");
        mainWindow.show();
        mainWindow.center();
        // El inicio del polling se hace en el setTimeout de app.on('ready')
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
        transparent: true, // Overlay debe ser transparente
        frame: false,
        focusable: false,
        alwaysOnTop: true,
        skipTaskbar: true, // Ocultar de la barra de tareas
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
        },
    });

    overlayWindow.loadURL(OVERLAY_PATH);
    // Establecer estado inicial: no interactivo (CTRL+F2)
    overlayWindow.setIgnoreMouseEvents(true); 
    overlayWindow.hide();
    overlayWindow.on('closed', () => (overlayWindow = null));
}

// ==========================================================
// LÓGICA DE POLLING (COMPLETA)
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
                    \`\${BACKEND_BASE_URL}\${LIVE_GAME_UPDATE_ENDPOINT}\`,
                    latestRiotApiData,
                    { headers: { 'Authorization': \`Bearer \${userToken}\` }, httpsAgent: backendAgent, timeout: 5000 }
                );
                console.log('[MAIN-FLOW] ✅ Datos iniciales de Riot API enviados al backend.');
            } catch (backendError) {
                console.error(\`[MAIN-FLOW] ❌ Fallo al enviar datos iniciales de Riot API al backend: \${backendError.message}\`);
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
    createLoginWindow(); // Inicia la carga del Login (ventana pequeña)
    createOverlayWindow(); 

    // IPC: Manejo del toggle de visibilidad (Alt+O original)
    ipcMain.on('toggle-overlay', () => {
        if (overlayWindow) {
            if (overlayWindow.isVisible()) {
                overlayWindow.hide();
                console.log('[IPC RECEIVE] Ocultando Overlay.');
            } else {
                overlayWindow.showInactive(); // showInactive para no robar el foco del juego
                // Nota: La interactividad se controla ahora con CTRL+F1/F2
                console.log('[IPC RECEIVE] Mostrando Overlay.'); 
            }
        } else {
            console.error("[IPC RECEIVE] Error: Se intentó mostrar/ocultar un Overlay que no existe.");
        }
    });
    
    // IPC: Manejo de persistencia de escala de widgets
    ipcMain.handle('get-widget-scale-state', async (event, widgetId) => {
        return store.get(\`widgetScale-\${widgetId}\`);
    });

    ipcMain.on('set-widget-scale-state', (event, { widgetId, scale, position, isLocked }) => {
        store.set(\`widgetScale-\${widgetId}\`, { scale, position, isLocked });
        console.log(\`[IPC STORE] ✅ Estado de widget \${widgetId} guardado. Escala: \${scale}\`);
    });


    ipcMain.on('closeWindow', () => app.quit());
    ipcMain.on('minimizeWindow', () => {
        if (mainWindow) mainWindow.minimize();
        else if (loginWindow) loginWindow.minimize();
    });

    // CRÍTICO: Evento de Login exitoso (Activado por LoginScreen.jsx)
    ipcMain.on('user-logged-in', async (event, userData) => {
        console.log(\`[IPC RECEIVE] Evento 'user-logged-in' recibido para el usuario: \${userData.username}\`);
        if (hasRunInitialLogin) {
            console.warn(\`[IPC RECEIVE] ⚠️ Evento de login duplicado ignorado.\`);
            return;
        }
        
        store.set('userToken', userData.token);
        const profileFetchSuccess = await fetchAndStoreUserProfile(userData.username, userData.token);

        if (profileFetchSuccess || store.get('userData')) {
            hasRunInitialLogin = true;
            console.log('[MAIN-FLOW] ✅ Perfil cargado. Cerrando Login y abriendo Dashboard.');
            
            // 1. Crear la ventana principal (cierra loginWindow)
            createMainWindow(); 
            
            // 2. INICIAR EL POLLING CON DELAY (Para darle tiempo a React a redirigir a /dashboard)
            setTimeout(() => {
                 console.log('[MAIN-FLOW] Retardo de 1s completado. Iniciando flujo de datos Riot/LCU.');
                 executeInitialRiotApiFetchAndStartPolling(); 
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
            console.error(\`[AI Request] Error: No autenticado para el endpoint \${endpoint}\`);
            return { error: 'Usuario no autenticado.' };
        }

        try {
            const response = await axios.post(\`\${BACKEND_BASE_URL}\${endpoint}\`, payload, {
                headers: { 'Authorization': \`Bearer \${token}\` },
                httpsAgent: backendAgent,
                timeout: 30000
            });
            return response.data;
        } catch (error) {
            const errorMessage = error.response?.data?.message || \`Error al contactar el backend para la IA: \${error.message}\`;
            return { error: errorMessage };
        }
    };
    
    ipcMain.handle('get-meta-analysis', (e, payload) => makeAIRequest('/api/ai/get-meta', payload));
    ipcMain.handle('get-recommendations', (e, payload) => makeAIRequest('/api/ai/get-recommendations', payload));
    ipcMain.handle('get-weekly-challenges', (e, payload) => makeAIRequest('/api/ai/get-weekly-challenges', payload));
    ipcMain.handle('analyze-matches', (e, payload) => makeAIRequest('/api/ai/analyze-matches', payload));
    ipcMain.handle('get-live-coaching', (e, payload) => makeAIRequest('/api/ai/live-coach', payload));
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
            } else {
                overlayWindow.showInactive();
            }
        }
    });

    // CRÍTICO: CTRL+F1 - MODO ACTIVO (Clickeable, Drag, Botones +/-, Overlay Visible si está oculto)
    globalShortcut.register('CommandOrControl+F1', () => { 
        if (overlayWindow) {
            console.log('[HOTKEY] ⌨️ CTRL+F1 activado: Modo Interactivo (Clickeable).');
            overlayWindow.setIgnoreMouseEvents(false);
            if (!overlayWindow.isVisible()) overlayWindow.showInactive(); 
            // Enviar estado al renderer para mostrar botones (+/- y arrastre)
            sendDataToRenderer('overlay-interaction-toggle', true); 
        }
    });
    
    // CRÍTICO: CTRL+F2 - MODO PASIVO (Mouse-transparent, Botones ocultos, Overlay Visible)
    globalShortcut.register('CommandOrControl+F2', () => { 
        if (overlayWindow) {
            console.log('[HOTKEY] ⌨️ CTRL+F2 activado: Modo Pasivo (Transparente al click).');
            overlayWindow.setIgnoreMouseEvents(true);
            if (!overlayWindow.isVisible()) overlayWindow.showInactive(); 
            // Enviar estado al renderer para ocultar botones (+/- y arrastre)
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
EOF_MAIN_JS

# 1.2. Crear src/context/ScaleContext.jsx (Nueva) - FIX: Corregido template literal
echo "$LOG_PREFIX 🆕 Creando $SCALE_CONTEXT_FILE: Contexto de Escala y Posición Persistente. (FIXED JS SYNTAX)"
mkdir -p $(dirname "$SCALE_CONTEXT_FILE")

cat << EOF_SCALE_CONTEXT > "$SCALE_CONTEXT_FILE"
// src/context/ScaleContext.jsx - Contexto de Escala y Posición Persistente (Hextech Modular)
"use client"

import React, { createContext, useContext, useState, useCallback } from 'react';
// IMPORTANTE: Asumo que existe un hook usePersistentIpc o lo quito si no es necesario
// Ya que la lógica de IPC está en el hook, no necesitamos importarlo aquí.

const ScaleContext = createContext();

export const useWidgetScale = () => useContext(ScaleContext);

export const ScaleProvider = ({ children }) => {
    // CRÍTICO: Se utiliza window.electronAPI.ipcRenderer directamente
    const { ipcRenderer } = typeof window !== 'undefined' && window.electronAPI ? window.electronAPI : {};
    const [widgetStates, setWidgetStates] = useState({});

    // Carga el estado inicial del widget y lo guarda en el estado local
    const loadWidgetState = useCallback(async (widgetId, defaultScale, defaultPosition) => {
        if (!ipcRenderer || !widgetId) return;
        
        try {
            const savedState = await ipcRenderer.invoke('get-widget-scale-state', widgetId);
            
            const initialState = {
                scale: savedState?.scale || defaultScale || 100,
                position: savedState?.position || defaultPosition || { x: 0, y: 0 },
                isLocked: savedState?.isLocked ?? false, // Usar valor guardado, o false por defecto
            };

            setWidgetStates(prev => ({
                ...prev,
                [widgetId]: initialState,
            }));

            return initialState;
        } catch (error) {
            // FIX CRÍTICO: Eliminados los backslashes innecesarios
            console.error(\`[ScaleContext] Error al cargar el estado de \${widgetId}:\`, error);
            return { scale: defaultScale, position: defaultPosition, isLocked: false };
        }
    }, [ipcRenderer]);

    // Guarda el estado del widget a través de IPC (persistente en electron-store)
    const saveWidgetState = useCallback((widgetId, newState) => {
        if (!ipcRenderer || !widgetId) return;

        setWidgetStates(prev => {
            const finalState = { ...prev[widgetId], ...newState };
            
            // Envío asíncrono a Electron
            ipcRenderer.send('set-widget-scale-state', {
                widgetId,
                scale: finalState.scale,
                position: finalState.position,
                isLocked: finalState.isLocked,
            });

            return {
                ...prev,
                [widgetId]: finalState,
            };
        });
    }, [ipcRenderer]);

    const value = {
        widgetStates,
        loadWidgetState,
        saveWidgetState,
    };

    return (
        <ScaleContext.Provider value={value}>
            {children}
        </ScaleContext.Provider>
    );
};
EOF_SCALE_CONTEXT

# 1.3. Crear src/components/widgets/DragAndScaleWidget.jsx (Nuevo Wrapper Hextech) - FIX: Corregido template literal
echo "$LOG_PREFIX 🆕 Creando $DRAG_WRAPPER_FILE: Wrapper Modular Hextech. (FIXED JS SYNTAX)"
mkdir -p $(dirname "$DRAG_WRAPPER_FILE")

cat << EOF_DRAG_WRAPPER > "$DRAG_WRAPPER_FILE"
// src/components/widgets/DragAndScaleWidget.jsx - Wrapper Hextech Modular
"use client"
import React, { useEffect, useRef, useState } from 'react';
import Draggable from 'react-draggable';
import { useWidgetScale } from '@/context/ScaleContext';
import { ArrowsPointingOutIcon, LockClosedIcon, LockOpenIcon, MinusIcon, PlusIcon } from '@heroicons/react/24/outline';
import { useInteractiveWidget } from '@/hooks/useInteractiveWidget';

// Rango de escala permitido
const MIN_SCALE = 40;
const MAX_SCALE = 200;
const SCALE_STEP = 20;

const HextechButton = ({ children, onClick, className = '' }) => (
    <button
        onClick={onClick}
        className={\`p-1.5 rounded-full backdrop-blur-sm bg-blue-900/50 hover:bg-blue-700/70 border border-blue-500/50 text-white shadow-lg transition duration-200 \${className}\`}
        style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        aria-label="Control Button"
    >
        {children}
    </button>
);

export default function DragAndScaleWidget({ children, widgetId, defaultPosition = { x: 0, y: 0 } }) {
    const { widgetStates, loadWidgetState, saveWidgetState } = useWidgetScale();
    const { isWidgetInteractive } = useInteractiveWidget('global-overlay'); // Estado global CTRL+F1/F2
    const widgetState = widgetStates[widgetId];
    
    // Cargar estado inicial
    useEffect(() => {
        loadWidgetState(widgetId, 100, defaultPosition);
    }, [widgetId, loadWidgetState, defaultPosition]);

    const scaleWidget = (direction) => {
        if (!widgetState) return;

        let newScale = widgetState.scale + (direction === 'in' ? SCALE_STEP : -SCALE_STEP);
        newScale = Math.min(Math.max(newScale, MIN_SCALE), MAX_SCALE);
        
        if (newScale !== widgetState.scale) {
            saveWidgetState(widgetId, { scale: newScale });
        }
    };

    const toggleLock = () => {
        if (!widgetState) return;
        saveWidgetState(widgetId, { isLocked: !widgetState.isLocked });
    };

    const handleDragStop = (e, data) => {
        saveWidgetState(widgetId, { position: { x: data.x, y: data.y } });
    };

    if (!widgetState) {
        // Renderizar un fallback mientras se carga el estado
        return <div className="absolute top-0 left-0 p-2 text-blue-400">Cargando Widget...</div>;
    }

    // Estilo de transformación para la escala
    const scaleStyle = {
        // FIX CRÍTICO: Eliminados los backslashes innecesarios
        transform: \`scale(\${widgetState.scale / 100})\`,
        transformOrigin: 'top left',
        transition: isWidgetInteractive ? 'none' : 'transform 0.1s ease-out', // Suavizar solo al jugar
        width: \`calc(100% / (\${widgetState.scale / 100}))\`, // Corrección para que el contenedor mantenga el tamaño lógico
        height: \`calc(100% / (\${widgetState.scale / 100}))\`,
        pointerEvents: isWidgetInteractive ? 'auto' : 'none', // Asegurar que el contenido también sea transparente al click
    };
    
    // El widget se convierte en el área de agarre
    const dragClassName = \`relative w-full h-full p-2 rounded-lg transition-shadow duration-300 \${!widgetState.isLocked && isWidgetInteractive ? 'cursor-grab hover:shadow-[0_0_20px_rgba(30,144,255,0.5)]' : 'cursor-default'}\`;
    
    // Mostrar controles solo en modo interactivo (CTRL+F1)
    const showControls = isWidgetInteractive;

    return (
        <Draggable 
            handle={showControls && !widgetState.isLocked ? ".drag-handle" : null}
            defaultPosition={defaultPosition}
            position={widgetState.position}
            onStop={handleDragStop}
            disabled={widgetState.isLocked || !showControls}
            bounds="parent" // Asegura que no se salga de la pantalla (overlayWindow)
        >
            <div 
                className={dragClassName} 
                style={scaleStyle}
            >
                {/* Controles de la esquina superior izquierda (Fijos para el widget) */}
                {showControls && (
                    <div className="absolute top-[-40px] left-0 flex space-x-2 p-1 bg-transparent z-50">
                        {/* Botón de Bloqueo/Desbloqueo */}
                        <HextechButton onClick={toggleLock} className="drag-handle">
                            {widgetState.isLocked ? (
                                <LockClosedIcon className="w-4 h-4 text-red-400" />
                            ) : (
                                <LockOpenIcon className="w-4 h-4 text-green-400" />
                            )}
                        </HextechButton>
                        
                        {/* Botón de Arrastre (Solo visible si está desbloqueado) */}
                        {!widgetState.isLocked && (
                            <HextechButton className="drag-handle" title="Arrastrar Widget">
                                <ArrowsPointingOutIcon className="w-4 h-4 text-yellow-400" />
                            </HextechButton>
                        )}
                        
                        {/* Controles de Escala (+ / -) */}
                        <HextechButton onClick={() => scaleWidget('out')} title="Reducir (40% - 200%)">
                            <MinusIcon className="w-4 h-4" />
                        </HextechButton>
                        <HextechButton onClick={() => scaleWidget('in')} title="Aumentar (40% - 200%)">
                            <PlusIcon className="w-4 h-4" />
                        </HextechButton>
                        
                        <span className="text-white ml-2 text-sm font-bold p-1 rounded backdrop-blur-sm bg-gray-900/50 border border-gray-500/50">
                            \${widgetState.scale}%
                        </span>
                    </div>
                )}
                
                {/* Contenido del Widget */}
                <div className="w-full h-full pointer-events-auto">
                    {children}
                </div>
            </div>
        </Draggable>
    );
}
EOF_DRAG_WRAPPER

# 1.4. Modificar src/hooks/useInteractiveWidget.js
echo "$LOG_PREFIX 📝 Actualizando $USE_INTERACTIVE_HOOK_FILE."
mkdir -p $(dirname "$USE_INTERACTIVE_HOOK_FILE")

cat << EOF_USE_INTERACTIVE_HOOK > "$USE_INTERACTIVE_HOOK_FILE"
// src/hooks/useInteractiveWidget.js - VERSIÓN CON HOTKEY CTRL+F1/F2

"use client"
import { useState, useEffect } from 'react';

// Este hook se suscribe al estado de interacción global del Overlay 
// controlado por los hotkeys (CTRL+F1/F2) en el proceso principal de Electron.
export function useInteractiveWidget(widgetId) {
    const [isWidgetInteractive, setIsWidgetInteractive] = useState(false); // Por defecto: Pasivo (CTRL+F2)

    useEffect(() => {
        if (window.electronAPI && typeof window.electronAPI.on === 'function') {
            console.log("[useInteractiveWidget] Suscribiéndose al canal IPC 'overlay-interaction-toggle'.");
            
            // Recibe el booleano que indica si el Overlay debe ser interactivo (true: CTRL+F1, false: CTRL+F2)
            const handleInteractionToggle = (data) => {
                const newInteractiveState = !!data;
                // FIX CRÍTICO: Eliminados los backslashes innecesarios
                console.log(\`[useInteractiveWidget] ✅ Estado de interacción global: \${newInteractiveState ? 'ACTIVO (CTRL+F1)' : 'PASIVO (CTRL+F2)'}.\`);
                setIsWidgetInteractive(newInteractiveState);
            };
            
            const unsubscribe = window.electronAPI.on('overlay-interaction-toggle', handleInteractionToggle);
            
            // Limpieza
            return () => {
                console.log("[useInteractiveWidget] Desuscribiéndose de 'overlay-interaction-toggle'.");
                unsubscribe();
            };
        } else {
            console.warn("[useInteractiveWidget] La API de Electron no está disponible. Usando modo predeterminado.");
        }
    }, [widgetId]); 

    // Función que la página usará para indicar si el área debe capturar clics
    // El modo interactivo global anula cualquier intento de hacerlo no interactivo.
    return { 
        isWidgetInteractive, 
    };
}
EOF_USE_INTERACTIVE_HOOK

# 1.5. Modificar src/app/overlay/page.jsx (Integración Completa) - FIX: Corregido template literal
echo "$LOG_PREFIX 📝 Actualizando $OVERLAY_PAGE_FILE: Integración de ScaleContext, DragAndScaleWidget y lógica de TTS. (FIXED JS SYNTAX)"

cat << EOF_OVERLAY_PAGE > "$OVERLAY_PAGE_FILE"
// src/app/overlay/page.jsx - VERSIÓN FINAL CON HEXTECH MODULAR Y LÓGICA DE FASE CORREGIDA
"use client"

import React, { useEffect, useState, Suspense } from 'react';
import { useInteractiveWidget } from '../../hooks/useInteractiveWidget'; 
import { useLcuData } from '../../hooks/useLcuData';
import { useAppState } from '@/context/AppStateContext';
import { ScaleProvider } from '@/context/ScaleContext'; // Importar el nuevo Provider
import DragAndScaleWidget from '@/components/widgets/DragAndScaleWidget'; // Importar el nuevo Wrapper

// Importamos los widgets usando React.lazy para carga diferida y fallback
const ControlsHUD = React.lazy(() => import('../../components/widgets/ControlsHUD'));
const ChampSelectCoach = React.lazy(() => import('../../components/widgets/ChampSelectCoach'));
const InGameCoach = React.lazy(() => import('../../components/widgets/InGameCoach'));
const StatusHUD = React.lazy(() => import('../../components/widgets/StatusHUD'));

// Función TTS (Text-to-Speech) con logs de diagnóstico
const speak = (text, priority = 'normal') => {
  try {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window && text) {
      if (priority === 'high') {
        window.speechSynthesis.cancel();
      }
      
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'es-ES';
      utterance.rate = 1.2;
      utterance.pitch = 1.1;

      // FIX CRÍTICO: Eliminados los backslashes innecesarios
      utterance.onstart = () => console.log(\`[TTS] ✅ INICIO: Hablando "\${text}"\`); 
      utterance.onerror = (event) => console.error(\`[TTS] ❌ ERROR: \${event.error}\`);
      
      window.speechSynthesis.speak(utterance);
      
    } else {
      console.warn("[TTS] ⚠️ API de SpeechSynthesis no disponible o el texto está vacío.");
    }
  } catch (e) {
    // FIX CRÍTICO: Eliminados los backslashes innecesarios
    console.error(\`[TTS] 🚨 Fallo catastrófico al intentar hablar: \${e.message}\`);
  }
};

// Componente principal del Overlay (Envuelto en ScaleProvider en la exportación)
function OverlayContent() {
    console.log("[OverlayPage] 🟢 Montando componente...");
    
    // isWidgetInteractive ahora controla si los controles de drag/scale son visibles
    const { isWidgetInteractive } = useInteractiveWidget('global-overlay'); 
    const lcuData = useLcuData();
    const { userData } = useAppState();

    const [lastSpokenGamePhase, setLastSpokenGamePhase] = useState('');
    
    // --- LÓGICA DE FASE (CORRECCIÓN CRÍTICA Y DEBUG) ---
    let gamePhase = lcuData?.gameflow?.phase; 
    const realLcuPhase = gamePhase; 
    
    // Bandera temporal para pruebas: Poner a 'false' para producción.
    const DEBUG_FORCE_WIDGETS_ON = true; 
    
    // Forzamos fase si es inactiva para poder probar el overlay y TTS.
    if (DEBUG_FORCE_WIDGETS_ON && (gamePhase === 'EndOfGame' || gamePhase === 'None' || !gamePhase)) {
        gamePhase = 'ChampSelect'; 
        // FIX CRÍTICO: Eliminados los backslashes innecesarios
        console.warn(\`[OverlayPage] ⚠️ FASE FORZADA A 'ChampSelect' (DEBUG). LCU real: \${realLcuPhase || "N/A"}\`);
    }
    // --- FIN LÓGICA DE FASE ---
    
    useEffect(() => {
        // FIX CRÍTICO: Eliminados los backslashes innecesarios
        console.log(\`[OverlayPage] 🔄 Actualización de estado detectada. GamePhase (Forzada): \${gamePhase}.\`);
        
        if (!gamePhase || gamePhase === lastSpokenGamePhase) return;

        let adviceToSpeak = '';
        let priority = 'normal';

        if (gamePhase === 'ChampSelect') {
            adviceToSpeak = "Analizando selección de campeones. El coach Hextech está listo en pantalla.";
            priority = 'high';
        } else if (gamePhase === 'InProgress') {
            adviceToSpeak = "Partida en curso. Pulsa Control F1 para activar la interfaz, o Control F2 para el modo pasivo.";
            priority = 'normal';
        }

        if (adviceToSpeak) {
            // FIX CRÍTICO: Eliminados los backslashes innecesarios
            console.log(\`[OverlayPage] 🎤 Intentando activar TTS para la fase: \${gamePhase}\`);
            speak(adviceToSpeak, priority);
            setLastSpokenGamePhase(gamePhase);
        }
    }, [gamePhase, lastSpokenGamePhase]);

    // Fallback de renderizado para cada widget.
    const WidgetFallback = ({ name }) => (
        <div className="text-red-500 bg-black/80 p-2 rounded-md border border-red-500">
            Error al cargar el widget: {name}
        </div>
    );

    return (
        // El contenedor principal ahora solo controla la transparencia al click
        <div className={\`h-full w-full bg-transparent \${isWidgetInteractive ? 'pointer-events-auto' : 'pointer-events-none'}\`}>
            {/* Etiqueta de diagnóstico VISUAL (Fija en el centro) */}
            <p style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: 'lime', fontSize: '24px', textShadow: '0 0 5px black', zIndex: 9998 }}>
                [Overlay Activo - LCU Real: {realLcuPhase || "N/A"} **(Fase: {gamePhase})**]
            </p>

            {/* WIDGETS ENVUELTOS EN EL NUEVO DRAGANDSCALEWRAPPER */}
            
            {/* 1. Controles Globales (Fijos en la esquina superior izquierda, se ocultan en CTRL+F2) */}
            {isWidgetInteractive && (
                <div style={{ position: 'fixed', top: '20px', left: '20px', zIndex: 10000 }}>
                     <Suspense fallback={<WidgetFallback name="ControlsHUD" />}>
                        <ControlsHUD isInteractive={isWidgetInteractive} />
                    </Suspense>
                </div>
            )}
            
            {/* 2. Status HUD (No necesita drag, pero usa la info de fase) */}
            <DragAndScaleWidget widgetId="StatusHUD" defaultPosition={{ x: 100, y: 100 }}>
                <Suspense fallback={<WidgetFallback name="StatusHUD" />}>
                    <StatusHUD gamePhase={gamePhase} />
                </Suspense>
            </DragAndScaleWidget>
            

            {/* 3. Coach de Selección de Campeones */}
            {gamePhase === 'ChampSelect' && (
                <DragAndScaleWidget widgetId="ChampSelectCoach" defaultPosition={{ x: 500, y: 200 }}>
                    <Suspense fallback={<WidgetFallback name="ChampSelectCoach" />}>
                        <ChampSelectCoach 
                            champSelectData={lcuData?.gameflow}
                            isInteractive={isWidgetInteractive} 
                        />
                    </Suspense>
                </DragAndScaleWidget>
            )}

            {/* 4. Coach En Partida */}
            {gamePhase === 'InProgress' && (
                <DragAndScaleWidget widgetId="InGameCoach" defaultPosition={{ x: 100, y: 700 }}>
                    <Suspense fallback={<WidgetFallback name="InGameCoach" />}>
                        <InGameCoach 
                            liveData={lcuData?.liveData}
                            userData={userData}
                            isInteractive={isWidgetInteractive}
                        />
                    </Suspense>
                </DragAndScaleWidget>
            )}
        </div>
    );
}

// Exportación envuelta en el ScaleProvider
export default function OverlayPage() {
    return (
        <ScaleProvider>
            <OverlayContent />
        </ScaleProvider>
    );
}
EOF_OVERLAY_PAGE


echo "$LOG_PREFIX ✅ Correcciones de código aplicadas con éxito. Sintaxis JS corregida."
echo "$LOG_PREFIX ----------------------------------------------------------"

# --- 2. PROCESO DE ARRANQUE ROBUSTO ---

echo "$LOG_PREFIX 🧹 [PASO 1/4] Limpiando procesos antiguos..."
# Limpieza de procesos anteriores por puerto y nombre de aplicación
if command -v lsof &> /dev/null && command -v awk &> /dev/null; then
    PIDS_TO_KILL=$(lsof -i tcp:$NODE_PORT | awk 'NR!=1 {print $2}')
    if [ ! -z "$PIDS_TO_KILL" ]; then
        echo "$LOG_PREFIX Procesos de Node a terminar: $PIDS_TO_KILL"
        kill -9 $PIDS_TO_KILL 2>/dev/null || true
    fi
fi
if command -v pkill &> /dev/null; then
    pkill -f "$APP_NAME" 2>/dev/null || true
fi

sleep 1 

echo "$LOG_PREFIX 📦 [PASO 2/4] Instalando dependencias (si es necesario)..."
npm install --silent

if [ $? -ne 0 ]; then
    echo "$LOG_PREFIX ❌ ERROR: Fallo al instalar las dependencias de Node.js. Abortando."
    exit 1
fi

echo "$LOG_PREFIX 🛠️ [PASO 3/4] Generando el Build de Next.js (FIX: Esto debería corregir el error de sintaxis)..."
npm run build

if [ $? -ne 0 ]; then
    echo "$LOG_PREFIX ❌ ERROR: Fallo al generar el Build de Next.js. El error de sintaxis persiste. Por favor, revise manualmente los archivos $OVERLAY_PAGE_FILE y $SCALE_CONTEXT_FILE."
    exit 1
fi

echo "$LOG_PREFIX 🟢 [PASO 4/4] Iniciando el Sistema de Coaching en tiempo real..."
echo "----------------------------------------------------------"
echo "$LOG_PREFIX ⏳ ÉXITO: El build se completó. La aplicación iniciará en modo Pasivo (CTRL+F2). Use CTRL+F1 para activar la interfaz."
echo "----------------------------------------------------------"

# Ejecuta el script principal de desarrollo concurrente
exec npm run electron:dev

if [ $? -ne 0 ]; then
    echo "$LOG_PREFIX ❌ ERROR CRÍTICO: El comando 'npm run electron:dev' ha fallado al iniciar la aplicación."
    exit 1
fi

exit 0