// src/hooks/useWebSocketCoach.js
import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * useWebSocketCoach
 * Hook para manejar comunicación WS con el backend de consejos IA
 * - Soporta fallback automático entre múltiples endpoints
 * - Maneja reconexión y reintentos
 * - Expone función sendInGameUpdate para enviar liveData
 */
export function useWebSocketCoach({ userData, targetEvent }) {
  const [wsStatus, setWsStatus] = useState('DISCONNECTED'); // CONNECTED, CONNECTING, DISCONNECTED
  const wsRef = useRef(null);
  const retryCountRef = useRef(0);
  const MAX_RETRIES = 3;

  // Lista de endpoints de fallback (orden de prioridad)
  const endpoints = [
    'wss://ai-coach-primary.example.com',
    'wss://ai-coach-secondary.example.com',
    'wss://ai-coach-backup.example.com'
  ];

  const connectWebSocket = useCallback((index = 0) => {
    if (index >= endpoints.length) {
      console.error('[useWebSocketCoach] ⚠️ Todos los WS fallaron.');
      setWsStatus('DISCONNECTED');
      return;
    }

    const url = endpoints[index];
    console.log(`[useWebSocketCoach] Conectando a WS: ${url}`);
    setWsStatus('CONNECTING');

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log(`[useWebSocketCoach] WS conectado a: ${url}`);
      setWsStatus('CONNECTED');
      retryCountRef.current = 0;
    };

    ws.onmessage = (msg) => {
      console.log('[useWebSocketCoach] Mensaje recibido:', msg.data);
    };

    ws.onerror = (err) => {
      console.error('[useWebSocketCoach] Error WS:', err);
    };

    ws.onclose = () => {
      console.warn('[useWebSocketCoach] WS cerrado. Intentando fallback...');
      setWsStatus('DISCONNECTED');
      retryCountRef.current += 1;
      if (retryCountRef.current <= MAX_RETRIES) {
        console.log(`[useWebSocketCoach] Reintentando endpoint alternativo (${retryCountRef.current}/${MAX_RETRIES})`);
        connectWebSocket(index + 1);
      } else {
        console.error('[useWebSocketCoach] Máximo reintentos alcanzado. No hay WS disponible.');
      }
    };
  }, []);

  // Conexión inicial
  useEffect(() => {
    connectWebSocket(0);

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connectWebSocket]);

  // Función para enviar liveData y recibir consejos IA
  const sendInGameUpdate = useCallback((liveData) => {
    return new Promise((resolve, reject) => {
      if (!wsRef.current || wsStatus !== 'CONNECTED') {
        reject(new Error('WS no conectado'));
        return;
      }

      const requestPayload = {
        event: targetEvent,
        user: {
          id: userData.id,
          summonerName: userData.summonerName,
          region: userData.region
        },
        live: liveData
      };

      console.log('[useWebSocketCoach] Enviando liveData al WS:', requestPayload);

      // Listener temporal para la respuesta
      const handleMessage = (msg) => {
        try {
          const data = JSON.parse(msg.data);
          if (data.event === `${targetEvent}_RESPONSE`) {
            console.log('[useWebSocketCoach] Respuesta IA recibida:', data);
            wsRef.current.removeEventListener('message', handleMessage);
            resolve(data.payload);
          }
        } catch (e) {
          console.error('[useWebSocketCoach] Error parseando respuesta WS:', e);
          wsRef.current.removeEventListener('message', handleMessage);
          reject(e);
        }
      };

      wsRef.current.addEventListener('message', handleMessage);

      try {
        wsRef.current.send(JSON.stringify(requestPayload));
      } catch (err) {
        wsRef.current.removeEventListener('message', handleMessage);
        console.error('[useWebSocketCoach] Error enviando mensaje WS:', err);
        reject(err);
      }

      // Timeout de 12s
      setTimeout(() => {
        wsRef.current.removeEventListener('message', handleMessage);
        reject(new Error('Timeout: No se recibió respuesta de IA'));
      }, 12000);
    });
  }, [userData, targetEvent, wsStatus]);

  return { wsStatus, sendInGameUpdate };
}
