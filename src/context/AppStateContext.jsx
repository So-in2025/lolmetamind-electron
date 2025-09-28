"use client";
import React, { createContext, useContext, useState } from 'react';

// Define los estados posibles del flujo de la aplicación
export const AppFlowState = {
    // Mantenemos LOADING por si lo necesitas en el splash, pero el flujo principal ya no depende de la verificación
    LOADING: 'LOADING',     
    LOGIN: 'LOGIN',         // Pantalla de inicio de sesión/registro
    DASHBOARD: 'DASHBOARD', // Aplicación principal
};

// Crea el contexto
const AppStateContext = createContext(null);

export const AppStateProvider = ({ children }) => {
    // 🚨 CORRECCIÓN CLAVE: El estado inicial se fuerza a LOGIN.
    // Ya no verificamos el token en localStorage al inicio.
    const [flowState, setFlowState] = useState(AppFlowState.LOGIN);
    
    // Si necesitas un estado para datos de usuario global, lo defines aquí
    const [userData, setUserData] = useState(null);

    // 🚨 LÓGICA DE VERIFICACIÓN DE TOKEN EN useEffect HA SIDO ELIMINADA.
    
    const contextValue = {
        flowState,
        setFlowState, // Usado para navegar entre estados (como del Login al Dashboard)
        AppFlowState, // Permite acceder a los nombres de los estados
        userData,
        setUserData,
        // Puedes añadir aquí una función logout() si la necesitas.
    };

    return (
        <AppStateContext.Provider value={contextValue}>
            {children}
        </AppStateContext.Provider>
    );
};

// Hook personalizado para usar el contexto
export const useAppState = () => {
    const context = useContext(AppStateContext);
    if (!context) {
        throw new Error('useAppState debe ser usado dentro de un AppStateProvider');
    }
    return context;
};