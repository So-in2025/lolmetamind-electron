// preload.js - VERSIÓN FINAL CON Coqui TTS (PRO-DEV)
// Todos logs detallados, compatible 100% con useTTS.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // --- Funciones de usuario ---
    notifyLoginSuccess: (userData) => console.log('[preload] notifyLoginSuccess', userData) || ipcRenderer.send('user-logged-in', userData),
    closeApp: () => console.log('[preload] closeApp') || ipcRenderer.send('close-app'),

    // --- Overlay y LCU ---
    setIgnoreMouseEvents: (ignore, forward) => console.log('[preload] setIgnoreMouseEvents', ignore, forward) || ipcRenderer.send('set-ignore-mouse-events', ignore, forward),
    onLcuStateUpdate: (callback) => {
        console.log('[preload] onLcuStateUpdate registrado');
        ipcRenderer.removeAllListeners('lcu-state-update'); 
        ipcRenderer.on('lcu-state-update', (event, value) => {
            console.log('[preload] lcu-state-update recibido', value);
            callback(value);
        });
    },

    getUserData: () => console.log('[preload] getUserData invocado') || ipcRenderer.invoke('get-user-data'),
    lcuCommand: (method, endpoint, payload) => console.log('[preload] lcuCommand', method, endpoint, payload) || ipcRenderer.invoke('lcu-command', method, endpoint, payload),

    // --- IA ---
    getMetaAnalysis: (payload) => console.log('[preload] getMetaAnalysis', payload) || ipcRenderer.invoke('get-meta-analysis', payload),
    getRecommendations: (payload) => console.log('[preload] getRecommendations', payload) || ipcRenderer.invoke('get-recommendations', payload),
    getWeeklyChallenges: (payload) => console.log('[preload] getWeeklyChallenges', payload) || ipcRenderer.invoke('get-weekly-challenges', payload),
    analyzeMatches: (payload) => console.log('[preload] analyzeMatches', payload) || ipcRenderer.invoke('analyze-matches', payload),
    getStrategicAdvice: (payload) => console.log('[preload] getStrategicAdvice', payload) || ipcRenderer.invoke('get-strategic-advice', payload),
    getLiveCoaching: (payload) => console.log('[preload] getLiveCoaching', payload) || ipcRenderer.invoke('get-live-coaching', payload),

    // --- 🚀 Coqui TTS ---
    coquiTtsSpeak: async (text, rate = 1.0, pitch = 1.0) => {
        console.log('[preload Coqui TTS] Invocado con texto:', text, 'rate:', rate, 'pitch:', pitch);
        if (!text) {
            console.warn('[preload Coqui TTS] Texto vacío, no se reproducirá nada');
            return {};
        }

        try {
            const result = await ipcRenderer.invoke('coqui-tts', { text, rate, pitch });
            if (result?.filePath) {
                console.log('[preload Coqui TTS] Archivo generado:', result.filePath);
            } else {
                console.warn('[preload Coqui TTS] ⚠ No se generó archivo de audio');
            }
            return result;
        } catch (err) {
            console.error('[preload Coqui TTS] ❌ Error en IPC:', err);
            return {};
        }
    },

    coquiTtsStop: () => {
        console.log('[preload Coqui TTS] Stop invocado');
        if (typeof window !== 'undefined' && window.speechSynthesis) {
            console.log('[preload Coqui TTS] Cancelando cualquier TTS en curso');
            window.speechSynthesis.cancel();
        }
    }
});
