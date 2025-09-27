// Ruta: src/context/AppStateContext.jsx
'use client';
import React, { createContext, useContext, useState, useEffect } from 'react';

const AppStateContext = createContext(null);

export const AppStateProvider = ({ children }) => {
  const [userId, setUserId] = useState(null);
  const [username, setUsername] = useState(null);
  const [loading, setLoading] = useState(true);
  const [splashLoaded, setSplashLoaded] = useState(false); // Estado para el Splash Screen

  useEffect(() => {
    // 1. Cargar la sesión persistente
    const storedId = localStorage.getItem('user_id');
    const storedUsername = localStorage.getItem('username');

    if (storedId) {
      setUserId(storedId);
      setUsername(storedUsername);
    }
    setLoading(false);
    
    // 2. Manejar el evento de fin de carga del Splash Screen
    if (window.ipcRenderer) {
        // Asume que 'splash-ready' es el evento enviado desde preload/main.js
        window.ipcRenderer.on('splash-ready', () => {
            setSplashLoaded(true);
        });
    } else {
        // Fallback inmediato si no estamos en Electron
        setSplashLoaded(true); 
    }
    
    // Limpieza de listener
    return () => {
        if (window.ipcRenderer) {
            window.ipcRenderer.removeAllListeners('splash-ready');
        }
    }
  }, []);

  /**
   * Establece la sesión del usuario después de un login/registro exitoso.
   */
  const setUserSession = (newId, newUsername) => {
    localStorage.setItem('user_id', newId);
    localStorage.setItem('username', newUsername);
    setUserId(newId);
    setUsername(newUsername);
    
    // CRÍTICO: Notificar al proceso principal (main.js) para abrir el Overlay
    if (window.ipcRenderer) {
      window.ipcRenderer.send('user-logged-in', { id: newId, username: newUsername });
    }
  };
  
  /**
   * Cierra la sesión del usuario.
   */
  const logout = () => {
    localStorage.removeItem('user_id');
    localStorage.removeItem('username');
    setUserId(null);
    setUsername(null);
    // Forzar recarga a la pantalla de Login
    window.location.reload(); 
  };

  return (
    <AppStateContext.Provider
      value={{
        userId,
        username,
        isAuthenticated: !!userId,
        loading,
        splashLoaded, // Exporta el estado del splash
        setUserSession,
        logout,
      }}
    >
      {children}
    </AppStateContext.Provider>
  );
};

export const useAppState = () => {
  const context = useContext(AppStateContext);
  if (context === undefined) {
    throw new Error('useAppState debe ser usado dentro de AppStateProvider');
  }
  return context;
};