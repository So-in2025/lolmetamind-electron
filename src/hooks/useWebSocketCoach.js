// src/hooks/useWebSocketCoach.js
// =================================================================================================
// 🔥 HOOK WEBSOCKET COACH [VERSIÓN DEFINITIVA] by Asistente de Programación
// =================================================================================================
//
// CARACTERÍSTICAS CLAVE:
// ----------------------
// 1.  **Auto-reconexión con Backoff Exponencial**: Si la conexión se pierde, intenta reconectar
//     automáticamente con un tiempo de espera creciente para no sobrecargar el servidor.
// 2.  **Heartbeat (Latido)**: Envía un 'ping' periódico al servidor para mantener viva la conexión,
//     esencial para los servicios de hosting gratuitos como Render que "duermen" los servicios inactivos.
// 3.  **Autenticación Basada en Token**: Envía un token de usuario al conectarse para que el servidor
//     sepa quién es y pueda asociar la sesión.
// 4.  **Manejo de Estado Robusto**: Utiliza `useRef` para la instancia del WebSocket y los temporizadores,
//     evitando re-renders innecesarios y bucles de efectos.
// 5.  **Logging Detallado**: Registros de consola claros y con emojis para cada evento importante,
//     facilitando enormemente la depuración.
// 6.  **Limpieza de Efectos (Cleanup)**: Lógica de limpieza a prueba de fallos en `useEffect` para
//     prevenir fugas de memoria y conexiones "zombis" cuando el componente se desmonta.
// 7.  **Flexibilidad**: Diseñado para escuchar un `targetEvent` específico, haciéndolo reutilizable
//     para diferentes tipos de coaching (pre-partida, en-juego, etc.).
//
// USO BÁSICO EN UN COMPONENTE:
// -----------------------------
// const { aiAdvice, wsStatus } = useWebSocketCoach({
//   userData: TU_OBJETO_DE_USUARIO_CON_TOKEN,
//   targetEvent: 'PRE_GAME_ADVICE', // El tipo de evento que esperas del backend
//   fallbackTTS: true // Opcional: si debe reproducir el texto recibido
// });
//
// =================================================================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTTS } from './useTTS';

// ============================================================
// CONFIGURACIÓN CENTRALIZADA
// ============================================================

/**
 * Determina la URL del WebSocket a utilizar.
 * Prioriza la URL de producción (Render) para asegurar que siempre apunte al lugar correcto,
 * pero permite override local a través de variables de entorno para desarrollo.
 * @returns {string} La URL del WebSocket.
 */
const getWsUrl = () => {
  const RENDER_WS_URL = 'wss://lolmetamind-ws.onrender.com'; // 🚨 Protocolo seguro 'wss' para producción.

  if (process.env.NODE_ENV === 'production' || !process.env.NEXT_PUBLIC_WS_URL) {
    console.log(`[WS:CLIENT] 🚀 Entorno de producción detectado. Usando WS de Render: ${RENDER_WS_URL}`);
    return RENDER_WS_URL;
  }
  
  console.log(`[WS:CLIENT] 💻 Entorno de desarrollo. Usando WS local (de .env.local): ${process.env.NEXT_PUBLIC_WS_URL}`);
  return process.env.NEXT_PUBLIC_WS_URL;
};

// --- Constantes del Hook ---
const WS_URL = getWsUrl();
const HEARTBEAT_INTERVAL = 25000; // 25 segundos. Render duerme los servicios a los 15 min, esto lo previene.

