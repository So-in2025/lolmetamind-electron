// src/hooks/useWebSocketCoach.js
// Hook definitivo para comunicación WS (Soporte Local y Render)
import { useState, useEffect, useCallback, useRef } from 'react';
import { useTTS } from './useTTS';

/**
 * Función para obtener la URL correcta del WebSocket según el entorno.
 * Para Render, DEBES configurar la variable NEXT_PUBLIC_WS_URL en tu dashboard.
 */
const getWsUrl = () => {
    // 🚨 Lógica para Render: En producción, usa la variable de entorno para la URL WSS.
    // Usamos el puerto 8080 y protocolo WS no seguro para el desarrollo local.
    if (process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_WS_URL) {
         console.log('[useWebSocketCoach] Usando URL de Render:', process.env.NEXT_PUBLIC_WS_URL);
        return process.env.NEXT_PUBLIC_WS_URL; 
    }
    // Desarrollo local (lo que tu servidor WS espera)
    return 'ws://localhost:8080';
};

const WS_URL = getWsUrl();

/**
 * useWebSocketCoach
 * Hook que centraliza la lógica de conexión, envío y recepción de consejos de IA.
 */
export function useWebSocketCoach({ userData, targetEvent, fallbackTTS = true }) {
  const [aiAdvice, setAiAdvice] = useState(null);
  const [wsStatus, setWsStatus] = useState('WAITING_FOR_USER');
  const wsRef = useRef(null);
  const { speak } = useTTS();
  const timeoutRef = useRef(null);

  // -----------------------------
  // Conexión WebSocket
  // -----------------------------
  useEffect(() => {
    if (!userData) {
      setWsStatus('WAITING_FOR_USER');
      return;
    }


    // 🚨 NUEVO LOG CLAVE: Confirmar que esta línea se ejecuta
    console.log(`[useWebSocketCoach] 🔑 Disparando Conexión WS. UserData existe:`, userData);

    // Limpieza de conexión previa
    if (wsRef.current) wsRef.current.close();

    console.log(`[useWebSocketCoach] 🔌 Intentando conectar a WS: ${WS_URL} para evento ${targetEvent}...`);
    setWsStatus('CONNECTING');
    
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log(`[useWebSocketCoach] ✅ WebSocket conectado.`);
      setWsStatus('CONNECTED');
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.eventType === targetEvent) {
          console.log(`[useWebSocketCoach] ✅ Consejo recibido via WS:`, message.data);
          setAiAdvice(message.data);

          // TTS para consejos importantes (si está habilitado)
          if (fallbackTTS && message.data?.preGameAnalysis) {
            const { title, astralMantra, technicalFocus } = message.data.preGameAnalysis;
            const ttsText = `${title}. ${astralMantra}. Foco técnico: ${technicalFocus}.`;
            speak(ttsText);
          }
        }
      } catch (err) {
        console.error('[useWebSocketCoach] ❌ Error parseando mensaje WS:', err);
      }
    };

    ws.onclose = () => {
      console.warn('[useWebSocketCoach] ⚠️ WebSocket cerrado.');
      setWsStatus('DISCONNECTED');
    };
    
    ws.onerror = (err) => {
      console.error('[useWebSocketCoach] ❌ Error de WebSocket.', err);
      setWsStatus('ERROR');
    };
    
    // Limpieza de efectos
    return () => {
      if (wsRef.current) wsRef.current.close();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [targetEvent, userData, speak, fallbackTTS]);

  // -----------------------------
  // Envío de mensajes al servidor
  // -----------------------------
  const sendMessage = useCallback((eventType, data = {}) => {
    if (wsStatus === 'CONNECTED' && userData) {
      const message = { eventType, data, userData };
      console.log(`[useWebSocketCoach] 📤 Enviando mensaje WS: ${eventType}`, message);
      wsRef.current.send(JSON.stringify(message));
      setAiAdvice(null); // Limpiar consejo al enviar nueva solicitud
      return true;
    }
    console.warn(`[useWebSocketCoach] ⚠️ No se pudo enviar mensaje. Status: ${wsStatus}`);
    return false;
  }, [wsStatus, userData]);

  // Funciones específicas para widgets
  const sendQueueUpdate = useCallback(() => sendMessage('QUEUE_UPDATE'), [sendMessage]);
  const sendChampSelectUpdate = useCallback((draftData) => sendMessage('CHAMP_SELECT_UPDATE', draftData), [sendMessage]);
  const sendInGameUpdate = useCallback((liveGameData) => sendMessage('LIVE_COACHING_UPDATE', { liveGameData }), [sendMessage]);

  // -----------------------------
  // Timeout de actividad (si no llega respuesta)
  // -----------------------------
  useEffect(() => {
    if (aiAdvice !== null || wsStatus !== 'CONNECTED') return;

    timeoutRef.current = setTimeout(() => {
      console.warn('[useWebSocketCoach] ⏱ Timeout: No se recibió respuesta de consejo en 15s.');
      // El widget padre debe manejar el estado de timeout y la UI
    }, 15000);

    return () => clearTimeout(timeoutRef.current);
  }, [wsStatus, aiAdvice]);

  return { aiAdvice, wsStatus, sendQueueUpdate, sendChampSelectUpdate, sendInGameUpdate };
}