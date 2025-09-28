// preload.js

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // 🚨 CRÍTICO: Añadimos closeWindow y quit-app
  closeWindow: () => ipcRenderer.send('closeWindow'),
  minimizeWindow: () => ipcRenderer.send('minimizeWindow'), // Si lo deseas
  
  // Función para cerrar la aplicación (quitApp se mapea a closeWindow para consistencia)
  quitApp: () => ipcRenderer.send('closeWindow'), // Mapeamos el antiguo 'quitApp' también
  // Función para el login con Google (Eliminada, pero mantenemos el mapeo si existe)
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