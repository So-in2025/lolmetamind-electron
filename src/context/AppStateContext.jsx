// src/context/AppStateContext.jsx
// Este archivo define el Contexto de React para gestionar el estado global de la aplicación.
// Controla el flujo principal (qué pantalla mostrar) y almacena los datos del usuario
// una vez que ha iniciado sesión, haciéndolos accesibles desde cualquier componente.

"use client";

import React, { createContext, useContext, useState, useMemo } from 'react';

// Define un objeto inmutable para los estados posibles del flujo de la aplicación.
// Usar un objeto como este previene errores de tipeo y hace el código más legible.
export const AppFlowState = Object.freeze({
    LOGIN: 'LOGIN',
    LOADING: 'LOADING', // Estado intermedio para transiciones o cargas iniciales
    DASHBOARD: 'DASHBOARD'
});

// Crea el contexto de la aplicación.
const AppStateContext = createContext();

/**
 * El Proveedor de Estado (Provider) que envolverá toda la aplicación.
 * Contiene la lógica de estado y lo provee a todos los componentes hijos.
 * @param {object} props - Propiedades del componente, incluyendo `children`.
 */
export const AppStateProvider = ({ children }) => {
    // Estado para controlar el flujo de la aplicación (qué pantalla se muestra).
    // Inicia en la pantalla de LOGIN.
    const [flowState, setFlowState] = useState(AppFlowState.LOGIN);
    
    // Estado para almacenar los datos del usuario después de un inicio de sesión exitoso.
    const [userData, setUserData] = useState(null);

    // `useMemo` se usa para optimizar el rendimiento.
    // Asegura que el objeto `contextValue` solo se recalcule si `flowState` o `userData` cambian.
    // Esto previene re-renderizados innecesarios en los componentes que consumen el contexto.
    const contextValue = useMemo(() => ({
        flowState,
        setFlowState,
        AppFlowState, // Exportamos el enum para que sea fácil de usar en otros componentes
        userData,
        setUserData,
    }), [flowState, userData]);

    return (
        <AppStateContext.Provider value={contextValue}>
            {children}
        </AppStateContext.Provider>
    );
};

/**
 * Hook personalizado para consumir el AppStateContext de forma sencilla y segura.
 * Proporciona una forma limpia de acceder al estado global desde cualquier componente.
 * @returns {object} El valor del contexto, que incluye `flowState`, `setFlowState`, etc.
 */
export const useAppState = () => {
    const context = useContext(AppStateContext);
    
    // Si un componente intenta usar este hook fuera del AppStateProvider,
    // lanzará un error, lo cual ayuda a detectar problemas de implementación.
    if (context === undefined) {
        throw new Error('useAppState debe ser usado dentro de un AppStateProvider');
    }
    
    return context;
};
