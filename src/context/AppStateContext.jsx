// Ruta: src/context/AppStateContext.jsx
'use client';
import React, { createContext, useContext, useState, useEffect } from 'react';

const AppStateContext = createContext(null);

// Definición de la constante de flujo de estados
export const AppFlowState = {
    LOADING: 'LOADING',
    SPLASH: 'SPLASH',
    LOGIN: 'LOGIN', // Ahora incluye Registro y Perfil
    DASHBOARD: 'DASHBOARD',
    // ELIMINADO: ONBOARDING
};

export const AppStateProvider = ({ children }) => {
  const [userId, setUserId] = useState(null);
  const [username, setUsername] = useState(null);
  const [loading, setLoading] = useState(true);
  const [splashLoaded, setSplashLoaded] = useState(false); 
  const [flowState, setFlowState] = useState(AppFlowState.LOADING);

  useEffect(() => {
    const storedId = localStorage.getItem('user_id');

    if (storedId) {
      // Si hay sesión, el estado final será DASHBOARD
      setUserId(storedId);
      setUsername(localStorage.getItem('username'));
    }
    
    setLoading(false);

    // Manejar el evento de fin de carga del Splash Screen
    if (window.ipcRenderer) {
        window.ipcRenderer.on('splash-ready', () => {
            setSplashLoaded(true);
        });
    } else {
        setSplashLoaded(true); 
    }
    
    return () => {
        if (window.ipcRenderer) {
            window.ipcRenderer.removeAllListeners('splash-ready');
        }
    }
  }, []);

  // Lógica para actualizar el flowState después de la carga inicial
  useEffect(() => {
    if (!loading && splashLoaded) {
        if (userId) {
            setFlowState(AppFlowState.DASHBOARD);
        } else {
            setFlowState(AppFlowState.LOGIN);
        }
    }
  }, [loading, splashLoaded, userId]);


  /**
   * Establece la sesión del usuario y cambia el estado a DASHBOARD.
   */
  const setUserSession = (newId, newUsername) => {
    localStorage.setItem('user_id', newId);
    localStorage.setItem('username', newUsername);
    setUserId(newId);
    setUsername(newUsername);
    setFlowState(AppFlowState.DASHBOARD); // Cambia el estado para renderizar el Dashboard
    
    // Notificar a main.js para que abra el Overlay Flotante
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
    setFlowState(AppFlowState.LOGIN); // Vuelve al estado de Login
    // Solo recargar en modo desarrollo si no es Electron
    if (!window.ipcRenderer) {
        window.location.reload();
    }
  };
  
  // Define el estado actual: si está cargando, muestra el SPLASH
  const currentFlowState = loading || !splashLoaded 
    ? AppFlowState.SPLASH 
    : flowState;

  return (
    <AppStateContext.Provider
      value={{
        userId,
        username,
        isAuthenticated: !!userId,
        loading,
        setUserSession,
        logout,
        flowState: currentFlowState, // Flujo que será usado por page.jsx
        AppFlowState, // Constantes de flujo
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