// src/context/AppStateContext.jsx - VERSIÓN CORREGIDA Y SIMPLIFICADA
'use client';

import React, { createContext, useContext, useState } from 'react';

// 1. Estado inicial simple. La aplicación siempre empieza sin autenticar.
const initialState = {
    userData: null, 
    isLoadingUser: false, // Ya no necesitamos empezar en estado de "cargando".
    isAuthenticated: false,
};

// 2. Creamos el contexto.
export const AppStateContext = createContext({
    ...initialState,
    setAppState: () => {},
});

export const AppStateProvider = ({ children }) => {
    // 3. El estado se inicializa con los valores por defecto.
    const [appState, setAppState] = useState(initialState);

    // 4. 🚨 Se ha eliminado el `useEffect` que intentaba hacer el auto-login.
    //    El contexto ahora es "pasivo" y solo cambiará cuando el LoginScreen
    //    o un botón de Logout le digan explícitamente que lo haga.

    // 5. Proporcionamos el estado y la función para cambiarlo.
    return (
        <AppStateContext.Provider value={{ ...appState, setAppState }}>
            {children}
        </AppStateContext.Provider>
    );
};

// 6. El hook para usar el contexto se mantiene igual.
export const useAppState = () => useContext(AppStateContext);