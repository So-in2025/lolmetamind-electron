// src/components/widgets/ChampSelectCoach.jsx
'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { FaSync, FaRedo, FaBrain, FaExclamationTriangle, FaCheckCircle } from 'react-icons/fa';
import RuneInjector from './RuneInjector';
import { useWebSocketCoach } from '@/hooks/useWebSocketCoach';
import { useInteractiveWidget } from '@/hooks/useInteractiveWidget';
import { useTTS } from '@/hooks/useTTS';

/**
 * ChampSelectCoach
 * Widget para la fase de selección de campeones (Champ Select).
 * - Envía actualizaciones al WS SOLO cuando el draft está suficientemente "completo".
 * - Espera la respuesta del WS vía aiAdvice (no asume que sendX devuelva Promise).
 * - Reproduce TTS una sola vez por consejo.
 */

export default function ChampSelectCoach({ draftData, LCU_STATUS, userData }) {
  console.log('[ChampSelectCoach] RENDER props:', { draftData, LCU_STATUS, userData });

  const { isInteractive, setInteractive } = useInteractiveWidget(false);
  const { speak } = useTTS();

  // WS hook: obtiene aiAdvice desde el servidor y funciones para enviar updates
  const { aiAdvice: wsAiAdvice, wsStatus, sendChampSelectUpdate } = useWebSocketCoach({
    userData,
    targetEvent: 'DRAFT_ADVICE',
    fallbackTTS: false
  });

  // Estados internos
  const [adviceSpoken, setAdviceSpoken] = useState(false);
  const [isLoadingAdvice, setIsLoadingAdvice] = useState(false);
  const [isTimedOut, setIsTimedOut] = useState(false);
  const [lastDraftHash, setLastDraftHash] = useState(null);
  const [aiAdvice, setAiAdvice] = useState(null);
  const [timeoutId, setTimeoutId] = useState(null);

  // Helper: genera hash simple del draft
  const computeDraftHash = useCallback((draft) => {
    if (!draft) return null;
    try {
      // preferimos usar equipos si están presentes
      const teamOne = draft.gameData?.teamOne || draft.teamOne || [];
      const teamTwo = draft.gameData?.teamTwo || draft.teamTwo || [];
      const picks = (draft.gameData?.playerChampionSelections || draft.playerChampionSelections || []);
      const a = teamOne.map(p => p.championId || p.championId).join(',');
      const b = teamTwo.map(p => p.championId || p.championId).join(',');
      const c = picks.map(p => p.championId || p.championId).join(',');
      return `${a}|${b}|${c}`;
    } catch (e) {
      return JSON.stringify(draft).slice(0, 200);
    }
  }, []);

  // Helper: decide si el champselect está "completo" para solicitar análisis.
  // Requisitos: o hay 10 playerChampionSelections, o teamOne/teamTwo tienen al menos 5 cada uno.
  const isDraftComplete = useCallback((draft) => {
    if (!draft) return false;
    const gameData = draft.gameData || {};
    const picks = gameData.playerChampionSelections || [];
    const teamOne = gameData.teamOne || [];
    const teamTwo = gameData.teamTwo || [];

    if (Array.isArray(picks) && picks.length >= 10) return true;
    if (Array.isArray(teamOne) && Array.isArray(teamTwo) && teamOne.length >= 5 && teamTwo.length >= 5) return true;

    // Si la estructura es distinta, también podemos considerar que existe suficiente info:
    // por ejemplo: si hay al menos 6 picks en total (mitad llenos) lo tratamos como "suficiente".
    if ((teamOne.length + teamTwo.length) >= 6) return true;

    return false;
  }, []);

  // Enviar draft al WS SOLO cuando esté completo y haya cambiado respecto al último hash enviado.
  useEffect(() => {
    if (!draftData || !userData) {
      return;
    }

    const currentHash = computeDraftHash(draftData);
    if (!currentHash) return;

    // Evitar reenvíos idénticos
    if (currentHash === lastDraftHash) {
      // Ya enviado ese estado
      return;
    }

    // Si el draft no está completo, no pedir análisis aún.
    if (!isDraftComplete(draftData)) {
      console.log('[ChampSelectCoach] Draft NO completo. Esperando picks/bans antes de solicitar IA.');
      // Limpia cualquier estado previo de loading/advice para evitar confusión visual.
      setIsLoadingAdvice(false);
      setIsTimedOut(false);
      setAiAdvice(null);
      setAdviceSpoken(false);
      setLastDraftHash(currentHash); // guardamos para evitar spam de logs; pero no enviamos
      return;
    }

    // Draft completo -> enviamos al WS
    console.log('[ChampSelectCoach] Draft completo detectado. Enviando CHAMP_SELECT_UPDATE al WS...', draftData);
    setIsLoadingAdvice(true);
    setIsTimedOut(false);
    setAiAdvice(null);
    setAdviceSpoken(false);

    try {
      const sent = sendChampSelectUpdate(draftData);
      if (!sent) {
        console.warn('[ChampSelectCoach] sendChampSelectUpdate devolvió false (no conectado).');
        setIsTimedOut(true);
        setIsLoadingAdvice(false);
        setLastDraftHash(currentHash);
        return;
      }
    } catch (err) {
      console.error('[ChampSelectCoach] Error al invocar sendChampSelectUpdate:', err);
      setIsTimedOut(true);
      setIsLoadingAdvice(false);
      setLastDraftHash(currentHash);
      return;
    }

    // establecer timeout de espera por respuesta WS (15s)
    if (timeoutId) {
      clearTimeout(timeoutId);
      setTimeoutId(null);
    }
    const t = setTimeout(() => {
      console.warn('[ChampSelectCoach] Timeout: no llegó respuesta del WS en 15s.');
      setIsTimedOut(true);
      setIsLoadingAdvice(false);
    }, 15000);
    setTimeoutId(t);

    // guardamos hash como "enviado" para evitar reenvíos inmediatos
    setLastDraftHash(currentHash);
  }, [draftData, userData, computeDraftHash, isDraftComplete, lastDraftHash, sendChampSelectUpdate]);

  // Cuando llega aiAdvice desde el WS, lo procesamos aquí.
  useEffect(() => {
    if (!wsAiAdvice) return;

    console.log('[ChampSelectCoach] ✅ aiAdvice recibido desde WS:', wsAiAdvice);
    // Cancelar timeout si existía
    if (timeoutId) {
      clearTimeout(timeoutId);
      setTimeoutId(null);
    }

    setAiAdvice(wsAiAdvice);
    setIsLoadingAdvice(false);
    setIsTimedOut(false);

    // Reproducir TTS si vienen tips y no las hemos reproducido aún
    try {
      if (!adviceSpoken && wsAiAdvice?.tips && Array.isArray(wsAiAdvice.tips) && wsAiAdvice.tips.length > 0) {
        const adviceText = wsAiAdvice.tips.join('. ');
        console.log('[ChampSelectCoach] 🎤 Reproduciendo TTS automático (advice tips):', adviceText);
        speak(adviceText);
        setAdviceSpoken(true);
      } else if (!adviceSpoken && wsAiAdvice?.preGameAnalysis?.fullText) {
        // fallback: si viene fullText preGameAnalysis (aunque esto es champ select)
        const adviceText = wsAiAdvice.preGameAnalysis.fullText;
        console.log('[ChampSelectCoach] 🎤 Reproduciendo TTS automático (preGameAnalysis.fullText):', adviceText);
        speak(adviceText);
        setAdviceSpoken(true);
      }
    } catch (e) {
      console.warn('[ChampSelectCoach] Error al intentar TTS:', e.message);
    }
  }, [wsAiAdvice, adviceSpoken, speak, timeoutId]);

  // Timeout guard: si no hay respuesta y no estuvimos en estado de envio, limpiamos timer
  useEffect(() => {
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [timeoutId]);

  // UI render
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
      <div
        className="w-full text-center text-lol-gold-light text-xs py-1 mb-2 -mt-1 rounded cursor-grab flex items-center justify-center"
        style={{ WebkitAppRegion: 'drag' }}
      >
        Selección de Campeones
      </div>

      <h2 className="font-display text-lg font-bold text-lol-gold flex items-center mb-1">
        <FaBrain className="mr-1 text-lol-blue-accent" size={14} />
        COACH DRAFT
      </h2>

      {(!aiAdvice && isLoadingAdvice && !isTimedOut) ? (
        <div className="text-center p-2 bg-lol-blue-dark rounded">
          <FaSync className="animate-spin text-lol-gold mx-auto text-xl mb-1" />
          <p className="text-lol-gold-light text-xs">Analizando draft... ({wsStatus})</p>
          <p className="text-lol-gold-light text-xs mt-1">Enviando cuando la selección esté completa.</p>
        </div>
      ) : isTimedOut ? (
        <div className="text-center p-2 bg-lol-blue-dark rounded">
          <FaExclamationTriangle className="text-red-500 mx-auto text-xl mb-1" />
          <p className="text-red-400 text-xs font-bold">
            {wsStatus !== 'CONNECTED' ? 'Fallo: Conexión WS o Cuota IA (429).' : 'IA sin respuesta (Timeout).'}
          </p>
          <button
            onClick={() => {
              console.log('[ChampSelectCoach] 🔄 Reintento manual solicitado.');
              // Permitir reintento forzando lastDraftHash a null para reenviar en el siguiente effect
              setLastDraftHash(null);
              setIsTimedOut(false);
              setIsLoadingAdvice(true);
              setAdviceSpoken(false);
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

          {/* Inyección de runas (si el advice trae recommendedRunepage) */}
          {aiAdvice?.recommendedRunepage && (
            <RuneInjector runepageData={aiAdvice.recommendedRunepage} />
          )}

          {/* Tips de IA */}
          <div className="text-lol-gold-light text-xs break-words">
            {aiAdvice?.tips?.map((tip, idx) => (
              <p key={idx} className="mb-1">• {tip}</p>
            ))}

            {/* Fallback para preGameAnalysis.fullText si se usa ese campo */}
            {!aiAdvice?.tips && aiAdvice?.preGameAnalysis?.fullText && (
              <p className="mb-1">• {aiAdvice.preGameAnalysis.fullText}</p>
            )}
          </div>

          <button
            onClick={() => {
              if (aiAdvice?.tips?.length) {
                const adviceText = aiAdvice.tips.join('. ');
                console.log('[ChampSelectCoach] 🎤 Reproduciendo TTS manual:', adviceText);
                speak(adviceText);
                setAdviceSpoken(true);
              } else if (aiAdvice?.preGameAnalysis?.fullText) {
                console.log('[ChampSelectCoach] 🎤 Reproduciendo TTS manual (fullText):', aiAdvice.preGameAnalysis.fullText);
                speak(aiAdvice.preGameAnalysis.fullText);
                setAdviceSpoken(true);
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
