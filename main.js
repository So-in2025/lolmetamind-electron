const { app, BrowserWindow, globalShortcut, screen } = require('electron');
const path = require('path');
const isDev = process.env.NODE_ENV === 'development';

function createWindow() {
  // Obtenemos las dimensiones de la pantalla principal
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  const win = new BrowserWindow({
    width: width, // Ancho completo
    height: height, // Alto completo
    frame: false,        // <-- Vuelve a 'false'
    transparent: true,     // <-- Vuelve a 'true'
    alwaysOnTop: true,
    resizable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  // La ventana ignorará los clics por defecto
  win.setIgnoreMouseEvents(true, { forward: true });

  const urlToLoad = isDev
    ? 'http://localhost:3000/overlay'
    : `file://${path.join(__dirname, 'out/overlay/index.html')}`;

  win.loadURL(urlToLoad);

  // Atajo para entrar en "Modo Edición" (puedes hacer clic en el HUD)
  globalShortcut.register('CommandOrControl+F1', () => {
    console.log('Modo Edición Activado: Ahora puedes hacer clic y mover los widgets.');
    win.setIgnoreMouseEvents(false);
    win.focus();
  });
  
  // Atajo para volver a "Modo Juego" (los clics atraviesan la ventana)
  globalShortcut.register('CommandOrControl+F2', () => {
    console.log('Modo Juego Activado: Los clics pasarán al juego.');
    win.setIgnoreMouseEvents(true, { forward: true });
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