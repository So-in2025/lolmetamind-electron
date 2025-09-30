// src/context/ScaleContext.jsx - Contexto de Escala y Posición Persistente (Hextech Modular)
"use client"

import React, { createContext, useContext, useState, useCallback } from 'react';
// IMPORTANTE: Asumo que existe un hook usePersistentIpc o lo quito si no es necesario
// Ya que la lógica de IPC está en el hook, no necesitamos importarlo aquí.

const ScaleContext = createContext();

export const useWidgetScale = () => useContext(ScaleContext);

export const ScaleProvider = ({ children }) => {
    // CRÍTICO: Se utiliza window.electronAPI.ipcRenderer directamente
    const { ipcRenderer } = typeof window !== 'undefined' && window.electronAPI ? window.electronAPI : {};
    const [widgetStates, setWidgetStates] = useState({});

    // Carga el estado inicial del widget y lo guarda en el estado local
    const loadWidgetState = useCallback(async (widgetId, defaultScale, defaultPosition) => {
        if (!ipcRenderer || !widgetId) return;
        
        try {
            const savedState = await ipcRenderer.invoke('get-widget-scale-state', widgetId);
            
            const initialState = {
                scale: savedState?.scale || defaultScale || 100,
                position: savedState?.position || defaultPosition || { x: 0, y: 0 },
                isLocked: savedState?.isLocked ?? false, // Usar valor guardado, o false por defecto
            };

            setWidgetStates(prev => ({
                ...prev,
                [widgetId]: initialState,
            }));

            return initialState;
        } catch (error) {
            // FIX CRÍTICO: Eliminados los backslashes innecesarios
            console.error(`[ScaleContext] Error al cargar el estado de ${widgetId}:`, error);
            return { scale: defaultScale, position: defaultPosition, isLocked: false };
        }
    }, [ipcRenderer]);

    // Guarda el estado del widget a través de IPC (persistente en electron-store)
    const saveWidgetState = useCallback((widgetId, newState) => {
        if (!ipcRenderer || !widgetId) return;

        setWidgetStates(prev => {
            const finalState = { ...prev[widgetId], ...newState };
            
            // Envío asíncrono a Electron
            ipcRenderer.send('set-widget-scale-state', {
                widgetId,
                scale: finalState.scale,
                position: finalState.position,
                isLocked: finalState.isLocked,
            });

            return {
                ...prev,
                [widgetId]: finalState,
            };
        });
    }, [ipcRenderer]);

    const value = {
        widgetStates,
        loadWidgetState,
        saveWidgetState,
    };

    return (
        <ScaleContext.Provider value={value}>
            {children}
        </ScaleContext.Provider>
    );
};
