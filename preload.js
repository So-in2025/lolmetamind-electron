// preload.js - VERSIÓN FINAL, UNIFICADA Y COMPLETA

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // --- MÉTODOS DE CONTROL DE VENTANA (Tus originales, mantenidos por claridad) ---
  closeWindow: () => ipcRenderer.send('closeWindow'),
  minimizeWindow: () => ipcRenderer.send('minimizeWindow'),
  showOverlay: () => ipcRenderer.send('showOverlay'),
  hideOverlay: () => ipcRenderer.send('hideOverlay'),
  toggleOverlay: () => ipcRenderer.send('toggleOverlay'),
  
  // --- MÉTODO DE ENVÍO GENÉRICO (Para flexibilidad) ---
  send: (channel, data) => {
    const validSendChannels = ['user-logged-in', 'set-riot-api-key'];
    if (validSendChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    } else {
      console.warn(`[Preload] Intento de enviar a un canal inválido (send): ${channel}`);
    }
  },

  // --- MÉTODOS DE INVOCACIÓN (Para llamadas que esperan respuesta) ---
  getUserData: () => ipcRenderer.invoke('get-user-data'),
  createRunePage: (runeData) => ipcRenderer.invoke('create-rune-page'), // <-- ¡AÑADIDO PARA RUNAS!
  getMetaAnalysis: () => ipcRenderer.invoke('get-meta-analysis'),
  getRecommendations: (payload) => ipcRenderer.invoke('get-recommendations', payload),
  getWeeklyChallenges: () => ipcRenderer.invoke('get-weekly-challenges'),
  analyzeMatches: (payload) => ipcRenderer.invoke('analyze-matches', payload),
  
  // --- MÉTODO DE ESCUCHA (Para recibir eventos del backend) ---
  on: (channel, callback) => {
    const validReceiveChannels = [
      'riot-profile-data',
      'overlay-interaction-toggle',
    ];
    
    if (validReceiveChannels.includes(channel)) {
      const subscription = (event, ...args) => callback(...args);
      ipcRenderer.on(channel, subscription);
      return () => ipcRenderer.removeListener(channel, subscription);
    } else {
      console.warn(`[Preload] Intento de suscribirse a un canal inválido: ${channel}`);
      return () => {};
    }
  },
});