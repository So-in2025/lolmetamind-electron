'use client';

import React, { useEffect, useState, useRef } from 'react';
import { FaSync, FaBrain, FaMicrophoneAlt, FaExclamationTriangle, FaRedo, FaHandPaper } from 'react-icons/fa';
import { useWebSocketCoach } from '@/hooks/useWebSocketCoach';
import { useTTS } from '@/hooks/useTTS';
import { useInteractiveWidget } from '@/hooks/useInteractiveWidget';

/**
 * PreGameCoach
 * Widget que analiza la cola antes de la partida (Lobby/Matchmaking/ReadyCheck).
 * - Recibe LCU_STATUS, userData, y gamePhase (CRÍTICO) desde el hook central (useLcuData)
 * - Envía solicitudes a WebSocket para obtener consejos
 * - Maneja TTS para leer los consejos al jugador
 * - Controla timeout y reintentos
 */
// 🛑 CRÍTICO: El componente debe recibir la fase actual del juego como prop
export default function PreGameCoach({ LCU_STATUS, userData, gamePhase }) { 
 // 🚨 NUEVO LOG CLAVE
  console.log(`[PreGameCoach] --- RENDERIZANDO --- UserData: ${!!userData}, WS Status: ...`);
  const { aiAdvice, wsStatus, sendQueueUpdate } = useWebSocketCoach({
    userData,
    targetEvent: 'QUEUE_ADVICE', // Evento WS para consejos de cola
  });

  const { speak } = useTTS();
  const { isInteractive, setInteractive } = useInteractiveWidget(false);

  const [adviceSpoken, setAdviceSpoken] = useState(false);
  const [isLoadingAdvice, setIsLoadingAdvice] = useState(true);
  const [isTimedOut, setIsTimedOut] = useState(false);
  
  // 🛑 CORRECCIÓN CLAVE: Usamos useRef para la guardia de audio (evita doble reproducción).
  const lastSpokenIdentifierRef = useRef(null); 

  // ------------------------------
  // Enviar solicitud al WS una sola vez cuando conecta
  // ------------------------------
  useEffect(() => {
    const isQueuePhase = gamePhase === 'Lobby' || gamePhase === 'Matchmaking' || gamePhase === 'ReadyCheck';

    // 🔑 CORRECCIÓN REPETICIÓN: Solo solicitar si está CONECTADO Y en la fase correcta
    if (wsStatus === 'CONNECTED' && isQueuePhase && !adviceSpoken && userData) {
      console.log('[PreGameCoach] WS conectado y userData disponible. Enviando solicitud de consejo...');
      sendQueueUpdate();
      setIsLoadingAdvice(true);
      setAdviceSpoken(true);
    }
    // Añadida gamePhase a las dependencias para resetear si la fase cambia
  }, [wsStatus, adviceSpoken, sendQueueUpdate, userData, gamePhase]); 

  // ------------------------------
  // Manejo de timeout (15s) o caída de conexión
  // ------------------------------
  useEffect(() => {
    let timer;
    const requestSent = adviceSpoken;
    const isLoading = !aiAdvice && isLoadingAdvice;

    if (isLoading && wsStatus === 'CONNECTED' && requestSent) {
      setIsTimedOut(false);
      timer = setTimeout(() => {
        console.warn('[PreGameCoach] ⚠️ Timeout: IA no respondió en 15s.');
        setIsTimedOut(true);
        setIsLoadingAdvice(false);
      }, 15000);
    } else if (requestSent && !aiAdvice && wsStatus !== 'CONNECTED') {
      console.warn('[PreGameCoach] ⚠️ Conexión WS caída antes de recibir consejo.');
      setIsTimedOut(true);
      setIsLoadingAdvice(false);
      clearTimeout(timer);
    } else {
      clearTimeout(timer);
      if (aiAdvice || !requestSent) {
        setIsTimedOut(false);
        setIsLoadingAdvice(false);
      }
    }

    return () => clearTimeout(timer);
  }, [aiAdvice, isLoadingAdvice, wsStatus, adviceSpoken]);

  // ------------------------------
  // Reproducir el consejo vía TTS (solo si es nuevo)
  // 🛑 ESTE HOOK CON LA GUARDIA DE REF ES LA ÚNICA FUENTE DE AUDIO
  // ------------------------------
  useEffect(() => {
    const preGameAnalysis = aiAdvice?.preGameAnalysis;
    // Creamos un identificador único basado en el contenido del consejo
    const currentAdviceIdentifier = preGameAnalysis?.astralMantra + preGameAnalysis?.technicalFocus || null;

    // 🔑 GUARDIA DE AUDIO: Solo reproducir si tenemos un análisis Y el identificador es diferente al último reproducido
    if (preGameAnalysis && currentAdviceIdentifier && currentAdviceIdentifier !== lastSpokenIdentifierRef.current) {
      console.log('[PreGameCoach] 🎤 Nuevo consejo recibido. Reproduciendo TTS...', preGameAnalysis);
      
      // 1. Construir el texto
      const ttsText = `${preGameAnalysis.title}. ${preGameAnalysis.astralMantra}. Foco técnico: ${preGameAnalysis.technicalFocus}.`;
      
      // 2. Llamar a la reproducción
      speak(ttsText);
      
      // 3. Actualizar la referencia mutable (NO el estado)
      lastSpokenIdentifierRef.current = currentAdviceIdentifier;
      
      setIsLoadingAdvice(false);
    } else if (aiAdvice && !preGameAnalysis) {
      setIsLoadingAdvice(false);
      console.warn('[PreGameCoach] ⚠️ AI Advice recibido pero sin preGameAnalysis.');
    }
  }, [aiAdvice, speak]); // Se eliminó lastSpokenAdvice de las dependencias

  // ------------------------------
  // Renderizado
  // ------------------------------
  const RELEVANT_PHASES = ['Lobby', 'Matchmaking', 'ReadyCheck', 'ChampSelect']; 
  const isRelevantPhase = RELEVANT_PHASES.includes(gamePhase);

  // 🔑 CORRECCIÓN VISIBILIDAD: Si no estamos en una fase relevante, no renderizar el widget.
  if (!isRelevantPhase) {
      // Nota: El logging del log de depuración debe ir en el componente padre.
      return null; 
  }

  const isReady = !!aiAdvice && LCU_STATUS === 'ONLINE';
  const preGameAnalysis = aiAdvice?.preGameAnalysis;

  return (
    <div
      className={`transition-all duration-300 max-w-xs mx-auto p-3 rounded-xl shadow-lol-lg
        z-50 relative pointer-events-auto
        ${isInteractive
          ? 'bg-lol-blue-dark bg-opacity-95 border-2 border-lol-blue-accent'
          : 'bg-lol-blue-dark border border-lol-gold-dark'
        }`}
      style={{ WebkitAppRegion: 'no-drag' }}
      onMouseEnter={() => setInteractive(true)}
      onMouseLeave={() => setInteractive(false)}
    >
      {/* Barra de arrastre */}
      <div
        className="w-full text-center text-lol-gold-light text-xs py-1 mb-2 -mt-1 rounded cursor-grab flex items-center justify-center"
        style={{ WebkitAppRegion: 'drag' }}
      >
        <FaHandPaper className="mr-2 text-lol-gold" size={12} /> ARRASTRAR WIDGET
      </div>

      {/* Título */}
      <h2 className="font-display text-lg font-bold text-lol-gold flex items-center mb-1">
        <FaBrain className="mr-1 text-lol-blue-accent" size={14} />
        COACH EN COLA
      </h2>

      {/* Estados de renderizado */}
      {(!isReady && isLoadingAdvice && !isTimedOut) ? (
        <div className="text-center p-2 bg-lol-blue-dark rounded">
          <FaSync className="animate-spin text-lol-gold mx-auto text-xl mb-1" />
          <p className="text-lol-gold-light text-xs">Esperando consejo... ({wsStatus})</p>
        </div>
      ) : isTimedOut ? (
        <div className="text-center p-2 bg-lol-blue-dark rounded">
          <FaExclamationTriangle className="text-red-500 mx-auto text-xl mb-1" />
          <p className="text-red-400 text-xs font-bold">
            {wsStatus !== 'CONNECTED' ? 'Fallo: Conexión o Cuota IA (429).' : 'IA sin respuesta (Timeout).'}
          </p>
          <button
            onClick={() => {
              console.log('[PreGameCoach] Reintento solicitado por el usuario.');
              setAdviceSpoken(false);
              setIsLoadingAdvice(true);
              setIsTimedOut(false);
              // Limpiar la referencia de control para permitir el reintento
              lastSpokenIdentifierRef.current = null;
            }}
            className="w-full mt-2 py-1 bg-lol-blue-accent hover:bg-lol-blue-medium text-lol-blue-dark font-bold text-xs rounded transition-colors"
            style={{ WebkitAppRegion: 'no-drag' }}
          >
            <FaRedo className="inline mr-1" size={10} /> Reintentar
          </button>
        </div>
      ) : (
        <div className="space-y-1">
          <div className="flex items-center justify-between p-2 bg-lol-blue-accent/30 rounded border-l-4 border-lol-gold">
            <p className="text-lol-gold-light text-sm font-bold">¡Consejo Listo!</p>
            <FaMicrophoneAlt className="text-lol-gold animate-pulse" />
          </div>

          <button
            onClick={() => {
              // El botón de repetición debe llamar a speak() sin ninguna guardia
              if (preGameAnalysis) {
                const fullAdviceText = `${preGameAnalysis.title}. ${preGameAnalysis.astralMantra}. Foco técnico: ${preGameAnalysis.technicalFocus}.`;
                console.log('[PreGameCoach] Reproduciendo TTS manual:', fullAdviceText);
                speak(fullAdviceText);
              }
            }}
            className="w-full py-1 bg-lol-gold-dark hover:bg-lol-gold/80 text-lol-blue-dark font-bold text-xs rounded transition-colors"
            style={{ WebkitAppRegion: 'no-drag' }}
          >
            <FaRedo className="inline mr-1" size={10} /> Repetir Audio
          </button>
        </div>
      )}
    </div>
  );
}