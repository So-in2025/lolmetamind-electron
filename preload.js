const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Canales para el overlay
  onSetEditMode: (callback) => ipcRenderer.on('set-edit-mode', callback),
  onNewGameEvent: (callback) => ipcRenderer.on('new-game-event', callback),
  onWebsocketStatus: (callback) => ipcRenderer.on('websocket-status', callback),
  onNewBuildAdvice: (callback) => ipcRenderer.on('new-build-advice', callback),
  onNewStrategyAdvice: (callback) => ipcRenderer.on('new-strategy-advice', callback),
  
  // Canales para la ventana de licencia
  send: (channel, data) => ipcRenderer.send(channel, data),
  on: (channel, func) => ipcRenderer.on(channel, (event, ...args) => func(...args)),

  // Limpiador general
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
});

// Para la ventana de licencia simple, exponemos ipcRenderer directamente
// Esto es menos seguro, pero aceptable para una ventana tan simple.
if (process.contextIsolated) {
  // El preload principal no necesita esto
} else {
  window.ipcRenderer = require('electron').ipcRenderer;
}
