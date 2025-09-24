const { app, BrowserWindow, globalShortcut } = require('electron');
const path = require('path');
const isDev = process.env.NODE_ENV === 'development';

function createWindow() {
  const win = new BrowserWindow({
    width: 600,
    height: 400,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  win.setIgnoreMouseEvents(true, { forward: true });

  const urlToLoad = isDev
    ? 'http://localhost:3000/overlay'
    : `file://${path.join(__dirname, 'out/overlay/index.html')}`;

  win.loadURL(urlToLoad);

  // Atajos para la manejabilidad
  globalShortcut.register('CommandOrControl+F1', () => {
    win.setIgnoreMouseEvents(false);
    win.focus();
  });
  
  globalShortcut.register('CommandOrControl+F2', () => {
    win.setIgnoreMouseEvents(true, { forward: true });
  });

  if (isDev) {
    win.webContents.openDevTools({ mode: 'detach' });
  }
}

app.whenReady().then(() => {
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
