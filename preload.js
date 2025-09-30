// preload.js - VERSIÓN FINAL Y COMPLETA

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  /**
   * Envía un mensaje unidireccional al proceso principal.
   */
  send: (channel, data) => {
    // Lista blanca de canales seguros para enviar
    const validSendChannels = [
        'closeWindow', 
        'minimizeWindow', 
        'user-logged-in', 
        'set-riot-api-key' // Permite el envío de la API Key
    ];
    if (validSendChannels.includes(channel)) {
        ipcRenderer.send(channel, data);
    }
  },

  /**
   * Invoca una función en el proceso principal y espera una respuesta.
   */
  invoke: (channel, data) => {
    const validInvokeChannels = [
        'get-user-data',
        'create-rune-page',
        'get-meta-analysis',
        'get-recommendations',
        'get-weekly-challenges',
        'analyze-matches'
    ];
    if (validInvokeChannels.includes(channel)) {
        return ipcRenderer.invoke(channel, data);
    }
    return Promise.reject(new Error(`Canal de invocación inválido: ${channel}`));
  },

  /**
   * Se suscribe a un canal para recibir eventos desde el proceso principal.
   */
  on: (channel, callback) => {
    const validReceiveChannels = [
      'riot-profile-data', // Canal de recepción para datos y ERRORES de Riot API/LCU
      'overlay-interaction-toggle',
    ];
    if (validReceiveChannels.includes(channel)) {
      const subscription = (event, ...args) => callback(...args);
      ipcRenderer.on(channel, subscription);
      return () => ipcRenderer.removeListener(channel, subscription);
    }
    return () => {};
  },
});