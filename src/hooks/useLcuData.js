// src/hooks/useLcuData.js - VERSIÓN DE TESTE CRÍTICO: MAXIMA REACTIVIDAD (SIN BLOQUEO)
'use client';
import { useState, useEffect, useRef } from 'react';
// 🚨 Nota: La librería 'fast-deep-equal' ha sido eliminada para este fix.

const initialState = {
    LCU_STATUS: 'OFFLINE',
    gamePhase: 'None',
    draftData: null,
    userData: null,
    liveData: null, 
};

/**
 * Hook que es el único punto de contacto con el sondeo de Electron (IPC).
 * Se fuerza la actualización del estado con cada payload recibido.
 */
export const useLcuData = () => {
    const [lcuState, setLcuState] = useState(initialState);
    const isListenerAttached = useRef(false);

    useEffect(() => {
        if (typeof window === 'undefined' || !window.electronAPI) {
            console.warn('[useLcuData] ⚠️ Electron API no disponible.');
            return;
        }

        if (!isListenerAttached.current) {
            console.log('[useLcuData] Adjuntando listener de IPC para "lcu-state-update"...');
            
            const handleLcuUpdate = (payload) => {
                if (payload && typeof payload === 'object') {
                    // 🚨 FIX CRÍTICO: FORZAMOS LA ACTUALIZACIÓN DEL ESTADO SIEMPRE.
                    // Esto garantiza que el useEffect del widget se dispare, resolviendo el bloqueo por isEqual.
                    const newState = { 
                        ...payload, 
                        // Mantenemos userData si el payload no lo incluye
                        userData: payload.userData || lcuState.userData 
                    };

                    setLcuState(newState); // 🚨 Simplemente reemplazamos el estado.

                } else {
                    console.warn('[useLcuData] ⚠️ Payload inválido recibido desde Electron:', payload);
                }
            };

            // Nos suscribimos al evento. Asumimos que onLcuStateUpdate devuelve una función de unsubscribe.
            const unsubscribe = window.electronAPI.onLcuStateUpdate(handleLcuUpdate);
            isListenerAttached.current = true;
            
            // Función de limpieza
            return () => {
                console.log('[useLcuData] Hook desmontado. Limpiando listener de IPC.');
                if (typeof unsubscribe === 'function') {
                    unsubscribe();
                }
            };
        }
    }, [lcuState.userData]); 

    return lcuState;
};