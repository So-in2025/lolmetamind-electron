const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Canales para el Overlay
  setIgnoreMouseEvents: (ignore, forward) => ipcRenderer.send('set-ignore-mouse-events', ignore, forward),
  
  // 🚨 Suscripción LCU: Permite al Renderer escuchar el estado del juego (Tu LCU CORE envia esto)
  onLcuStateUpdate: (callback) => {
    ipcRenderer.removeAllListeners('lcu-state-update'); 
    ipcRenderer.on('lcu-state-update', (event, value) => callback(value));
  },
  
  // 🚨 Comando LCU: Llama a tu función LCU Core en main.js para inyectar runas
  lcuCommand: (method, endpoint, payload) => ipcRenderer.invoke('lcu-command', method, endpoint, payload)
});
