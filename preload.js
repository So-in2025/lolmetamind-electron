// preload.js - VERSIÓN CORREGIDA Y FINAL

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // --- 🚨 PASO 1: CORREGIR LAS FUNCIONES DE LOGIN ---
    // Eliminamos 'saveToken' y la reemplazamos con una función que envía el evento correcto.
    notifyLoginSuccess: (userData) => ipcRenderer.send('user-logged-in', userData),
    closeApp: () => ipcRenderer.send('close-app'),

    // --- Funciones del Overlay ---
    setIgnoreMouseEvents: (ignore, forward) => ipcRenderer.send('set-ignore-mouse-events', ignore, forward),
    onLcuStateUpdate: (callback) => {
        ipcRenderer.removeAllListeners('lcu-state-update'); 
        ipcRenderer.on('lcu-state-update', (event, value) => callback(value));
    },

    // --- Funciones para LCU y la IA ---
    getUserData: () => ipcRenderer.invoke('get-user-data'),
    lcuCommand: (method, endpoint, payload) => ipcRenderer.invoke('lcu-command', method, endpoint, payload),
    getMetaAnalysis: (payload) => ipcRenderer.invoke('get-meta-analysis', payload),
    getRecommendations: (payload) => ipcRenderer.invoke('get-recommendations', payload),
    getWeeklyChallenges: (payload) => ipcRenderer.invoke('get-weekly-challenges', payload),
    analyzeMatches: (payload) => ipcRenderer.invoke('analyze-matches', payload),
    getStrategicAdvice: (payload) => ipcRenderer.invoke('get-strategic-advice', payload),
    getLiveCoaching: (payload) => ipcRenderer.invoke('get-live-coaching', payload),
});