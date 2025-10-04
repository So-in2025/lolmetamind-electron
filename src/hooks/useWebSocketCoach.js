// src/hooks/useWebSocketCoach.js
// Hook definitivo para comunicación WS (Soporte Local y Render)
// Autor: Jonathan
// Objetivo: Conexión WebSocket con el servidor de IA para recibir consejos
// y enviar actualizaciones de estado del juego en tiempo real.

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTTS } from './useTTS';

/**
 * getWsUrl
 * Devuelve la URL correcta del WebSocket según entorno:
 * - Render (producción): variable de entorno NEXT_PUBLIC_WS_URL
 * - Desarrollo local: ws://localhost:8080
 */
const getWsUrl = () => {
    if (process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_WS_URL) {
        console.log('[useWebSocketCoach] Usando URL de Render:', process.env.NEXT_PUBLIC_WS_URL);
        return process.env.NEXT_PUBLIC_WS_URL; 
    }
    console.log('[useWebSocketCoach] Usando URL local de desarrollo: ws://localhost:8080');
    return 'ws://localhost:8080';
};

const WS_URL = getWsUrl();

/**
 * useWebSocketCoach
 * Hook que centraliza la lógica de conexión, envío y recepción de consejos de IA.
 * 
 * Props:
 * - userData: objeto con info del usuario (summonerName, region, token, etc)
 * - targetEvent: evento esperado desde el WS (ej. "PRE_GAME_ANALYSIS")
 * - fallbackTTS: booleano para reproducir audio si hay consejos importantes
 */
export function useWebSocketCoach({ userData, targetEvent, fallbackTTS = true }) {
  const [aiAdvice, setAiAdvice] = useState(null);      // Consejo IA actual
  const [wsStatus, setWsStatus] = useState('WAITING_FOR_USER'); // Estado del WS
  const wsRef = useRef(null);                          // Referencia a la conexión WS
  const { speak } = useTTS();                          // Función TTS del hook
  const timeoutRef = useRef(null);                     // Timeout para respuesta WS

  // -----------------------------
  // Conexión WebSocket
  // -----------------------------
  useEffect(() => {
    // Sin datos de usuario, no conectamos
    if (!userData) {
      console.log('[useWebSocketCoach] Esperando datos de usuario...');
      setWsStatus('WAITING_FOR_USER');
      return;
    }

    console.log(`[useWebSocketCoach] 🔑 Iniciando conexión WS. userData presente:`, userData);

    // Cerrar WS previo si existía
    if (wsRef.current) {
      console.log('[useWebSocketCoach] Cerrando conexión WS previa.');
      wsRef.current.close();
    }

    console.log(`[useWebSocketCoach] 🔌 Conectando a WS: ${WS_URL} para evento ${targetEvent}...`);
    setWsStatus('CONNECTING');

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    // -----------------------------------------
    // Manejo de eventos WS
    // -----------------------------------------
    ws.onopen = () => {
      console.log('[useWebSocketCoach] ✅ WebSocket conectado con éxito.');
      setWsStatus('CONNECTED');
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);

        // Solo procesamos mensajes del evento esperado
        if (message.eventType === targetEvent) {
          console.log('[useWebSocketCoach] ✅ Mensaje recibido del evento esperado:', message.data);
          setAiAdvice(message.data);

          // TTS automático si hay análisis pre-game
          if (fallbackTTS && message.data?.preGameAnalysis) {
            const { title, astralMantra, technicalFocus } = message.data.preGameAnalysis;
            const ttsText = `${title}. ${astralMantra}. Foco técnico: ${technicalFocus}.`;
            console.log('[useWebSocketCoach] 🔊 Reproduciendo TTS para consejo pre-game:', ttsText);
            speak(ttsText);
          }
        } else {
          console.log('[useWebSocketCoach] ⚠️ Evento WS recibido ignorado:', message.eventType);
        }
      } catch (err) {
        console.error('[useWebSocketCoach] ❌ Error parseando mensaje WS:', err, event.data);
      }
    };

    ws.onclose = () => {
      console.warn('[useWebSocketCoach] ⚠️ WebSocket cerrado por el servidor o desconexión.');
      setWsStatus('DISCONNECTED');
    };

    ws.onerror = (err) => {
      console.error('[useWebSocketCoach] ❌ Error crítico en WebSocket:', err);
      setWsStatus('ERROR');
    };

    // Limpieza de efectos: cerrar WS y limpiar timeout
    return () => {
      console.log('[useWebSocketCoach] ⚡ Limpiando efecto WS...');
      if (wsRef.current) wsRef.current.close();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [targetEvent, userData, speak, fallbackTTS]);

  // -----------------------------
  // Función para enviar mensajes al WS
  // -----------------------------
  const sendMessage = useCallback((eventType, data = {}) => {
    if (wsStatus === 'CONNECTED' && userData) {
      const message = { eventType, data, userData };
      console.log(`[useWebSocketCoach] 📤 Enviando mensaje WS: ${eventType}`, message);
      wsRef.current.send(JSON.stringify(message));
      setAiAdvice(null); // Limpiar consejo previo
      return true;
    }
    console.warn(`[useWebSocketCoach] ⚠️ No se pudo enviar mensaje WS. Estado actual: ${wsStatus}`);
    return false;
  }, [wsStatus, userData]);

  // Funciones específicas de cada widget / evento
  const sendQueueUpdate = useCallback(() => sendMessage('QUEUE_UPDATE'), [sendMessage]);
  const sendChampSelectUpdate = useCallback(
    (draftData) => sendMessage('CHAMP_SELECT_UPDATE', draftData),
    [sendMessage]
  );
  const sendInGameUpdate = useCallback(
    (liveGameData) => sendMessage('LIVE_COACHING_UPDATE', { liveGameData }),
    [sendMessage]
  );

  // -----------------------------
  // Timeout: si no llega respuesta del WS
  // -----------------------------
  useEffect(() => {
    if (aiAdvice !== null || wsStatus !== 'CONNECTED') return;

    timeoutRef.current = setTimeout(() => {
      console.warn('[useWebSocketCoach] ⏱ Timeout: No se recibió respuesta WS en 15s.');
      // El widget padre debe manejar la UI de timeout
    }, 15000);

    return () => clearTimeout(timeoutRef.current);
  }, [wsStatus, aiAdvice]);

  // -----------------------------
  // Retorno del hook
  // -----------------------------
  return {
    aiAdvice,
    wsStatus,
    sendQueueUpdate,
    sendChampSelectUpdate,
    sendInGameUpdate
  };
}
