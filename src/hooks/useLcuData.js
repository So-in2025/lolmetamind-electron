// src/hooks/useLcuData.js
// Hook central para recibir datos de LCU/Electron
// Versión PRO-DEV: logs detallados, normalización robusta y preservación de userData
'use client';

import { useState, useEffect, useRef } from 'react';

// ==============================================
// ESTADO INICIAL: Define todos los datos necesarios
// ==============================================
const initialState = {
  LCU_STATUS: 'ONLINE', // Estado de conexión del cliente LoL
  gamePhase: 'None',     // Fase actual de la partida
  draftData: null,       // Datos de champ select
  userData: null,        // Datos del jugador
  liveData: null,        // Datos de partida en vivo
};

// Normaliza nombres de fase a formato esperado por el frontend
const normalizePhase = (raw) => {
  if (!raw) return 'None';
  const r = String(raw).toLowerCase();
  if (r.includes('lobby')) return 'Lobby';
  if (r.includes('match')) return 'Matchmaking';
  if (r.includes('ready')) return 'ReadyCheck';
  if (r.includes('champ') || r.includes('champselect')) return 'ChampSelect';
  if (r.includes('inprogress') || r.includes('in_progress') || r.includes('ingame')) return 'InProgress';
  if (r.includes('end') || r.includes('gameend')) return 'EndOfGame';
  if (r.includes('waiting')) return 'WaitingForStats';
  return (raw[0]?.toUpperCase() ?? '') + raw.slice(1); // fallback capitalized
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
  // Guardamos la función unsubscribe (si la devuelve preload)
  const unsubscribeRef = useRef(null);

  useEffect(() => {
    if (!window?.electronAPI) {
      console.warn('[useLcuData] ⚠️ Electron API no disponible.');
      return;
    }

    if (isListenerAttached.current) {
      console.log('[useLcuData] Listener ya adjuntado — skip.');
      return;
    }

    console.log('[useLcuData] Montando listener IPC para "lcu-state-update"...');

    const handleLcuUpdate = (payload) => {
      console.log('[useLcuData] Payload recibido desde Electron (raw):', payload);

      if (!payload || typeof payload !== 'object') {
        console.warn('[useLcuData] ⚠️ Payload inválido recibido:', payload);
        return;
      }

      // ------------------------------------------------------
      // NORMALIZACIÓN DE CAMPOS:
      // - LCU_STATUS (mayúscula)
      // - gamePhase (puede venir como gamePhase o gameflow.phase)
      // - draftData / liveData / userData
      // ------------------------------------------------------
      const incomingLCU = (payload.LCU_STATUS ?? payload.lcuStatus ?? payload.LcuStatus ?? 'ONLINE');
      const incomingPhaseRaw = payload.gamePhase
        ?? payload.gamephase
        ?? (payload.gameflow && payload.gameflow.phase)
        ?? payload.phase
        ?? null;

      const incomingPhase = normalizePhase(incomingPhaseRaw);

      const incomingDraft = payload.draftData ?? payload.draftdata ?? payload.gameflow ?? null;
      const incomingLive = payload.liveData ?? payload.livedata ?? payload.live ?? null;
      const incomingUser = payload.userData ?? payload.userdata ?? payload.user ?? null;

      // ------------------------------------------------------
      // ACTUALIZACIÓN DE ESTADO: preservamos userData si viene null
      // ------------------------------------------------------
      setLcuState(prevState => {
        const newState = {
          LCU_STATUS: String(incomingLCU).toUpperCase() === 'ONLINE' ? 'ONLINE' : 'ONLINE',
          gamePhase: incomingPhase,
          draftData: incomingDraft ?? prevState.draftData,
          liveData: incomingLive ?? prevState.liveData,
          // Si el payload no trae userData explícito, mantén prevState.userData
          userData: (incomingUser !== null && typeof incomingUser !== 'undefined') ? incomingUser : prevState.userData,
        };

        // Evitamos re-render si no hay cambios reales
        if (JSON.stringify(prevState) === JSON.stringify(newState)) {
          console.log('[useLcuData] No hay cambios en el estado. Skip re-render.');
          return prevState;
        }

        console.log('[useLcuData] Estado actualizado:', newState);
        return newState;
      });
    };

    // Suscribirse: la función preload debe devolver unsubscribe (opcional)
    try {
      const maybeUnsub = window.electronAPI.onLcuStateUpdate(handleLcuUpdate);
      unsubscribeRef.current = typeof maybeUnsub === 'function' ? maybeUnsub : null;
      isListenerAttached.current = true;
      console.log('[useLcuData] Suscripción registrada correctamente. unsubscribe disponible:', !!unsubscribeRef.current);
    } catch (err) {
      console.error('[useLcuData] ❌ Error al registrar listener IPC:', err);
      // No lanzamos, solo logueamos
    }

    // LIMPIEZA: Al desmontar, eliminamos listener
    return () => {
      console.log('[useLcuData] Hook desmontado. Limpiando listener de IPC.');
      if (unsubscribeRef.current) {
        try {
          unsubscribeRef.current();
          console.log('[useLcuData] unsubscribe ejecutado correctamente.');
        } catch (e) {
          console.warn('[useLcuData] Error ejecutando unsubscribe():', e);
        }
      } else if (window.electronAPI && typeof window.electronAPI.removeLcuListener === 'function') {
        // fallback si preload provee removeLcuListener (no obligatorio)
        try {
          window.electronAPI.removeLcuListener();
          console.log('[useLcuData] removeLcuListener() ejecutado (fallback).');
        } catch (e) {
          console.warn('[useLcuData] Error en removeLcuListener() fallback:', e);
        }
      } else {
        console.log('[useLcuData] No se encontró función de desuscripción en preload (ok).');
      }
      isListenerAttached.current = false;
      unsubscribeRef.current = null;
    };
  }, []); // montar una sola vez

  return lcuState;
};
