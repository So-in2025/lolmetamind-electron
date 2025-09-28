// preload.js

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // 🔑 NUEVO IPC: Para guardar la API Key desde el Dashboard.
  setRiotApiKey: (apiKey) => ipcRenderer.send('set-riot-api-key', apiKey),
    
  // 🚨 CRÍTICO: Añadimos closeWindow y quit-app
  closeWindow: () => ipcRenderer.send('closeWindow'),
  minimizeWindow: () => ipcRenderer.send('minimizeWindow'),
  
  // Función para cerrar la aplicación (quitApp se mapea a closeWindow para consistencia)
  quitApp: () => ipcRenderer.send('closeWindow'), 
  
  // Función 'send' para el trigger de polling (user-logged-in)
  send: (channel, data) => {
    if (typeof channel === 'string') {
        ipcRenderer.send(channel, data);
    }
  },
  
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

console.log('[PRELOAD] API de Electron expuesta en window.electronAPI');