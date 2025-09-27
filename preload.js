// preload.js

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Función para cerrar la aplicación
  quitApp: () => ipcRenderer.send('quit-app'),
  // Función para el login con Google
  googleLogin: () => ipcRenderer.invoke('google-login'),
  // El resto de tus funciones
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getStoreValue: (key) => ipcRenderer.invoke('get-store-value', key),
  setStoreValue: (key, value) => ipcRenderer.send('set-store-value', { key, value }),
  openExternalLink: (url) => ipcRenderer.send('open-external-link', url),
  on: (channel, callback) => {
    const validChannels = ['websocket-message', 'live-game-update'];
    if (validChannels.includes(channel)) {
      const subscription = (event, ...args) => callback(...args);
      ipcRenderer.on(channel, subscription);
      return () => ipcRenderer.removeListener(channel, subscription);
    }
  },
});