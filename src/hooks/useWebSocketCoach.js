// src/hooks/useWebSocketCoach.js
// ============================================================
// 🔥 Versión definitiva del hook WebSocket Coach
// Mantiene conexión estable con ping/pong, reconexión inteligente,
// logs pro-dev y envío de actualizaciones de juego a la IA.
//
// Autor: Jonathan + revisión ingeniería avanzada (GPT-5)
// ============================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTTS } from './useTTS';

// ============================================================
// Determinar URL WS según entorno
// ============================================================
const getWsUrl = () => {
  if (process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_WS_URL) {
    console.log('[WS:CLIENT] 🌐 Usando WS de producción:', process.env.NEXT_PUBLIC_WS_URL);
    return process.env.NEXT_PUBLIC_WS_URL;
  }
  console.log('[WS:CLIENT] 💻 Usando WS local: ws://localhost:8080');
  return 'ws://localhost:8080';
};

const WS_URL = getWsUrl();
const HEARTBEAT_INTERVAL = 25000; // 25s cliente → servidor

// ============================================================
// Hook principal
// ============================================================
export function useWebSocketCoach({ userData, targetEvent, fallbackTTS = true }) {
  const [aiAdvice, setAiAdvice] = useState(null);
  const [wsStatus, setWsStatus] = useState('WAITING_FOR_USER');

  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const heartbeatRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);

  const { speak } = useTTS();

  // ============================================================
  // Conectar al servidor WebSocket
  // ============================================================
  const connectWebSocket = useCallback(() => {
    if (!userData) {
      console.warn('[WS:CLIENT] ⚠️ userData ausente, no se conecta WS.');
      return;
    }

    // Cerrar WS previo si existía
    if (wsRef.current) {
      console.log('[WS:CLIENT] 🔄 Cerrando WS previo antes de reconectar.');
      wsRef.current.close(1000, 'Reconnection');
    }

    console.log(`[WS:CLIENT] 🔌 Conectando a ${WS_URL}...`);
    setWsStatus('CONNECTING');

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    // ------------------------------
    // Eventos WS
    // ------------------------------
    ws.onopen = () => {
      console.log('[WS:CLIENT] ✅ Conectado al servidor.');
      setWsStatus('CONNECTED');
      reconnectAttemptsRef.current = 0;

      // Iniciar heartbeat
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      heartbeatRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ eventType: 'PING' }));
          //console.log('[WS:CLIENT] 💓 PING enviado');
        }
      }, HEARTBEAT_INTERVAL);
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        const { eventType, data } = message;

        if (eventType === 'PONG') {
          //console.log('[WS:CLIENT] 💓 PONG recibido');
          return;
        }

        if (eventType === targetEvent) {
          console.log('[WS:CLIENT] 🎯 Evento esperado recibido:', eventType);
          setAiAdvice(data);

          // Reproducir TTS si se desea
          if (fallbackTTS && data?.fullText) {
            speak(data.fullText);
          }
        } else if (eventType === 'ERROR') {
          console.error('[WS:CLIENT] 🚨 Error desde servidor:', data?.message);
        } else {
          console.log('[WS:CLIENT] ⚙️ Evento ignorado:', eventType);
        }
      } catch (err) {
        console.error('[WS:CLIENT] ❌ Error parseando mensaje WS:', err, event.data);
      }
    };

    ws.onclose = (ev) => {
      console.warn(`[WS:CLIENT] ⚠️ WS cerrado. Code=${ev.code}, Reason=${ev.reason}`);
      setWsStatus('DISCONNECTED');

      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }

      // Intentar reconexión si no fue cierre voluntario
      if (ev.code !== 1000) {
        reconnectAttemptsRef.current += 1;
        const delay = Math.min(30000, 1000 * 2 ** reconnectAttemptsRef.current);
        console.log(`[WS:CLIENT] ⏱ Intentando reconexión en ${delay}ms (intento ${reconnectAttemptsRef.current})`);
        reconnectTimeoutRef.current = setTimeout(connectWebSocket, delay);
      }
    };

    ws.onerror = (err) => {
      console.error('[WS:CLIENT] ❌ Error crítico WS:', err);
      setWsStatus('ERROR');
    };
  }, [userData, targetEvent, fallbackTTS, speak]);

  // ============================================================
  // Montaje y limpieza
  // ============================================================
  useEffect(() => {
    if (userData) connectWebSocket();

    return () => {
      console.log('[WS:CLIENT] 🧹 Limpiando WS y timers...');
      if (wsRef.current) wsRef.current.close(1000, 'Unmount');
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    };
  }, [userData, targetEvent, connectWebSocket]);

  // ============================================================
  // Función de envío genérica
  // ============================================================
  const sendMessage = useCallback(
    (eventType, data = {}) => {
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        const message = { eventType, data, userData };
        ws.send(JSON.stringify(message));
        console.log(`[WS:CLIENT] 📤 Enviado evento: ${eventType}`, message);
        return true;
      }
      console.warn('[WS:CLIENT] ⚠️ No se pudo enviar mensaje, WS no conectado.');
      return false;
    },
    [userData]
  );

  // ============================================================
  // Wrappers específicos para eventos del juego
  // ============================================================
  const sendQueueUpdate = useCallback(() => sendMessage('QUEUE_UPDATE'), [sendMessage]);
  const sendChampSelectUpdate = useCallback(
    (draftData) => sendMessage('CHAMP_SELECT_UPDATE', draftData),
    [sendMessage]
  );
  const sendInGameUpdate = useCallback(
    (liveGameData) => sendMessage('LIVE_COACHING_UPDATE', { liveGameData }),
    [sendMessage]
  );

  return {
    aiAdvice,
    wsStatus,
    sendQueueUpdate,
    sendChampSelectUpdate,
    sendInGameUpdate
  };
}
