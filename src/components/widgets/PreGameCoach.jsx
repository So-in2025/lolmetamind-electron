'use client';

import React, { useEffect, useState, useRef } from 'react';
import { FaSync, FaBrain, FaMicrophoneAlt, FaExclamationTriangle, FaRedo, FaStop } from 'react-icons/fa';
import { useWebSocketCoach } from '@/hooks/useWebSocketCoach';
import { useTTS } from '@/hooks/useTTS';
import { useInteractiveWidget } from '@/hooks/useInteractiveWidget';

/**
 * ================================================
 * 🎯 PreGameCoach — v3 (Edición Profesional)
 * ================================================
 * - Conecta al WebSocket de coaching (QUEUE_ADVICE)
 * - Preload y reproduce análisis TTS del pre-game
 * - Muestra spinner, fallback, retry, y control stop
 * - Usa SSML cuando está disponible para mayor naturalidad
 * 
 * Autor: Jonathan
 * Fecha: 2025-10-07
 * ================================================
 */

export default function PreGameCoach({ LCU_STATUS, userData, gamePhase }) {
  console.log(`[PreGameCoach] ⚙️ Render → phase=${gamePhase}`);

  // --- HOOKS PRINCIPALES ---
  const { aiAdvice, wsStatus, sendQueueUpdate } = useWebSocketCoach({ userData, targetEvent: 'QUEUE_ADVICE' });
  const { speak, stop, preload } = useTTS();
  const { isInteractive, setInteractive } = useInteractiveWidget(false);

  // --- ESTADOS INTERNOS ---
  const [isLoading, setIsLoading] = useState(true);
  const [isTimedOut, setIsTimedOut] = useState(false);
  const [isAudioReady, setIsAudioReady] = useState(false);

  const hasRequestedAdvice = useRef(false);
  const lastIdentifier = useRef(null);
  const timeoutRef = useRef(null);

  // --- SOLICITAR CONSEJO AL ENTRAR EN FASE RELEVANTE ---
  useEffect(() => {
    const isRelevant = ['Lobby', 'Matchmaking', 'ReadyCheck', 'ChampSelect'].includes(gamePhase);

    if (isRelevant && wsStatus === 'CONNECTED' && !hasRequestedAdvice.current) {
      console.log('[PreGameCoach] 🚀 Solicitando consejo pre-game...');
      sendQueueUpdate();
      hasRequestedAdvice.current = true;
      setIsLoading(true);
      setIsTimedOut(false);
      setIsAudioReady(false);
    }

    if (!isRelevant) {
      // Reset al salir del flujo de fase relevante
      hasRequestedAdvice.current = false;
      lastIdentifier.current = null;
      setIsLoading(false);
      setIsAudioReady(false);
    }
  }, [gamePhase, wsStatus, sendQueueUpdate]);

  // --- TIMEOUT DE RESPUESTA (15s) ---
  useEffect(() => {
    if (!isLoading) return;
    timeoutRef.current = setTimeout(() => {
      if (!aiAdvice) {
        console.warn('[PreGameCoach] ⏱ Timeout: no se recibió consejo en 15s.');
        setIsTimedOut(true);
        setIsLoading(false);
        setIsAudioReady(false);
      }
    }, 15000);
    return () => clearTimeout(timeoutRef.current);
  }, [isLoading, aiAdvice]);

  // --- PRELOAD Y TTS AUTOMÁTICO AL RECIBIR CONSEJO ---
  useEffect(() => {
    const pre = aiAdvice?.preGameAnalysis;
    if (!pre) return;

    const identifier = (pre.fullText || pre.title || '') + (pre.fullTextSSML || '');
    if (identifier === lastIdentifier.current) {
      console.log('[PreGameCoach] 🟡 Mismo consejo detectado → se omite.');
      return;
    }

    const textForAudio = pre.fullTextSSML || pre.fullText;
    if (!textForAudio) {
      console.warn('[PreGameCoach] ⚠️ Consejo sin texto reproducible.');
      return;
    }

    setIsLoading(true);
    setIsAudioReady(false);

    (async () => {
      try {
        console.log('[PreGameCoach] 🎧 Preload de audio iniciado...');
        await preload(textForAudio, 0.85);
        setIsAudioReady(true);
        console.log('[PreGameCoach] ✅ Audio preloaded → reproduciendo...');
        await speak(textForAudio, 0.85);
      } catch (err) {
        console.warn('[PreGameCoach] ⚠️ Fallback → intentando speak directo.', err?.message || err);
        try {
          await speak(textForAudio, 0.85);
          setIsAudioReady(true);
        } catch (finalErr) {
          console.error('[PreGameCoach] ❌ Falló reproducción final TTS:', finalErr?.message);
          setIsAudioReady(false);
        }
      } finally {
        setIsLoading(false);
        lastIdentifier.current = identifier;
      }
    })();
  }, [aiAdvice, preload, speak]);

  // --- CONDICIÓN DE FASE ---
  const relevantPhase = ['Lobby', 'Matchmaking', 'ReadyCheck', 'ChampSelect'].includes(gamePhase);
  if (!relevantPhase) return null;

  // --- RENDER DEL WIDGET ---
  const renderContent = () => {
    // --- Spinner / Loading ---
    if (isLoading && !isTimedOut) {
      return (
        <div className="text-center p-2">
          <FaSync className="animate-spin text-lol-gold mx-auto text-2xl" />
          <p className="text-lol-gold-light text-xs mt-1">Analizando y preparando audio...</p>
        </div>
      );
    }

    // --- Timeout / Reintento ---
    if (isTimedOut) {
      return (
        <div className="text-center p-2">
          <FaExclamationTriangle className="text-red-500 mx-auto text-2xl" />
          <button
            onClick={() => {
              hasRequestedAdvice.current = false;
              setIsTimedOut(false);
              setIsLoading(true);
              setIsAudioReady(false);
              sendQueueUpdate();
            }}
            className="w-full mt-2 py-1 bg-lol-blue-accent hover:bg-lol-blue-medium text-lol-blue-dark font-bold text-xs rounded transition-colors"
            style={{ WebkitAppRegion: 'no-drag' }}
          >
            <FaRedo className="inline mr-1" size={10} /> Reintentar
          </button>
        </div>
      );
    }

    // --- Consejo disponible ---
    if (aiAdvice?.preGameAnalysis) {
      const { title, astralMantra, technicalFocus, fullTextSSML, fullText } = aiAdvice.preGameAnalysis;
      const textForAudio = fullTextSSML || fullText;

      return (
        <div className="flex flex-col items-center justify-center p-2 space-y-2">
          <FaMicrophoneAlt className={`text-lol-gold ${isAudioReady ? 'animate-pulse' : ''} text-2xl`} />
          <div className="text-center text-xs text-lol-gold-light">{title || 'Coach Astro-Táctico'}</div>

          <div className="flex gap-2 w-full">
            <button
              onClick={async () => {
                stop();
                try { await speak(textForAudio, 0.85); } catch (e) { console.warn('[PreGameCoach] 🔁 Repeat falló', e.message); }
              }}
              className={`flex-1 py-1 ${isAudioReady ? 'bg-lol-gold-dark hover:bg-lol-gold/80' : 'bg-gray-600 opacity-60 cursor-not-allowed'} text-lol-blue-dark font-bold text-xs rounded transition-colors`}
              style={{ WebkitAppRegion: 'no-drag' }}
              disabled={!isAudioReady}
            >
              <FaRedo className="inline mr-1" size={10} /> Repetir Audio
            </button>

            <button
              onClick={() => stop()}
              className={`flex-1 py-1 ${isAudioReady ? 'bg-red-600 hover:bg-red-500' : 'bg-gray-600 opacity-60 cursor-not-allowed'} text-white font-bold text-xs rounded transition-colors`}
              style={{ WebkitAppRegion: 'no-drag' }}
              disabled={!isAudioReady}
            >
              <FaStop className="inline mr-1" size={10} /> Stop
            </button>
          </div>
        </div>
      );
    }

    return null;
  };

  // --- WIDGET FINAL ---
  return (
    <div
      className={`transition-all duration-300 max-w-xs mx-auto p-3 rounded-xl shadow-lol-lg z-50 relative pointer-events-auto ${
        isInteractive ? 'bg-lol-blue-dark bg-opacity-95 border-2 border-lol-blue-accent' : 'bg-lol-blue-dark border border-lol-gold-dark'
      }`}
      style={{ WebkitAppRegion: 'drag' }}
      onMouseEnter={() => setInteractive(true)}
      onMouseLeave={() => setInteractive(false)}
    >
      <h2 className="font-display text-lg font-bold text-lol-gold flex items-center justify-center mb-1 text-center">
        <FaBrain className="mr-2 text-lol-blue-accent" size={14} />
        Coach Astro-Táctico
      </h2>
      {renderContent()}
    </div>
  );
}
