// src/hooks/useLcuData.js
// Hook central para recibir datos de LCU/Electron
'use client';

import { useState, useEffect, useRef } from 'react';

// -----------------------------------------------
// ESTADO INICIAL: Define todos los datos necesarios
// -----------------------------------------------
const initialState = {
  LCU_STATUS: 'OFFLINE', // Estado de conexión del cliente LoL
  gamePhase: 'None',     // Fase actual de la partida
  draftData: null,       // Datos de champ select
  userData: null,        // Datos del jugador
  liveData: null,        // Datos de partida en vivo
};

/**
 * useLcuData
 * Hook central que se suscribe a los eventos de LCU/Electron.
 * Expone el estado completo y se asegura de actualizarlo de manera reactiva.
 */
export const useLcuData = () => {
  const [lcuState, setLcuState] = useState(initialState);

  // Ref para asegurar que solo se adjunta un listener
  const isListenerAttached = useRef(false);

  useEffect(() => {
    // ------------------------------------------------------
    // CHEQUEO: Electron API disponible
    // ------------------------------------------------------
    if (!window.electronAPI) {
      console.warn('[useLcuData] ⚠️ Electron API no disponible.');
      return;
    }

    // ------------------------------------------------------
    // SUSCRIPCIÓN: Solo una vez
    // ------------------------------------------------------
    if (!isListenerAttached.current) {
      console.log('[useLcuData] Hook montado. Adjuntando listener IPC para "lcu-state-update"...');

      // ------------------------------------------------------
      // HANDLER: Cada vez que Electron envía un paquete de datos
      // ------------------------------------------------------
      const handleLcuUpdate = (payload) => {
        console.log('[useLcuData] Payload recibido desde Electron:', payload);

        if (payload && typeof payload === 'object') {
          // ------------------------------------------------------
          // ACTUALIZACIÓN DE ESTADO: Reemplazamos todo, manteniendo userData si no viene
          // ------------------------------------------------------
          setLcuState(prevState => {
            const newState = {
              LCU_STATUS: payload.LCU_STATUS || prevState.LCU_STATUS,
              gamePhase: payload.gamePhase || prevState.gamePhase,
              draftData: payload.draftData ?? prevState.draftData,
              userData: payload.userData ?? prevState.userData,
              liveData: payload.liveData ?? prevState.liveData,
            };

            // Evitamos re-render si no hay cambios
            if (JSON.stringify(prevState) === JSON.stringify(newState)) {
              console.log('[useLcuData] No hay cambios en el estado. Skip re-render.');
              return prevState;
            }

            console.log('[useLcuData] Estado actualizado:', newState);
            return newState;
          });
        } else {
          console.warn('[useLcuData] ⚠️ Payload inválido recibido:', payload);
        }
      };

      // Suscribirse y guardar función de desuscripción
      const unsubscribe = window.electronAPI.onLcuStateUpdate(handleLcuUpdate);
      isListenerAttached.current = true;

      // ------------------------------------------------------
      // LIMPIEZA: Al desmontar, eliminamos listener
      // ------------------------------------------------------
      return () => {
        console.log('[useLcuData] Hook desmontado. Limpiando listener de IPC.');
        if (typeof unsubscribe === 'function') unsubscribe();
      };
    }
  }, [lcuState.userData]); // Reactividad si userData cambia

  // ------------------------------------------------------
  // RETORNO: Todo el estado central, listo para widgets
  // ------------------------------------------------------
  return lcuState;
};
