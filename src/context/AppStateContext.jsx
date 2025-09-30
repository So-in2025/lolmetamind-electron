// src/context/AppStateContext.jsx
"use client"

import React, { createContext, useContext, useState } from 'react';

// >>> EXPORTACIÓN CRÍTICA: Se define y exporta correctamente para que otros módulos lo importen.
export const AppFlowState = {
    LOADING: 'LOADING',
    LOGIN: 'LOGIN',
    DASHBOARD: 'DASHBOARD',
};

// Definición de un tipo de perfil de usuario más completo
const initialUserProfile = {
    isAuthenticated: false,
    username: null,
    token: null,
    // CAMPOS AÑADIDOS DESDE LA API /profile
    userId: null, 
    summonerName: null, 
    tagline: null, 
    region: null,
    zodiacSign: null,
    puuid: null, 
    favRole1: null,
    favChamp1: null,
};

const AppStateContext = createContext();

export const AppStateProvider = ({ children }) => {
    const [userProfile, setUserProfile] = useState(initialUserProfile);
    // CRÍTICO: Inicializar flowState a LOGIN.
    const [flowState, setFlowState] = useState(AppFlowState.LOGIN); 
    const [liveGameData, setLiveGameData] = useState(null);
    
    /**
     * Actualiza el perfil con data completa desde la API de login/profile.
     */
    const updateProfileFromApi = (data) => {
        if (!data) return;
        setUserProfile(prev => ({
            ...prev,
            userId: data.userId,
            summonerName: data.summonerName || prev.summonerName, 
            tagline: data.tagline || prev.tagline,
            region: data.region || prev.region,
            zodiacSign: data.zodiacSign || prev.zodiacSign,
            puuid: data.puuid || prev.puuid,
            favRole1: data.favRole1 || prev.favRole1,
            favChamp1: data.favChamp1 || prev.favChamp1,
            isAuthenticated: !!data.userId,
        }));
    };

    /**
     * Solo para el login inicial, guarda token y username.
     */
    const login = (username, token) => {
        setUserProfile(prev => ({
            ...prev,
            isAuthenticated: true,
            username,
            token,
        }));
    };

    const logout = () => {
        setUserProfile(initialUserProfile);
        setLiveGameData(null);
        setFlowState(AppFlowState.LOGIN);
    };

    const value = {
        userProfile,
        userData: userProfile, // Para usar en LoginScreen/AppPage
        liveGameData,
        flowState,
        AppFlowState, // Exportamos para uso directo
        login,
        logout,
        setLiveGameData,
        setFlowState, // CRÍTICO: Exportar setFlowState
        setUserData: setUserProfile,
        updateProfileFromApi,
    };

    return (
        <AppStateContext.Provider value={value}>
            {children}
        </AppStateContext.Provider>
    );
};

export const useAppState = () => useContext(AppStateContext);