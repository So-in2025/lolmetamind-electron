'use client';

import React, { useEffect, useState, useRef } from 'react';
import { FaSync, FaBrain, FaMicrophoneAlt, FaExclamationTriangle, FaRedo, FaStop } from 'react-icons/fa';
import { useWebSocketCoach } from '@/hooks/useWebSocketCoach';
import { useTTS } from '@/hooks/useTTS';
import { useInteractiveWidget } from '@/hooks/useInteractiveWidget';

/**
 * PreGameCoach (v4.1 – Título, Velocidad y Botón Stop)
 * =====================================================
 *
 * 🔹 PROPÓSITO:
 * Componente React para mostrar y reproducir consejos pre-partida
 * de la IA en tiempo real para League of Legends, con TTS fluido.
 *
 * 🔹 OBJETIVOS DE ESTA VERSIÓN:
 * 1. Título actualizado a "Coach Astrológico".
 * 2. Velocidad de voz aumentada a 1.2 para mayor fluidez.
 * 3. Evita repetir audios usando un identificador hash simple.
 * 4. Maneja timeout de 15s si la IA no responde.
 * 5. Botón "Repetir Audio" y nuevo botón "Stop" para interrumpir TTS.
 * 6. Comentarios PRO-DEV completos para mantenimiento.
 *
 * 🔹 HOOKS USADOS:
 * - useWebSocketCoach: obtiene consejos de la IA vía WebSocket.
 * - useTTS: controla reproducción TTS (facebook/mms-tts).
 * - useInteractiveWidget: gestiona la interactividad visual del widget.
 *
 * 🔹 FLUJO PRINCIPAL:
 * - Detecta fases relevantes: Lobby, Matchmaking, ReadyCheck, ChampSelect.
 * - Solicita consejo IA solo una vez por fase.
 * - Timeout: 15s sin respuesta → permite reintentar.
 * - Reproduce audio TTS con velocidad 1.2, pausas naturales y control de repetición.
 */

