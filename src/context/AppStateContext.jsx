"use client";
import React, { createContext, useContext, useState, useEffect } from 'react';

// Define los estados posibles del flujo de la aplicación
export const AppFlowState = {
    LOADING: 'LOADING',     
    LOGIN: 'LOGIN',         
    DASHBOARD: 'DASHBOARD', 
};

// Crea el contexto
const AppStateContext = createContext(null);

export const AppStateProvider = ({ children }) => {
    // Estado inicial: LOADING
    const [flowState, setFlowState] = useState(AppFlowState.LOADING);
    const [userData, setUserData] = useState(null); 

    // Efecto para verificar la autenticación al cargar la aplicación
    useEffect(() => {
        const checkAuth = () => {
            const token = localStorage.getItem('authToken');

            if (token) {
                setFlowState(AppFlowState.DASHBOARD);
            } else {
                setFlowState(AppFlowState.LOGIN);
            }
        };

        checkAuth();
    }, []);

    const contextValue = {
        flowState,
        setFlowState, 
        AppFlowState, 
        userData,
        setUserData,
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