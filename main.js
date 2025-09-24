const { app, BrowserWindow, globalShortcut, screen } = require('electron');
const path = require('path');

// Una forma más robusta de detectar el modo de desarrollo
const isDev = process.env.NODE_ENV !== 'production';

// Desactivamos la aceleración de hardware para máxima compatibilidad
app.disableHardwareAcceleration();

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  const win = new BrowserWindow({
    width: width,
    height: height,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      // Importante para que la comunicación entre Electron y React funcione
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  win.setIgnoreMouseEvents(true, { forward: true });

  // Carga la URL de desarrollo o el archivo de producción
  const urlToLoad = isDev
    ? 'http://localhost:3000/overlay'
    : `file://${path.join(__dirname, 'out/overlay.html')}`;

  if (isDev) {
    win.loadURL(urlToLoad);
  } else {
    win.loadFile(path.join(__dirname, 'out/overlay.html'));
  }

  // Atajo para entrar en "Modo Edición"
  globalShortcut.register('CommandOrControl+F1', () => {
    win.setIgnoreMouseEvents(false);
    win.focus();
    // Avisamos a React que entramos en Modo Edición
    win.webContents.send('set-edit-mode', true);
  });
  
  // Atajo para volver a "Modo Juego"
  globalShortcut.register('CommandOrControl+F2', () => {
    win.setIgnoreMouseEvents(true, { forward: true });
    // Avisamos a React que salimos del Modo Edición
    win.webContents.send('set-edit-mode', false);
  });

  // Hacemos que los controles aparezcan al inicio por defecto
  win.webContents.on('did-finish-load', () => {
    win.webContents.send('set-edit-mode', true);
  });
  
  if (isDev) {
    win.webContents.openDevTools({ mode: 'detach' });
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});