const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // Manejo de la Sesión y Persistencia (usando Electron Store)
    setSessionState: (state) => ipcRenderer.invoke('session:set-state', state),
    getSessionState: () => ipcRenderer.invoke('session:get-state'),
    
    // 🚨 CAMBIO CRÍTICO: Inicia el flujo de autenticación Web (OAuth)
    signInGoogle: () => ipcRenderer.invoke('auth:google'),
    
    // Manejo del Formulario de Perfil (Onboarding)
    setSummonerProfile: (data) => ipcRenderer.invoke('config:set-profile', data), 
    
    // Manejo de Overlays
    setOverlayVisibility: (visible) => ipcRenderer.send('overlay:set-visibility', visible),
    onCoachUpdate: (callback) => ipcRenderer.on('live-coach-update', callback), 
});
