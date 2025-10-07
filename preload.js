// preload.js - VERSIÓN FINAL ESTABLE Y BLINDADA
// Electron 26+ | Next.js | ContextBridge + IPC

const { contextBridge, ipcRenderer } = require('electron');
// PRO-DEV FIX: Se eliminan todos los requires de Node.js de alto nivel (path, os, Store)
// para evitar el CRASH SILENCIOSO en el Context Bridge. Solo se mantienen los esenciales de Electron.

// --------------------------------------------------------
// Helpers PRO-DEV (Se mantiene la función safeLog)
// --------------------------------------------------------

// Función utilitaria que envía logs al main process (visible en la terminal)
const safeLog = (...args) => {
    try {
        // PRO-DEV CRITICAL: Envía el log al main process para diagnóstico.
        ipcRenderer.send('overlay-log', args.map(a => (typeof a === 'object' ? JSON.stringify(a) : a)).join(' '));
    } catch (err) {
        // En caso de un fallo en ipcRenderer.send (lo que indica un crash total), este log es inútil,
        // pero se mantiene por estructura.
        console.error('[safeLog - CRITICAL ERROR] Fallo al intentar enviar log al main:', err);
    }
};

// Función asíncrona para obtener valores de la Store desde el Main Process
async function getStoreValue(key) {
  try {
    return await ipcRenderer.invoke('get-store-value', key);
  } catch (err) {
    safeLog('[PRELOAD ERROR] getStoreValue falló:', err.message);
    return null;
  }
}

