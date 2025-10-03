// src/hooks/useLcuData.js
'use client';
import { useState, useEffect, useRef } from 'react';
import isEqual from 'fast-deep-equal';

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
                    
                    // ▼▼▼ MODIFICAR ESTA SECCIÓN ▼▼▼
                    // En lugar de actualizar el estado ciegamente, ahora lo hacemos
                    // de forma condicional, usando una función de callback para acceder
                    // al estado anterior de forma segura.
                    setLcuState(prevState => {
                        // Creamos un nuevo objeto de estado a partir del payload
                        const newState = {
                            LCU_STATUS: payload.lcuStatus,
                            gamePhase: payload.gamePhase,
                            draftData: payload.draftData,
                            userData: payload.userData,
                        };

                        // Comparamos el nuevo estado con el anterior.
                        // Si son iguales, no hacemos nada y evitamos un re-render.
                        if (isEqual(prevState, newState)) {
                            return prevState; // Devolvemos el estado antiguo sin cambios.
                        }

                        // Si son diferentes, devolvemos el nuevo estado para provocar un re-render.
                        return newState;
                    });
                    // ▲▲▲ FIN DE LA MODIFICACIÓN ▲▲▲
                } else {
                    console.warn('[useLcuData] ⚠️ Payload inválido recibido desde Electron:', payload);
                }
            };

            // Nos suscribimos al evento.
            window.electronAPI.onLcuStateUpdate(handleLcuUpdate);
            
            // Marcamos que ya estamos escuchando.
            isListenerAttached.current = true;
            
            // ▼▼▼ AÑADIR FUNCIÓN DE LIMPIEZA ▼▼▼
            // Es una buena práctica desuscribirse del evento cuando el componente se desmonta
            // para evitar fugas de memoria.
            return () => {
                console.log('[useLcuData] Hook desmontado. Limpiando listener de IPC.');
                if (typeof unsubscribe === 'function') {
                    unsubscribe();
                }
            };
            // ▲▲▲ FIN DE LA MODIFICACIÓN ▲▲▲
        }
    }, []); // El array vacío asegura que solo se ejecute una vez.

    // 3. Devolvemos el estado más reciente, que ahora incluye 'userData'.
    return lcuState;
};