const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
    setAuthToken: (token) => {
        // Lógica de token (se mantiene)
    },
    //verifyLicense: (key) => ipcRenderer.send('verify-license', key),
    windowControl: (action) => ipcRenderer.send('window-control', action),
    //onLicenseMessage: (callback) => ipcRenderer.on('license-message', (event, message) => callback(message)),

    // 🟢 CRÍTICO: Función que expone el listener para los mensajes del coach
    onLiveCoachUpdate: (callback) => {
        // El canal IPC que recibe mensajes del main.js
        ipcRenderer.on('live-coach-update', (event, message) => callback(message));
    },
});

window.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('authToken');
    if (token) {
        ipcRenderer.send('set-auth-token', token);
    }
});