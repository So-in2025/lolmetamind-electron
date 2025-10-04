// src/hooks/useWebSocketCoach.js - VERSIÓN CORREGIDA Y FINAL
import { useState, useEffect, useRef, useCallback } from 'react';

const WS_URL = 'ws://localhost:8080'; 

export const useWebSocketCoach = ({ userData, targetEvent }) => {
  const [aiAdvice, setAiAdvice] = useState(null);
  const [wsStatus, setWsStatus] = useState('WAITING_FOR_USER'); // Nuevo estado inicial
  const ws = useRef(null);

  // 🚨 1. EL useEffect AHORA DEPENDE DE 'userData' 🚨
  //    Esto asegura que solo intentará conectarse CUANDO tengamos los datos del usuario.
  useEffect(() => {
    // Si no tenemos datos de usuario, no hacemos nada y esperamos.
    if (!userData) {
      setWsStatus('WAITING_FOR_USER');
      return;
    }

    // Si ya tenemos una conexión, la cerramos para crear una nueva (si userData cambiara).
    if (ws.current) {
      ws.current.close();
    }
    
    console.log(`[useWebSocketCoach] 'userData' recibido. Conectando a ${WS_URL} para el evento ${targetEvent}...`);
    setWsStatus('CONNECTING');
    ws.current = new WebSocket(WS_URL);
    
    ws.current.onopen = () => {
      console.log(`[useWebSocketCoach] ✅ WebSocket conectado para ${targetEvent}.`);
      setWsStatus('CONNECTED');
    };
    ws.current.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.eventType === targetEvent) {
          console.log(`[useWebSocketCoach] ✅ Consejo recibido para ${targetEvent}:`, message.data);
          setAiAdvice(message.data);
        }
      } catch (e) {
        console.error('[WS Parse Error]', e);
      }
    };
    ws.current.onclose = () => setWsStatus('DISCONNECTED');
    ws.current.onerror = () => {
      console.error(`[useWebSocketCoach] ❌ Error de WebSocket para ${targetEvent}.`);
      setWsStatus('ERROR');
    };

    // Función de limpieza
    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, [targetEvent, userData]); // <-- La dependencia de 'userData' es la clave

 // 🚨 2. 'sendMessage' AHORA USA EL 'userData' DE LA CLAUSURA CORRECTA 🚨
  const sendMessage = useCallback((eventType, data = {}) => {
    if (wsStatus === 'CONNECTED' && userData) {
      // Tu formato original era correcto, lo restauramos.
      const message = { 
        eventType, 
        data, 
        userData // El servidor espera este objeto anidado
      };

      console.log(`[useWebSocketCoach] Enviando mensaje: ${eventType}`, message);
      ws.current.send(JSON.stringify(message));
      setAiAdvice(null); 
      return true;
    }
    console.warn(`[useWebSocketCoach] No se pudo enviar mensaje. Status: ${wsStatus}, UserData: ${!!userData}`);
    return false;
  }, [wsStatus, userData]); 
  
  const sendQueueUpdate = useCallback(() => sendMessage('QUEUE_UPDATE'), [sendMessage]);
  const sendChampSelectUpdate = useCallback((draftData) => sendMessage('CHAMP_SELECT_UPDATE', draftData), [sendMessage]);
  // 💎 CORRECCIÓN CLAVE: Nueva función para el coaching en partida usando el nombre limpio
  const sendInGameUpdate = useCallback((liveGameData) => sendMessage('LIVE_COACHING_UPDATE', { liveGameData }), [sendMessage]);

  // 🚨 3. EXPORTAR LAS FUNCIONES (SE AÑADE sendInGameUpdate) 🚨
  return { aiAdvice, wsStatus, sendQueueUpdate, sendChampSelectUpdate, sendInGameUpdate };
};