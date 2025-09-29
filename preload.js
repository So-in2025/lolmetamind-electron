// preload.js

const { contextBridge, ipcRenderer } = require('electron');

/**
 * Expone un objeto 'electronAPI' en el objeto global 'window' del proceso de renderizado.
 * Este objeto contiene funciones que permiten al frontend interactuar de forma segura
 * con el proceso principal de Electron y sus APIs.
 *
 * NOTA: Todas las funciones aquí utilizan `ipcRenderer.send` para enviar mensajes
 * síncronos o asíncronos unidireccionales, o `ipcRenderer.invoke` para llamadas
 * bidireccionales que esperan una respuesta (promesa).
 */
contextBridge.exposeInMainWorld('electronAPI', {
  // --- Control de Ventana ---
  // Envía un mensaje al proceso principal para cerrar la ventana actual.
  closeWindow: () => ipcRenderer.send('closeWindow'),
  // Envía un mensaje al proceso principal para minimizar la ventana actual.
  minimizeWindow: () => ipcRenderer.send('minimizeWindow'),
  // Envía un mensaje al proceso principal para mostrar el overlay.
  showOverlay: () => ipcRenderer.send('showOverlay'),
  // Envía un mensaje al proceso principal para ocultar el overlay.
  hideOverlay: () => ipcRenderer.send('hideOverlay'),
  // Envía un mensaje al proceso principal para alternar la visibilidad del overlay.
  toggleOverlay: () => ipcRenderer.send('toggleOverlay'),


  // --- Autenticación y Datos de Usuario ---
  // Envía los datos de usuario al proceso principal después de un login exitoso.
  sendLogin: (userData) => ipcRenderer.send('user-logged-in', userData),
  // Invoca un manejador en el proceso principal para obtener los datos de usuario almacenados.
  // Retorna una Promesa con los datos del usuario.
  getUserData: () => ipcRenderer.invoke('get-user-data'),

  // --- Configuración ---
  // Envía la clave de la API de Riot al proceso principal para que se almacene.
  setRiotApiKey: (apiKey) => ipcRenderer.send('set-riot-api-key', apiKey),

  // --- Funciones de IA (proxy a través del backend) ---
  // Invoca un manejador en el proceso principal para obtener el análisis del meta actual.
  getMetaAnalysis: () => ipcRenderer.invoke('get-meta-analysis'),
  // Invoca un manejador en el proceso principal para obtener recomendaciones personalizadas.
  // Puede incluir un payload con datos adicionales (ej. campeón o rol favorito).
  getRecommendations: (payload) => ipcRenderer.invoke('get-recommendations', payload),
  // Invoca un manejador en el proceso principal para obtener desafíos semanales generados por IA.
  getWeeklyChallenges: () => ipcRenderer.invoke('get-weekly-challenges'),
  // Invoca un manejador en el proceso principal para analizar las últimas partidas del usuario.
  // Puede incluir un payload con datos adicionales (ej. tipo de análisis).
  analyzeMatches: (payload) => ipcRenderer.invoke('analyze-matches', payload),


  // --- Listeners para datos en tiempo real del proceso principal ---
  // Permite al proceso de renderizado suscribirse a eventos enviados desde el proceso principal.
  // Se utiliza para datos de polling (ej. de LCU/Riot API).
  // @param {string} channel - El nombre del canal al que suscribirse.
  // @param {function} callback - La función que se ejecutará cuando se reciba un mensaje en el canal.
  // @returns {function} Una función para desuscribirse del evento (limpieza).
  on: (channel, callback) => {
    // Define los canales válidos para prevenir suscripciones a canales arbitrarios.
    const validChannels = [
      'riot-profile-data',     // Datos de Riot API/LCU (historial, ligas, etc.)
      'live-game-update',      // Actualizaciones del juego en vivo (si el overlay está activo)
      // Agrega aquí cualquier otro canal que tu `main.js` envíe al frontend.
    ];
    
    if (validChannels.includes(channel)) {
      // Wrapper para la función de callback que ignora el objeto de evento de IPC.
      const subscription = (event, ...args) => callback(...args);
      ipcRenderer.on(channel, subscription);
      // Retorna una función para que el componente de React pueda desuscribirse limpiamente.
      return () => ipcRenderer.removeListener(channel, subscription);
    } else {
      console.warn(`[Preload] Intento de suscribirse a canal inválido: ${channel}`);
      return () => {}; // Retorna una no-op function para evitar errores.
    }
  },

  // --- Métodos para desuscribirse explícitamente (alternativa a la función de retorno de `on`) ---
  // (Aunque la función de retorno de `on` es preferible en React, estos pueden ser útiles)
  off: (channel, callback) => {
    const validChannels = [
      'riot-profile-data',
      'live-game-update',
    ];
    if (validChannels.includes(channel)) {
      ipcRenderer.removeListener(channel, callback);
    }
  },
});