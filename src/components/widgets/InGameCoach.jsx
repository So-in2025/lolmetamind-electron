// src/components/widgets/InGameCoach.jsx
'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { FaSync, FaExclamationTriangle, FaCheckCircle, FaBolt, FaRedo } from 'react-icons/fa';
import { useInteractiveWidget } from '@/hooks/useInteractiveWidget';
import { useWebSocketCoach } from '@/hooks/useWebSocketCoach';
import { useTTS } from '@/hooks/useTTS';

/**
 * InGameCoach
 * ============================
 * Widget para fase InProgress (partida en vivo)
 * - Recibe liveData y userData desde useLcuData
 * - Analiza estado de partida y genera consejos en tiempo real
 * - Utiliza TTS API (Hugging Face) para lectura de consejos
 * - Maneja timeout, reintentos, logs y renderizado interactivo
 * - Evita reprocesar datos repetidos usando hash de liveData
 * ============================
 */
export default function InGameCoach({ liveData, userData, LCU_STATUS }) {
  console.log('[InGameCoach] --- RENDERIZANDO --- Props:', { liveData, userData, LCU_STATUS });

  const { isInteractive, setInteractive } = useInteractiveWidget(false);
  const { speak } = useTTS(); // ✅ Hook TTS (API)

  // ------------------------------
  // Estados internos
  // ------------------------------
  const [aiAdvice, setAiAdvice] = useState(null); // Consejos de IA
  const [isLoadingAdvice, setIsLoadingAdvice] = useState(true);
  const [isTimedOut, setIsTimedOut] = useState(false);
  const [lastGameHash, setLastGameHash] = useState(null);

  // ------------------------------
  // Hook WebSocket para IA / Coach
  // ------------------------------
  const { wsStatus, sendInGameUpdate } = useWebSocketCoach({
    userData,
    targetEvent: 'LIVE_ADVICE',
  });

  // ------------------------------
  // Generar hash de liveData para no enviar datos repetidos
  // ------------------------------
  const computeLiveHash = useCallback((live) => {
    if (!live) return null;

    const allyHash = live.myTeam?.map(p => `${p.championId}-${p.summonerId}-${p.currentHealth}`).join('|');
    const enemyHash = live.theirTeam?.map(p => `${p.championId}-${p.summonerId}-${p.currentHealth}`).join('|');
    const objectivesHash = `${live.dragons?.length || 0}-${live.barons?.length || 0}`;

    return `${allyHash}|${enemyHash}|${objectivesHash}|${live.timestamp}`;
  }, []);

  // ------------------------------
  // Enviar liveData al WS si cambia
  // ------------------------------
  useEffect(() => {
    if (!liveData || !userData) return;

    const currentHash = computeLiveHash(liveData);
    if (currentHash === lastGameHash) {
      console.log('[InGameCoach] ⚡ liveData sin cambios. No se envía al WS.');
      return;
    }

    console.log('[InGameCoach] 🛰️ Nueva actualización de liveData. Enviando a WS...', liveData);
    setIsLoadingAdvice(true);
    setIsTimedOut(false);

    sendInGameUpdate(liveData)
      .then((advice) => {
        console.log('[InGameCoach] ✅ Consejos recibidos del WS:', advice);
        setAiAdvice(advice);
        setIsLoadingAdvice(false);
      })
      .catch((err) => {
        console.error('[InGameCoach] ❌ Error al solicitar consejos:', err);
        setIsTimedOut(true);
        setIsLoadingAdvice(false);
      });

    setLastGameHash(currentHash);
  }, [liveData, userData, lastGameHash, computeLiveHash, sendInGameUpdate]);

  // ------------------------------
  // Timeout en caso de que WS no responda
  // ------------------------------
  useEffect(() => {
    if (!isLoadingAdvice || aiAdvice) return;

    const timer = setTimeout(() => {
      console.warn('[InGameCoach] ⚠️ Timeout: WS no respondió a tiempo.');
      setIsTimedOut(true);
      setIsLoadingAdvice(false);
    }, 15000);

    return () => clearTimeout(timer);
  }, [isLoadingAdvice, aiAdvice]);

  // ------------------------------
  // Reproducir TTS automáticamente cuando llegan nuevos consejos
  // ------------------------------
  useEffect(() => {
    if (!aiAdvice?.tips?.length) return;

    const adviceText = aiAdvice.tips.join('. ');
    console.log('[InGameCoach] 🎤 Reproduciendo TTS automático (via API):', adviceText);

    speak(adviceText); // Llama al hook useTTS que usa la API
  }, [aiAdvice, speak]);

  // ------------------------------
  // Renderizado del widget
  // ------------------------------
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
      {/* BARRA DE ESTADO */}
      <div
        className="w-full text-center text-lol-gold-light text-xs py-1 mb-2 -mt-1 rounded cursor-grab flex items-center justify-center"
        style={{ WebkitAppRegion: 'drag' }}
      >
        Partida en Vivo
      </div>

      {/* TÍTULO */}
      <h2 className="font-display text-lg font-bold text-lol-gold flex items-center mb-1">
        <FaBolt className="mr-1 text-lol-blue-accent" size={14} />
        COACH EN JUEGO
      </h2>

      {/* ESTADOS */}
      {isLoadingAdvice && !isTimedOut ? (
        <div className="text-center p-2 bg-lol-blue-dark rounded">
          <FaSync className="animate-spin text-lol-gold mx-auto text-xl mb-1" />
          <p className="text-lol-gold-light text-xs">Analizando estado de partida... ({wsStatus})</p>
        </div>
      ) : isTimedOut ? (
        <div className="text-center p-2 bg-lol-blue-dark rounded">
          <FaExclamationTriangle className="text-red-500 mx-auto text-xl mb-1" />
          <p className="text-red-400 text-xs font-bold">
            {wsStatus !== 'CONNECTED' ? 'Fallo: Conexión WS o Cuota IA (429).' : 'IA sin respuesta (Timeout).'}
          </p>
          <button
            onClick={() => {
              console.log('[InGameCoach] 🔄 Reintento manual solicitado.');
              setIsLoadingAdvice(true);
              setIsTimedOut(false);
            }}
            className="w-full mt-2 py-1 bg-lol-blue-accent hover:bg-lol-blue-medium text-lol-blue-dark font-bold text-xs rounded transition-colors"
            style={{ WebkitAppRegion: 'no-drag' }}
          >
            <FaRedo className="inline mr-1" size={10} /> Reintentar
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between p-2 bg-lol-blue-accent/30 rounded border-l-4 border-lol-gold">
            <p className="text-lol-gold-light text-sm font-bold">Consejos IA en vivo:</p>
            <FaCheckCircle className="text-lol-gold animate-pulse" />
          </div>

          {/* Mostrar tips */}
          <div className="text-lol-gold-light text-xs break-words">
            {aiAdvice?.tips?.map((tip, idx) => (
              <p key={idx} className="mb-1">• {tip}</p>
            ))}
          </div>

          {/* Botón para repetir audio */}
          <button
            onClick={() => {
              if (aiAdvice?.tips?.length) {
                const adviceText = aiAdvice.tips.join('. ');
                console.log('[InGameCoach] 🎤 Reproduciendo TTS manual:', adviceText);
                speak(adviceText);
              }
            }}
            className="w-full py-1 bg-lol-gold-dark hover:bg-lol-gold/80 text-lol-blue-dark font-bold text-xs rounded transition-colors"
          >
            <FaRedo className="inline mr-1" size={10} /> Repetir Audio
          </button>
        </div>
      )}
    </div>
  );
}