'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { FaSync, FaRedo, FaBrain, FaExclamationTriangle, FaCheckCircle } from 'react-icons/fa';
import RuneInjector from './RuneInjector';
import { useWebSocketCoach } from '@/hooks/useWebSocketCoach';
import { useInteractiveWidget } from '@/hooks/useInteractiveWidget';

/**
 * ChampSelectCoach
 * Widget para la fase de selección de campeones.
 * - Recibe draftData y userData desde useLcuData
 * - Solicita análisis de draft a WebSocket/IA
 * - Permite inyectar runas automáticamente
 * - Maneja estados de timeout y reintento
 */
export default function ChampSelectCoach({ draftData, LCU_STATUS, userData }) {
  console.log('[ChampSelectCoach] --- RENDERIZANDO ---');
  console.log('[ChampSelectCoach] Props recibidas:', { draftData, LCU_STATUS, userData });

  const { isInteractive, setInteractive } = useInteractiveWidget(false);

  // ------------------------------
  // Estados internos
  // ------------------------------
  const [adviceSpoken, setAdviceSpoken] = useState(false);
  const [isLoadingAdvice, setIsLoadingAdvice] = useState(true);
  const [isTimedOut, setIsTimedOut] = useState(false);
  const [lastDraftHash, setLastDraftHash] = useState(null);
  const [aiAdvice, setAiAdvice] = useState(null);

  // ------------------------------
  // Hook WS: obtener consejos de draft
  // ------------------------------
  const { wsStatus, sendDraftUpdate } = useWebSocketCoach({
    userData,
    targetEvent: 'DRAFT_ADVICE',
  });

  // ------------------------------
  // Generar hash rápido del draft para evitar reenvíos repetidos
  // ------------------------------
  const computeDraftHash = useCallback((draft) => {
    if (!draft) return null;
    const myTeamHash = draft.myTeam?.map(p => `${p.championId}-${p.summonerId}`).join('|');
    const theirTeamHash = draft.theirTeam?.map(p => `${p.championId}-${p.summonerId}`).join('|');
    return `${myTeamHash}|${theirTeamHash}`;
  }, []);

  // ------------------------------
  // Enviar draft al WS si cambió
  // ------------------------------
  useEffect(() => {
    if (!draftData || !userData) return;

    const currentHash = computeDraftHash(draftData);
    if (currentHash === lastDraftHash) return;

    console.log('[ChampSelectCoach] Nuevo draft detectado. Enviando a WS para análisis...', draftData);

    setIsLoadingAdvice(true);
    setIsTimedOut(false);

    sendDraftUpdate(draftData)
      .then((advice) => {
        console.log('[ChampSelectCoach] Consejos recibidos del WS:', advice);
        setAiAdvice(advice);
        setIsLoadingAdvice(false);
      })
      .catch((err) => {
        console.error('[ChampSelectCoach] Error al solicitar consejos:', err);
        setIsTimedOut(true);
        setIsLoadingAdvice(false);
      });

    setLastDraftHash(currentHash);
    setAdviceSpoken(true);
  }, [draftData, userData, lastDraftHash, computeDraftHash, sendDraftUpdate]);

  // ------------------------------
  // Timeout por si WS no responde
  // ------------------------------
  useEffect(() => {
    if (!adviceSpoken || aiAdvice) return;

    const timer = setTimeout(() => {
      console.warn('[ChampSelectCoach] ⚠️ Timeout: WS no respondió a tiempo.');
      setIsTimedOut(true);
      setIsLoadingAdvice(false);
    }, 15000);

    return () => clearTimeout(timer);
  }, [adviceSpoken, aiAdvice]);

  // ------------------------------
  // Renderizado
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
      {/* Barra de arrastre */}
      <div
        className="w-full text-center text-lol-gold-light text-xs py-1 mb-2 -mt-1 rounded cursor-grab flex items-center justify-center"
        style={{ WebkitAppRegion: 'drag' }}
      >
        Selección de Campeones
      </div>

      {/* Título */}
      <h2 className="font-display text-lg font-bold text-lol-gold flex items-center mb-1">
        <FaBrain className="mr-1 text-lol-blue-accent" size={14} />
        COACH DRAFT
      </h2>

      {/* Estados */}
      {(!aiAdvice && isLoadingAdvice && !isTimedOut) ? (
        <div className="text-center p-2 bg-lol-blue-dark rounded">
          <FaSync className="animate-spin text-lol-gold mx-auto text-xl mb-1" />
          <p className="text-lol-gold-light text-xs">Analizando draft... ({wsStatus})</p>
        </div>
      ) : isTimedOut ? (
        <div className="text-center p-2 bg-lol-blue-dark rounded">
          <FaExclamationTriangle className="text-red-500 mx-auto text-xl mb-1" />
          <p className="text-red-400 text-xs font-bold">
            {wsStatus !== 'CONNECTED' ? 'Fallo: Conexión WS o Cuota IA (429).' : 'IA sin respuesta (Timeout).'}
          </p>
          <button
            onClick={() => {
              console.log('[ChampSelectCoach] Reintento manual solicitado.');
              setAdviceSpoken(false);
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
            <p className="text-lol-gold-light text-sm font-bold">Consejo listo:</p>
            <FaCheckCircle className="text-lol-gold animate-pulse" />
          </div>

          {/* Inyección de runas */}
          {aiAdvice?.recommendedRunepage && (
            <RuneInjector runepageData={aiAdvice.recommendedRunepage} />
          )}

          {/* Tips de IA */}
          <div className="text-lol-gold-light text-xs break-words">
            {aiAdvice?.tips?.map((tip, idx) => (
              <p key={idx} className="mb-1">• {tip}</p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
