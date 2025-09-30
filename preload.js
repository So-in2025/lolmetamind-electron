// preload.js - FINAL Y CORREGIDO
"use client"

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  /**
   * Envía un mensaje unidireccional al proceso principal.
   */
  send: (channel, data) => {
    const validSendChannels = [
        'closeWindow', 
        'minimizeWindow', 
        'user-logged-in', 
        'set-riot-api-key',
        'toggle-overlay' // >>> CRÍTICO: DEBE ESTAR AQUÍ <<<
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
        'analyze-matches',
        'get-live-coaching' // Esto está correcto
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
      'riot-profile-data',
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