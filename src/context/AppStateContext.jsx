"use client"
import React, { createContext, useContext, useState, useEffect } from 'react';

// Estados posibles del flujo de la aplicación
const AppFlowState = {
    LOADING: 'LOADING',
    LOGIN: 'LOGIN',
    ONBOARDING: 'ONBOARDING',
    DASHBOARD: 'DASHBOARD',
};

const AppStateContext = createContext();

export const useAppState = () => useContext(AppStateContext);

export const AppStateProvider = ({ children }) => {
    const [flowState, setFlowState] = useState(AppFlowState.LOADING);
    const [profile, setProfile] = useState(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [overlayEnabled, setOverlayEnabled] = useState(false);

    // 1. Cargar estado de Electron Store al inicio
    useEffect(() => {
        if (typeof window !== 'undefined' && window.electronAPI) {
            window.electronAPI.getSessionState().then(state => {
                const { isAuthenticated, summonerProfile } = state;
                
                setIsAuthenticated(isAuthenticated);
                setProfile(summonerProfile);

                if (isAuthenticated && summonerProfile) {
                    setFlowState(AppFlowState.DASHBOARD);
                } else if (isAuthenticated) {
                    setFlowState(AppFlowState.ONBOARDING);
                } else {
                    setFlowState(AppFlowState.LOGIN);
                }
            });
        }
    }, []);

    // 2. Controlar la visibilidad del overlay
    const toggleOverlay = (visible) => {
        if (typeof window !== 'undefined' && window.electronAPI) {
            window.electronAPI.setOverlayVisibility(visible);
            setOverlayEnabled(visible);
        }
    };

    // 3. Funciones de flujo
    const goToDashboard = () => setFlowState(AppFlowState.DASHBOARD);
    const goToOnboarding = () => setFlowState(AppFlowState.ONBOARDING);
    const logout = () => {
        if (typeof window !== 'undefined' && window.electronAPI) {
            window.electronAPI.setSessionState({ isAuthenticated: false, summonerProfile: null });
        }
        setIsAuthenticated(false);
        setProfile(null);
        setFlowState(AppFlowState.LOGIN);
    };

    const value = {
        AppFlowState,
        flowState,
        setFlowState,
        profile,
        setProfile,
        isAuthenticated,
        setIsAuthenticated,
        logout,
        goToDashboard,
        goToOnboarding,
        overlayEnabled,
        toggleOverlay
    };

    return (
        <AppStateContext.Provider value={value}>
            {children}
        </AppStateContext.Provider>
    );
};