// ========================================================
// 🔹 API expuesta al renderer (Context Bridge)
// CRÍTICO: Esta es la parte que debe ejecutarse.
// ========================================================
contextBridge.exposeInMainWorld('electronAPI', {

    // --------------------------------------------------------
    // Usuario / Login
    // --------------------------------------------------------
    notifyLoginSuccess: (userData) => {
        // PRO-DEV CRITICAL: Log antes de enviar el IPC. Si este log no llega, el fallo es en el require de electron-store.
        safeLog('[PRELOAD CRITICAL] Intentando IPC: user-logged-in');
        safeLog('[PRELOAD DEBUG] Datos de usuario a enviar:', userData.username);

        try {
            // CRÍTICO: El canal debe coincidir exactamente con el listener en main.js
            ipcRenderer.send('user-logged-in', userData);
            safeLog('[PRELOAD CRITICAL] ✅ ipcRenderer.send(user-logged-in) ejecutado correctamente');
        } catch (err) {
            safeLog('[PRELOAD CRITICAL] ❌ Error enviando user-logged-in:', err.message);
        }
    },

    // --------------------------------------------------------
    // Control de Ventanas y Configuración (Todos usan ipcRenderer.send)
    // --------------------------------------------------------
    closeWindow: () => {
        safeLog('[preload] closeWindow invocado (Redirigido a close-app)');
        ipcRenderer.send('close-app');
    },

    closeApp: () => {
        safeLog('[preload] closeApp invocado');
        try {
            ipcRenderer.send('close-app');
        } catch (err) {
            safeLog('[preload] ❌ Error enviando close-app:', err);
        }
    },

    minimizeWindow: () => ipcRenderer.send('minimizeWindow'),
    setRiotApiKey: (apiKey) => ipcRenderer.send('set-riot-api-key', apiKey),

    // --------------------------------------------------------
    // Overlay y LCU (Implementación usando solo IPC nativo)
    // --------------------------------------------------------
    setIgnoreMouseEvents: (ignore, forward) => {
        safeLog('[preload] setIgnoreMouseEvents', ignore, forward);
        try {
            ipcRenderer.send('set-ignore-mouse-events', ignore, forward);
        } catch (err) {
            safeLog('[preload] ❌ Error enviando set-ignore-mouse-events:', err);
        }
    },

    onLcuStateUpdate: (callback) => {
        safeLog('[preload] onLcuStateUpdate registrado');
        ipcRenderer.removeAllListeners('lcu-state-update');
        const listener = (event, value) => {
            safeLog('[preload] lcu-state-update recibido:', value);
            callback(value);
        };
        ipcRenderer.on('lcu-state-update', listener);

        return () => ipcRenderer.removeListener('lcu-state-update', listener);
    },
    
    onRiotProfileData: (callback) => {
        safeLog('[preload] onRiotProfileData registrado');
        ipcRenderer.removeAllListeners('riot-profile-data');
        const listener = (event, value) => {
            safeLog('[preload] riot-profile-data recibido:', value);
            callback(value);
        };
        ipcRenderer.on('riot-profile-data', listener);

        return () => ipcRenderer.removeListener('riot-profile-data', listener);
    },


    getUserData: () => {
        safeLog('[preload] getUserData invocado');
        return ipcRenderer.invoke('get-user-data');
    },

    lcuCommand: (method, endpoint, payload) => {
        safeLog('[preload] lcuCommand', method, endpoint, payload);
        return ipcRenderer.invoke('lcu-command', method, endpoint, payload);
    },

    // --------------------------------------------------------
    // IA / Meta análisis (Todos usan ipcRenderer.invoke)
    // --------------------------------------------------------
    getMetaAnalysis: (payload) => {
        safeLog('[preload] getMetaAnalysis', payload);
        return ipcRenderer.invoke('get-meta-analysis', payload);
    },
    
    getRecommendations: (payload) => {
        safeLog('[preload] getRecommendations', payload);
        return ipcRenderer.invoke('get-recommendations', payload);
    },

    getWeeklyChallenges: (payload) => {
        safeLog('[preload] getWeeklyChallenges', payload);
        return ipcRenderer.invoke('get-weekly-challenges', payload);
    },

    analyzeMatches: (payload) => {
        safeLog('[preload] analyzeMatches', payload);
        return ipcRenderer.invoke('analyze-matches', payload);
    },

    getStrategicAdvice: (payload) => {
        safeLog('[preload] getStrategicAdvice', payload);
        return ipcRenderer.invoke('get-strategic-advice', payload);
    },

    getLiveCoaching: (payload) => {
        safeLog('[preload] getLiveCoaching', payload);
        return ipcRenderer.invoke('get-live-coaching', payload);
    },

    
    // --------------------------------------------------------
    // ☁️ TTS API (Hugging Face)
    // --------------------------------------------------------
    coquiTtsSpeak: async (text, rate = 1.0, pitch = 1.0) => {
        safeLog('[preload TTS API] Invocado con texto:', text, 'rate:', rate, 'pitch:', pitch);
        if (!text) {
            safeLog('[preload TTS API] Texto vacío, no se reproducirá nada');
            return {};
        }
        try {
            // ¡ELIMINADO! NO INTENTAMOS LEER EL TOKEN AQUÍ.
            // La responsabilidad de obtener la clave hfApiToken de la Store
            // recae COMPLETAMENTE en el proceso Main (main.js).
            
            const result = await ipcRenderer.invoke('coqui-tts', { text, rate, pitch }); 

            if (result?.filePath) {
                safeLog('[preload TTS API] Archivo generado por Main:', result.filePath);
            } else {
                safeLog('[preload TTS API] ❌ Fallo en la generación o el proceso Python devolvió un error.');
            }
            return result;
        } catch (err) {
            safeLog(`[preload TTS API] ❌ Error en IPC TTS: ${err.message}`);
            return {};
        }
    },

    coquiTtsStop: () => {
        safeLog('[preload TTS API] Stop invocado (No-Op)');
        // La pausa la maneja el hook de React
    },

    // ✅ CORRECCIÓN: Se añade el canal que faltaba para la comunicación del Splash Screen.
    onTtsStatusUpdate: (callback) => ipcRenderer.on('tts-status', (event, ...args) => callback(...args))
});