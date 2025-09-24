const { contextBridge, ipcRenderer } = require('electron');

// Exponemos de forma segura el ipcRenderer a la ventana de React
contextBridge.exposeInMainWorld('electronAPI', {
  onSetEditMode: (callback) => ipcRenderer.on('set-edit-mode', callback),
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
});