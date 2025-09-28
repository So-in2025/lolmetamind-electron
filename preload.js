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
  
  // 🔑 FUNCIÓN DE RECEPCIÓN (on): Corregida y Añadida la funcionalidad de Riot API
  on: (channel, callback) => {
    // AÑADIDO: 'riot-profile-data' para recibir los datos de Ligas/Maestrías desde main.js
    const validChannels = ['websocket-message', 'live-game-update', 'riot-profile-data']; 
    if (validChannels.includes(channel)) {
      const subscription = (event, ...args) => callback(event, ...args);
      ipcRenderer.on(channel, subscription);
    }
  },
  
  // 🔑 FUNCIÓN DE LIMPIEZA: Necesaria para el hook de React
  removeListener: (channel, callback) => {
    const validChannels = ['websocket-message', 'live-game-update', 'riot-profile-data'];
    if (validChannels.includes(channel)) {
        ipcRenderer.removeListener(channel, callback);
    }
  },
});