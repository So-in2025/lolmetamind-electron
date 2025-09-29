// preload.js - VERSIÓN FINAL-FINAL, COMPLETA Y UNIFICADA

const { contextBridge, ipcRenderer } = require('electron');


contextBridge.exposeInMainWorld('electronAPI', {
  send: (channel, data) => {
    const validSendChannels = ['closeWindow', 'minimizeWindow', 'user-logged-in', 'set-riot-api-key'];
    if (validSendChannels.includes(channel)) ipcRenderer.send(channel, data);
  },

  invoke: (channel, data) => {
    const validInvokeChannels = ['get-user-data', 'create-rune-page', 'get-meta-analysis', 'get-recommendations', 'get-weekly-challenges', 'analyze-matches'];
    if (validInvokeChannels.includes(channel)) return ipcRenderer.invoke(channel, data);
  },

  on: (channel, callback) => {
    const validReceiveChannels = ['riot-profile-data', 'overlay-interaction-toggle']; // <-- YA ESTÁ AQUÍ
    if (validReceiveChannels.includes(channel)) {
      const subscription = (event, ...args) => callback(...args);
      ipcRenderer.on(channel, subscription);
      return () => ipcRenderer.removeListener(channel, subscription);
    }
    return () => {};
  },
});
/**
 * Expone un objeto 'electronAPI' en el objeto global 'window' del proceso de renderizado.
 * Este objeto contiene funciones que permiten al frontend interactuar de forma segura
 * con el proceso principal de Electron.
 */
contextBridge.exposeInMainWorld('electronAPI', {
  
  // --- MÉTODOS DE ENVÍO (Frontend -> Backend, sin esperar respuesta) ---

  /**
   * Envía un mensaje unidireccional al proceso principal.
   * @param {string} channel - El canal IPC al que se envía.
   * @param {*} [data] - Los datos a enviar (opcional).
   */
  send: (channel, data) => {
    // Lista de canales de envío válidos para mayor seguridad
    const validSendChannels = [
        'closeWindow', 
        'minimizeWindow', 
        'user-logged-in', 
        'set-riot-api-key',
        'showOverlay',
        'hideOverlay',
        'toggleOverlay'
    ];
    if (validSendChannels.includes(channel)) {
        ipcRenderer.send(channel, data);
    } else {
        console.warn(`[Preload] Intento de enviar a un canal inválido: ${channel}`);
    }
  },

  // --- MÉTODOS DE INVOCACIÓN (Frontend -> Backend, esperando una respuesta/Promesa) ---

  /**
   * Invoca una función en el proceso principal y espera una respuesta.
   * @param {string} channel - El canal IPC que se invoca.
   * @param {*} [data] - Los datos a enviar (opcional).
   * @returns {Promise<any>} - Una promesa que se resuelve con la respuesta del proceso principal.
   */
  invoke: (channel, data) => {
    // Lista de canales de invocación válidos para mayor seguridad
    const validInvokeChannels = [
        'get-user-data',
        'create-rune-page', // <-- ¡NUEVO CANAL PARA RUNAS!
        'get-meta-analysis',
        'get-recommendations',
        'get-weekly-challenges',
        'analyze-matches'
    ];
    if (validInvokeChannels.includes(channel)) {
        return ipcRenderer.invoke(channel, data);
    } else {
        console.warn(`[Preload] Intento de invocar un canal inválido: ${channel}`);
        return Promise.reject(new Error(`Canal de invocación inválido: ${channel}`));
    }
  },

  // --- MÉTODO DE ESCUCHA (Backend -> Frontend, para recibir eventos) ---

  /**
   * Se suscribe a un canal para recibir eventos desde el proceso principal.
   * @param {string} channel - El canal IPC al que se suscribe.
   * @param {function} callback - La función que se ejecutará con los datos recibidos.
   * @returns {function} - Una función para desuscribirse y limpiar el listener.
   */
  on: (channel, callback) => {
    // Lista de canales de escucha válidos
    const validReceiveChannels = [
      'riot-profile-data', // Canal principal para los datos de LCU y Riot API
      'overlay-interaction-toggle',
    ];
    
    if (validReceiveChannels.includes(channel)) {
      // Creamos un listener que solo pasa los argumentos, no el objeto de evento
      const subscription = (event, ...args) => callback(...args);
      ipcRenderer.on(channel, subscription);
      
      // Devolvemos una función de limpieza para que React pueda desuscribirse
      return () => ipcRenderer.removeListener(channel, subscription);
    } else {
      console.warn(`[Preload] Intento de suscribirse a un canal inválido: ${channel}`);
      return () => {}; // Devolvemos una función vacía para evitar errores
    }
  },

  
});