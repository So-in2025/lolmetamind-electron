// src/hooks/useInteractiveWidget.js - VERSIÓN CON HOTKEY CTRL+F1/F2

"use client"
import { useState, useEffect } from 'react';

// Este hook se suscribe al estado de interacción global del Overlay 
// controlado por los hotkeys (CTRL+F1/F2) en el proceso principal de Electron.
export function useInteractiveWidget(widgetId) {
    const [isWidgetInteractive, setIsWidgetInteractive] = useState(false); // Por defecto: Pasivo (CTRL+F2)

    useEffect(() => {
        if (window.electronAPI && typeof window.electronAPI.on === 'function') {
            console.log("[useInteractiveWidget] Suscribiéndose al canal IPC 'overlay-interaction-toggle'.");
            
            // Recibe el booleano que indica si el Overlay debe ser interactivo (true: CTRL+F1, false: CTRL+F2)
            const handleInteractionToggle = (data) => {
                const newInteractiveState = !!data;
                // FIX CRÍTICO: Eliminados los backslashes innecesarios
                console.log(`[useInteractiveWidget] ✅ Estado de interacción global: ${newInteractiveState ? 'ACTIVO (CTRL+F1)' : 'PASIVO (CTRL+F2)'}.`);
                setIsWidgetInteractive(newInteractiveState);
            };
            
            const unsubscribe = window.electronAPI.on('overlay-interaction-toggle', handleInteractionToggle);
            
            // Limpieza
            return () => {
                console.log("[useInteractiveWidget] Desuscribiéndose de 'overlay-interaction-toggle'.");
                unsubscribe();
            };
        } else {
            console.warn("[useInteractiveWidget] La API de Electron no está disponible. Usando modo predeterminado.");
        }
    }, [widgetId]); 

    // Función que la página usará para indicar si el área debe capturar clics
    // El modo interactivo global anula cualquier intento de hacerlo no interactivo.
    return { 
        isWidgetInteractive, 
    };
}
