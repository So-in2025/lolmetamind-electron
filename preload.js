const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
    setAuthToken: (token) => {
        // No es necesario en este flujo, pero se mantiene si lo necesitas después.
    },
    verifyLicense: (key) => ipcRenderer.send('verify-license', key),
    windowControl: (action) => ipcRenderer.send('window-control', action),
    onLicenseMessage: (callback) => ipcRenderer.on('license-message', (event, message) => callback(message)),
});

// Función para obtener el token del localStorage y enviarlo al proceso principal (si es necesario)
window.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('authToken');
    if (token) {
        ipcRenderer.send('set-auth-token', token);
    }
});