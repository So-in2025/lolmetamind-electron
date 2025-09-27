const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

// =========================================================================
// 1. ELIMINACIÓN DE 'electron-is-dev'
// =========================================================================
// Utilizamos la propiedad nativa de Electron:
// - app.isPackaged es TRUE en producción (cuando la app está empaquetada)
// - app.isPackaged es FALSE en desarrollo (cuando se ejecuta 'npm run electron .')

// Determina si estamos en modo de desarrollo (no empaquetado)
const isDev = !app.isPackaged; 

let mainWindow;
let splashWindow;
let overlayWindow;

// =========================================================================
// 2. RUTAS Y CONFIGURACIÓN BASE
// =========================================================================

// Rutas base para la ventana principal (Dashboard/Login)
// En desarrollo, apunta a http://localhost:3000
// En producción, apunta al archivo local 'index.html'
const INDEX_PATH = isDev
    ? 'http://localhost:3000'
    : `file://${path.join(__dirname, 'out', 'index.html')}`;

// Rutas base para la ventana de Overlay (Coach flotante)
const OVERLAY_PATH = isDev
    ? 'http://localhost:3000/overlay'
    : `file://${path.join(__dirname, 'out', 'overlay.html')}`;

// =========================================================================
// 3. FUNCIONES DE CREACIÓN DE VENTANAS
// =========================================================================

function createSplashWindow() {
    // Crea la ventana de splash (la primera que se muestra)
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
        show: false, // Ocultar inicialmente mientras se carga el contenido
        icon: path.join(__dirname, 'assets', 'icon2.png'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            // Habilitar webSecurity solo en producción para más seguridad
            webSecurity: !isDev 
        },
    });

    mainWindow.loadURL(INDEX_PATH);

    mainWindow.on('ready-to-show', () => {
        // Una vez que el contenido está listo para mostrarse, cerramos el splash y mostramos la principal.
        if (splashWindow) {
            // Notificar al splash para animaciones finales y luego cerrarlo
            splashWindow.webContents.send('app-ready'); 
            splashWindow.close();
        }
        mainWindow.show();
        // Abrir DevTools solo si estamos en modo desarrollo
        if (isDev) { 
            mainWindow.webContents.openDevTools();
        }
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
        // Si la ventana principal se cierra, aseguramos que el overlay también lo haga
        if (overlayWindow) {
            overlayWindow.close();
            overlayWindow = null;
        }
    });
}

function createOverlayWindow() {
    // Evita crear duplicados
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
        transparent: true, // Ventana sin fondo
        frame: false, // Sin bordes ni botones de sistema
        alwaysOnTop: true, // Siempre en la parte superior de otras ventanas
        skipTaskbar: true, // No aparece en la barra de tareas
        show: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: !isDev
        }
    });

    overlayWindow.loadURL(OVERLAY_PATH);
    // Permite que los clics pasen a través del overlay (crucial para no interferir con el juego)
    overlayWindow.setIgnoreMouseEvents(true); 
    
    overlayWindow.on('closed', () => (overlayWindow = null));
}

// =========================================================================
// 4. MANEJO DE EVENTOS DE PROCESO PRINCIPAL (Electron App Lifecycle)
// =========================================================================

// Se dispara cuando Electron ha terminado de inicializarse
app.on('ready', () => {
    // 1. Mostrar la pantalla de splash primero para una mejor experiencia de usuario
    createSplashWindow();
    
    // 2. Crear la ventana principal con un pequeño retraso (para que se vea el splash)
    setTimeout(() => {
        createMainWindow();
    }, 100); 
});

// Listener para cerrar la aplicación si todas las ventanas se cierran (excepto en macOS)
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// Listener para macOS: recrear la ventana si se hace clic en el ícono del dock
app.on('activate', () => {
    if (mainWindow === null) {
        createMainWindow();
    }
});

// =========================================================================
// 5. COMUNICACIÓN INTER-PROCESOS (IPC - Flujo de Autenticación)
// =========================================================================

// El frontend (AuthScreen.jsx) envía este evento al proceso principal 
// cuando el Login o Registro ha sido exitoso.
ipcMain.on('user-logged-in', (event, userData) => {
    console.log(`[IPC] Usuario ${userData.username} (${userData.id}) autenticado. Iniciando flujo de aplicación.`);
    
    // 1. Forzar la carga de la ruta principal del Dashboard (si no estaba ya allí)
    if (mainWindow) {
        mainWindow.loadURL(INDEX_PATH);
    }
    
    // 2. ABRIR EL OVERLAY FLOTANTE (Dashboard Flotante), siguiendo el flujo
    createOverlayWindow();
});