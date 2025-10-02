// src/hooks/useLcuData.js
'use client';
import { useState, useEffect, useRef } from 'react';

// 🚨 1. AÑADIMOS 'userData' AL ESTADO INICIAL 🚨
//    Ahora el hook también es responsable de gestionar los datos del usuario.
const initialState = {
    LCU_STATUS: 'OFFLINE',
    gamePhase: 'None',
    draftData: null,
    userData: null, // El estado inicial del usuario es null
};

/**
 * Hook dedicado a una cosa: ser el único punto de contacto con el sondeo
 * de Electron. Recibe el paquete de datos completo (juego + usuario) y lo
 * pone a disposición de la UI de React.
 */
export const useLcuData = () => {
    // El estado ahora incluye todos los datos que necesitamos.
    const [lcuState, setLcuState] = useState(initialState);
    
    const isListenerAttached = useRef(false);

    useEffect(() => {
        // Asegurarnos de que la API de Electron esté disponible.
        if (window.electronAPI && !isListenerAttached.current) {
            console.log('[useLcuData] Hook montado. Adjuntando listener de IPC para "lcu-state-update"...');
            
            // Esta función se ejecutará CADA VEZ que main.js envíe un paquete de datos.
            const handleLcuUpdate = (payload) => {
                // Comprobamos si el payload es válido.
                if (payload && typeof payload === 'object') {
                    console.log('[useLcuData] ✅ Paquete de datos completo recibido desde Electron:', payload);
                    
                    // 🚨 2. ACTUALIZAMOS EL ESTADO COMPLETO 🚨
                    //    Guardamos todos los datos que vienen en el paquete, incluyendo el 'userData'.
                    setLcuState({
                        LCU_STATUS: payload.lcuStatus,
                        gamePhase: payload.gamePhase,
                        draftData: payload.draftData,
                        userData: payload.userData, // ¡Aquí está la clave!
                    });
                } else {
                    console.warn('[useLcuData] ⚠️ Payload inválido recibido desde Electron:', payload);
                }
            };

            // Nos suscribimos al evento.
            window.electronAPI.onLcuStateUpdate(handleLcuUpdate);
            
            // Marcamos que ya estamos escuchando.
            isListenerAttached.current = true;
        }
    }, []); // El array vacío asegura que solo se ejecute una vez.

    // 3. Devolvemos el estado más reciente, que ahora incluye 'userData'.
    return lcuState;
};