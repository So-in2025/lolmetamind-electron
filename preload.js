// preload.js - VERSIÓN FINAL PRO-DEV ✅
// Electron 26+ | Next.js | ContextBridge + IPC

const { contextBridge, ipcRenderer } = require('electron');
const path = require('path');
const os = require('os');

// ========================================================
// 🔹 Directorio temporal para TTS
// ========================================================
const TTS_TEMP_DIR = path.join(os.tmpdir(), 'metaMind-tts');

// ========================================================
// 🔹 safeLog: envío de logs al main process y consola
// ========================================================
const safeLog = (...args) => {
    console.log(...args);
    try {
        ipcRenderer.send('overlay-log', args.map(a => (typeof a === 'object' ? JSON.stringify(a) : a)).join(' '));
    } catch (err) {
        console.error('[safeLog] Error enviando overlay-log:', err);
    }
};

// ========================================================
// 🔹 API expuesta al renderer
// ========================================================
contextBridge.exposeInMainWorld('electronAPI', {

    // --------------------------------------------------------
    // Usuario / Login
    // --------------------------------------------------------
    notifyLoginSuccess: (userData) => {
        console.log('[LOGIN] window.electronAPI:', window.electronAPI);
        safeLog('[preload] notifyLoginSuccess invocado con:', userData);
        try {
            ipcRenderer.send('user-logged-in', userData);
            safeLog('[preload] ipcRenderer.send ejecutado correctamente');
        } catch (err) {
            safeLog('[preload] ❌ Error enviando user-logged-in:', err);
        }
    },

    closeApp: () => {
        safeLog('[preload] closeApp invocado');
        try {
            ipcRenderer.send('close-app');
        } catch (err) {
            safeLog('[preload] ❌ Error enviando close-app:', err);
        }
    },

    // --------------------------------------------------------
    // Overlay y LCU
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

        // Desuscripción
        return () => {
            safeLog('[preload] onLcuStateUpdate desuscribiendo listener');
            ipcRenderer.removeListener('lcu-state-update', listener);
        };
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
    // IA / Meta análisis
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
            const token = store.get('hfApiToken') || 'TU_TOKEN_DE_HUGGING_FACE_AQUÍ';
            const filePath = path.join(TTS_TEMP_DIR, `tts-hf-${Date.now()}.wav`);
            safeLog('[preload TTS API] Archivo de salida:', filePath);

            const result = await ipcRenderer.invoke('coqui-tts', { text, rate, pitch, filePath, token });

            if (result?.filePath) {
                safeLog('[preload TTS API] Archivo generado:', result.filePath);
            } else {
                safeLog('[preload TTS API] ⚠ No se generó archivo de audio');
            }
            return result;
        } catch (err) {
            safeLog('[preload TTS API] ❌ Error en IPC TTS:', err);
            return {};
        }
    },

    coquiTtsStop: () => {
        safeLog('[preload TTS API] Stop invocado (No-Op)');
        // La pausa la maneja el hook de React
    }
});
