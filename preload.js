const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
    setAuthToken: (token) => {
        // No es necesario en este flujo, pero se mantiene si lo necesitas después.
    },
    // NOTA: 'verifyLicense' y 'onLicenseMessage' son obsoletos si se eliminó 
    // la lógica de licencia en main.js (como se hizo en la fusión).
    
    windowControl: (action) => ipcRenderer.send('window-control', action),
    
    // FIX CRÍTICO: Nuevo método para que el overlay escuche los mensajes del Coach
    onLiveCoachUpdate: (callback) => {
        // El canal IPC debe coincidir con el usado en main.js
        ipcRenderer.on('live-coach-update', (event, message) => callback(message));
    },

    // Si aún necesita la lógica de licencia:
    // verifyLicense: (key) => ipcRenderer.send('verify-license', key),
    // onLicenseMessage: (callback) => ipcRenderer.on('license-message', (event, message) => callback(message)),
});

// Función para obtener el token del localStorage y enviarlo al proceso principal (si es necesario)
window.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('authToken');
    if (token) {
        ipcRenderer.send('set-auth-token', token);
    }
});