// ============================================================
// HOOK PRINCIPAL: useWebSocketCoach
// ============================================================
export function useWebSocketCoach({ userData, targetEvent, fallbackTTS = true }) {
  
  // --- ESTADO ---
  // El consejo de la IA que se mostrará en la UI.
  const [aiAdvice, setAiAdvice] = useState(null);
  // El estado actual de la conexión para mostrar feedback en la UI (ej. "Conectando...").
  const [wsStatus, setWsStatus] = useState('WAITING_FOR_USER');

  // --- REFS ---
  // Usamos `useRef` para todo lo que no debe causar un re-render al cambiar:
  // la instancia del WebSocket y los IDs de los temporizadores.
  const wsRef = useRef(null); // Almacena el objeto WebSocket.
  const reconnectTimeoutRef = useRef(null); // Almacena el ID del setTimeout para la reconexión.
  const heartbeatRef = useRef(null); // Almacena el ID del setInterval para el heartbeat.
  const reconnectAttemptsRef = useRef(0); // Contador de intentos de reconexión.

  // --- HOOKS ADICIONALES ---
  const { speak } = useTTS(); // Hook para la funcionalidad de Text-to-Speech.

  // ------------------------------------------------------------
  // FUNCIÓN DE CONEXIÓN (Centralizada y Resiliente)
  // Envuelto en `useCallback` para mantener una referencia estable y evitar
  // que el `useEffect` se ejecute innecesariamente.
  // ------------------------------------------------------------
  const connectWebSocket = useCallback(() => {
    // [GUARDIA 1] No intentar conectar si no tenemos los datos del usuario (con el token).
    if (!userData || !userData.token) {
      console.log('[WS:CLIENT] 🟡 Pausado. Esperando datos de usuario para conectar.');
      setWsStatus('WAITING_FOR_USER');
      return;
    }

    const ws = wsRef.current;
    
    // [GUARDIA 2] Evitar conexiones duplicadas. Si ya estamos conectados o conectando, no hacer nada.
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
      console.log(`[WS:CLIENT] ✅ Conexión ya está en estado '${ws.readyState === WebSocket.OPEN ? 'OPEN' : 'CONNECTING'}'. No se requiere acción.`);
      return;
    }

    // [LIMPIEZA PREVIA] Es CRÍTICO limpiar timers antiguos antes de crear una nueva conexión.
    // Esto previene bucles de reconexión fantasma si el estado cambia rápidamente.
    clearTimeout(reconnectTimeoutRef.current);
    if (heartbeatRef.current) clearInterval(heartbeatRef.current);

    console.log(`[WS:CLIENT] 🔌 Intentando conectar a ${WS_URL}... (Intento #${reconnectAttemptsRef.current + 1})`);
    setWsStatus('CONNECTING');

    const newWs = new WebSocket(WS_URL);
    wsRef.current = newWs;

    // ------------------ MANEJADORES DE EVENTOS DEL WEBSOCKET ------------------
    
    newWs.onopen = () => {
      console.log('[WS:CLIENT] ✅ ¡Conexión establecida con el servidor!');
      setWsStatus('CONNECTED');
      reconnectAttemptsRef.current = 0; // Resetear contador de intentos tras conexión exitosa.
      
      // 🚨 Autenticación: Inmediatamente después de conectar, enviar el token para que el servidor nos identifique.
      const authPayload = { eventType: 'USER_AUTH', token: userData.token, userId: userData.id };
      newWs.send(JSON.stringify(authPayload));
      console.log('[WS:CLIENT] 🔐 Token de autenticación enviado al servidor.');

      // Iniciar el Heartbeat para mantener la conexión viva.
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      heartbeatRef.current = setInterval(() => {
        if (newWs.readyState === WebSocket.OPEN) {
          console.log('[WS:CLIENT] ❤️ Enviando Heartbeat (ping)...');
          newWs.send(JSON.stringify({ eventType: 'PING' }));
        }
      }, HEARTBEAT_INTERVAL);
    };

    newWs.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        const { eventType, data } = message;

        // Ignorar respuestas del heartbeat.
        if (eventType === 'PONG') {
          console.log('[WS:CLIENT] ❤️ Pong recibido del servidor. La conexión está viva.');
          return;
        }

        console.log('[WS:CLIENT] 🧠 Mensaje recibido del servidor:', message);

        // Si el evento recibido es el que este hook está esperando...
        if (eventType === targetEvent) {
          console.log(`[WS:CLIENT] 🎯 ¡Evento esperado ('${targetEvent}') recibido! Actualizando estado.`);
          setAiAdvice(data);

          // Si está configurado, reproducir el audio del consejo.
          if (fallbackTTS && data?.fullText) {
            console.log('[WS:CLIENT] 🔊 Reproduciendo consejo con TTS...');
            speak(data.fullText);
          }
        } else if (eventType === 'ERROR') {
          console.error('[WS:CLIENT] 🚨 Error explícito desde el servidor:', data?.message);
        } else {
          console.log(`[WS:CLIENT] ⚙️ Evento ('${eventType}') recibido pero no es el esperado ('${targetEvent}'). Se ignora.`);
        }
      } catch (err) {
        console.error('[WS:CLIENT] ❌ Error fatal al parsear mensaje del servidor:', err, 'Data recibida:', event.data);
      }
    };

    newWs.onclose = (ev) => {
      console.warn(`[WS:CLIENT] ⚠️ Conexión cerrada. Código=${ev.code}, Razón=${ev.reason}`);
      
      // Limpiar el heartbeat de la conexión que acaba de cerrarse.
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      
      // Intentar reconexión solo si el cierre no fue voluntario (Código 1000 es 'Normal Closure').
      if (ev.code !== 1000) {
        setWsStatus('RECONNECTING');
        reconnectAttemptsRef.current += 1;
        // Estrategia de "Exponential Backoff": 2s, 4s, 8s, 16s, hasta un máximo de 30s.
        const delay = Math.min(30000, 1000 * 2 ** reconnectAttemptsRef.current);
        console.log(`[WS:CLIENT] ⏱️ Programando reconexión en ${delay / 1000} segundos...`);
        reconnectTimeoutRef.current = setTimeout(connectWebSocket, delay);
      } else {
        setWsStatus('DISCONNECTED');
      }
    };

    newWs.onerror = (err) => {
      console.error('[WS:CLIENT] ❌ Error crítico en la conexión WebSocket. El `onclose` se disparará a continuación.', err);
      setWsStatus('ERROR');
      // No es necesario llamar a reconexión aquí, el evento `onclose` se encarga de eso.
    };
  }, [userData, targetEvent, fallbackTTS, speak]); // Dependencias del `useCallback`.

  // ============================================================
  // EFECTO DE MONTAJE Y LIMPIEZA
  // ============================================================
  useEffect(() => {
    // Inicia la conexión cuando el componente se monta o cuando `userData` cambia (ej. después de un login).
    console.log('[WS:CLIENT] 훅 Montando hook. Iniciando conexión...');
    connectWebSocket();

    // --- FUNCIÓN DE LIMPIEZA ---
    // Esto es ESENCIAL. Se ejecuta cuando el componente se desmonta.
    return () => {
      console.log('[WS:CLIENT] 🧹 Desmontando hook. Realizando limpieza completa...');
      
      // [FIX CRÍTICO] Limpiar todos los temporizadores para evitar que `connectWebSocket`
      // se ejecute después de que el componente ya no exista.
      clearTimeout(reconnectTimeoutRef.current); 
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);

      // Cerrar la conexión WebSocket de forma voluntaria (código 1000).
      // Esto previene que el `onclose` intente una reconexión.
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.close(1000, 'Componente desmontado'); 
          console.log('[WS:CLIENT] 🔌 Conexión cerrada voluntariamente.');
      }
      wsRef.current = null; // Liberar la referencia.
    };
  }, [connectWebSocket]); // La única dependencia es la función `connectWebSocket` memoizada.


  // ============================================================
  // FUNCIONES DE ENVÍO DE DATOS AL SERVIDOR
  // ============================================================
  
  /**
   * Función genérica para enviar mensajes al WebSocket.
   * @param {string} eventType - El tipo de evento a enviar.
   * @param {object} data - El payload de datos a enviar.
   * @returns {boolean} - True si el mensaje se envió, false si no.
   */
  const sendMessage = useCallback((eventType, data = {}) => {
      const ws = wsRef.current;
      
      // [GUARDIA] Solo enviar si la conexión está completamente abierta.
      if (ws && ws.readyState === WebSocket.OPEN) {
        const message = { eventType, data, userData };
        ws.send(JSON.stringify(message));
        console.log(`[WS:CLIENT] 📤 Enviando evento '${eventType}' al servidor.`, message);
        return true;
      }
      
      console.warn(`[WS:CLIENT] ⚠️ No se pudo enviar mensaje. El WebSocket no está abierto (Estado actual: ${ws?.readyState}). Se intentará reconectar en segundo plano si es necesario.`);
      return false;
    }, [userData]
  );

  // --- Wrappers específicos para mayor claridad en los componentes ---
  const sendQueueUpdate = useCallback(() => sendMessage('QUEUE_UPDATE'), [sendMessage]);
  const sendChampSelectUpdate = useCallback((draftData) => sendMessage('CHAMP_SELECT_UPDATE', draftData), [sendMessage]);
  const sendInGameUpdate = useCallback((liveGameData) => sendMessage('LIVE_COACHING_UPDATE', { liveGameData }), [sendMessage]);

  // ============================================================
  // VALORES RETORNADOS POR EL HOOK
  // ============================================================
  return {
    aiAdvice, // El consejo de la IA para la UI.
    wsStatus, // El estado de la conexión para la UI.
    // Funciones para que los componentes interactúen con el servidor:
    sendQueueUpdate,
    sendChampSelectUpdate,
    sendInGameUpdate
  };
}