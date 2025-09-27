// Ruta: main.js
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

// Utilizamos la propiedad nativa de Electron para determinar el entorno (sin electron-is-dev)
const isDev = !app.isPackaged; 

let mainWindow;      // Ventana principal (Dashboard/Login)
let splashWindow;    // Ventana de carga inicial
let overlayWindow;   // Ventana flotante del Coach

// Rutas base: Se define la ruta completa dependiendo del entorno (dev o prod)
const INDEX_PATH = isDev
    ? 'http://localhost:3000'
    : `file://${path.join(__dirname, 'out', 'index.html')}`;
    
const OVERLAY_PATH = isDev
    ? 'http://localhost:3000/overlay'
    : `file://${path.join(__dirname, 'out', 'overlay.html')}`;

// Función para crear la ventana de splash
function createSplashWindow() {
    splashWindow = new BrowserWindow({
        width: 600,
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
    // Configuración de la ventana principal (Dashboard/Login)
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 1000,
        minHeight: 600,
        show: false, // Ocultar inicialmente mientras se carga el contenido (SPLASH)
        icon: path.join(__dirname, 'assets', 'icon2.png'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: !isDev 
        },
    });

    // Cargar la ruta principal (page.jsx controlará si se muestra AuthScreen o Dashboard)
    mainWindow.loadURL(INDEX_PATH);

    mainWindow.on('ready-to-show', () => {
        // Al terminar de cargar la ventana principal:
        if (splashWindow) {
            splashWindow.webContents.send('app-ready'); 
            splashWindow.close();
        }
        
        // Mostrar la ventana principal
        mainWindow.show();
        if (isDev) { 
            mainWindow.webContents.openDevTools();
        }
    });
    
    // Se elimina toda la lógica de Google Auth.

    mainWindow.on('closed', () => {
        mainWindow = null;
        // Cierra el overlay si la ventana principal se cierra
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

// =========================================================================
// MANEJO DE EVENTOS IPC (El Login exitoso abre el Overlay)
// =========================================================================

// El frontend (AuthScreen.jsx) envía este evento al proceso principal 
// cuando el Login o Registro ha sido exitoso.
ipcMain.on('user-logged-in', (event, userData) => {
    console.log(`[IPC] Usuario ${userData.username} (${userData.id}) autenticado. Abriendo Overlay.`);
    
    // El frontend ya cambió su estado a DASHBOARD, solo abrimos el Overlay
    createOverlayWindow();
});

// ----------------------------------------------------
// INICIO DEL CICLO DE VIDA DE LA APLICACIÓN
// ----------------------------------------------------

app.on('ready', () => {
    // 1. Inicia el Splash (primera ventana visible)
    createSplashWindow();
    
    // 2. Crea la ventana principal (Dashboard) en segundo plano
    setTimeout(() => {
        createMainWindow();
    }, 100); 
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (mainWindow === null) {
        createMainWindow();
    }
});