export default function PreGameCoach({ LCU_STATUS, userData, gamePhase }) {
  console.log(`[PreGameCoach] --- RENDERIZANDO --- Fase: ${gamePhase}`);

  // 🟢 Hooks
  const { aiAdvice, wsStatus, sendQueueUpdate } = useWebSocketCoach({
    userData,
    targetEvent: 'QUEUE_ADVICE',
  });

  const { speak, stop } = useTTS();
  const { isInteractive, setInteractive } = useInteractiveWidget(false);

  // 🔹 Estados
  const [isLoading, setIsLoading] = useState(true);
  const [isTimedOut, setIsTimedOut] = useState(false);
  const hasRequestedAdvice = useRef(false);
  const lastSpokenIdentifier = useRef(null);

  // ===========================================================
  // 1️⃣ Solicitar consejo a la IA solo en fases relevantes
  // ===========================================================
  useEffect(() => {
    const isRelevantPhase = ['Lobby', 'Matchmaking', 'ReadyCheck', 'ChampSelect'].includes(gamePhase);

    if (isRelevantPhase && wsStatus === 'CONNECTED' && !hasRequestedAdvice.current) {
      console.log('[PreGameCoach] ✅ Condiciones cumplidas. Solicitando consejo...');
      sendQueueUpdate();
      hasRequestedAdvice.current = true;
      setIsLoading(true);
      setIsTimedOut(false);
    }

    if (!isRelevantPhase) {
      hasRequestedAdvice.current = false;
      lastSpokenIdentifier.current = null;
    }
  }, [gamePhase, wsStatus, sendQueueUpdate]);

  // ===========================================================
  // 2️⃣ Manejar timeout de 15s si la IA no responde
  // ===========================================================
  useEffect(() => {
    if (!isLoading) return;

    const timer = setTimeout(() => {
      if (!aiAdvice) {
        console.warn('[PreGameCoach] ⚠️ Timeout: La IA no respondió en 15 segundos.');
        setIsTimedOut(true);
        setIsLoading(false);
      }
    }, 15000);

    return () => clearTimeout(timer);
  }, [isLoading, aiAdvice]);

  // ===========================================================
  // 3️⃣ Reproducir el consejo recibido con TTS fluido
  // ===========================================================
  useEffect(() => {
    const preGameAnalysis = aiAdvice?.preGameAnalysis;
    if (!preGameAnalysis) return;

    const currentIdentifier = preGameAnalysis.astralMantra + preGameAnalysis.technicalFocus;

    if (currentIdentifier !== lastSpokenIdentifier.current) {
      console.log('[PreGameCoach] 🎤 Nuevo consejo recibido. Reproduciendo TTS fluido...');

      const fullTextToSpeak = [
        preGameAnalysis.title,
        preGameAnalysis.astralMantra,
        `Foco técnico: ${preGameAnalysis.technicalFocus}`
      ].join('. ');

      // 🔹 Velocidad aumentada a 1.2
      speak(fullTextToSpeak, 1.2);

      lastSpokenIdentifier.current = currentIdentifier;
      setIsLoading(false);
    }
  }, [aiAdvice, speak]);

  // ===========================================================
  // Renderizado del contenido según estado
  // ===========================================================
  const isRelevantPhase = ['Lobby', 'Matchmaking', 'ReadyCheck', 'ChampSelect'].includes(gamePhase);
  if (!isRelevantPhase) return null;

  const renderContent = () => {
    // 🔹 Loading
    if (isLoading && !isTimedOut) {
      return (
        <div className="text-center p-2">
          <FaSync className="animate-spin text-lol-gold mx-auto text-2xl" />
          <p className="text-lol-gold-light text-xs mt-1">Analizando...</p>
        </div>
      );
    }

    // 🔹 Timeout
    if (isTimedOut) {
      return (
        <div className="text-center p-2">
          <FaExclamationTriangle className="text-red-500 mx-auto text-2xl" />
          <button
            onClick={() => {
              hasRequestedAdvice.current = false;
              setIsTimedOut(false);
              setIsLoading(true);
            }}
            className="w-full mt-2 py-1 bg-lol-blue-accent hover:bg-lol-blue-medium text-lol-blue-dark font-bold text-xs rounded transition-colors"
            style={{ WebkitAppRegion: 'no-drag' }}
          >
            <FaRedo className="inline mr-1" size={10} /> Reintentar
          </button>
        </div>
      );
    }

    // 🔹 Consejo recibido
    if (aiAdvice?.preGameAnalysis) {
      return (
        <div className="flex flex-col items-center justify-center p-2 space-y-2">
          <FaMicrophoneAlt className="text-lol-gold animate-pulse text-2xl" />
          <div className="flex gap-2 w-full">
            <button
              onClick={() => {
                if (aiAdvice.preGameAnalysis) {
                  stop();
                  const fullTextToSpeak = [
                    aiAdvice.preGameAnalysis.title,
                    aiAdvice.preGameAnalysis.astralMantra,
                    `Foco técnico: ${aiAdvice.preGameAnalysis.technicalFocus}`
                  ].join('. ');
                  speak(fullTextToSpeak, 1.2);
                }
              }}
              className="flex-1 py-1 bg-lol-gold-dark hover:bg-lol-gold/80 text-lol-blue-dark font-bold text-xs rounded transition-colors"
              style={{ WebkitAppRegion: 'no-drag' }}
            >
              <FaRedo className="inline mr-1" size={10} /> Repetir Audio
            </button>

            {/* 🔹 Nuevo botón Stop */}
            <button
              onClick={() => stop()}
              className="flex-1 py-1 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded transition-colors"
              style={{ WebkitAppRegion: 'no-drag' }}
            >
              <FaStop className="inline mr-1" size={10} /> Stop
            </button>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div
      className={`transition-all duration-300 max-w-xs mx-auto p-3 rounded-xl shadow-lol-lg z-50 relative pointer-events-auto ${isInteractive ? 'bg-lol-blue-dark bg-opacity-95 border-2 border-lol-blue-accent' : 'bg-lol-blue-dark border border-lol-gold-dark'}`}
      style={{ WebkitAppRegion: 'drag' }}
      onMouseEnter={() => setInteractive(true)}
      onMouseLeave={() => setInteractive(false)}
    >
      {/* 🔹 Título del coach */}
      <h2 className="font-display text-lg font-bold text-lol-gold flex items-center justify-center mb-1 text-center">
        <FaBrain className="mr-2 text-lol-blue-accent" size={14} />
        Coach Astrológico
      </h2>
      {renderContent()}
    </div>
  );
}
