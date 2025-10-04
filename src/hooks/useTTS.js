// src/hooks/useTTS.js
// Hook React para Text-To-Speech avanzado usando Electron preload.js
import { useCallback, useRef } from 'react';

/**
 * useTTS
 * - Centraliza todo el TTS en el preload.
 * - Maneja cola de reproducción.
 * - Logs detallados para debug.
 */
export const useTTS = () => {
  // Cola interna de textos por reproducir
  const queueRef = useRef([]);
  const isPlayingRef = useRef(false);

  /**
   * playNext
   * Reproduce el siguiente texto en la cola si hay alguno
   */
  const playNext = useCallback(async () => {
    if (isPlayingRef.current) return; // Ya se está reproduciendo algo
    const next = queueRef.current.shift();
    if (!next) {
      console.log('[useTTS] Cola vacía, nada que reproducir');
      isPlayingRef.current = false;
      return;
    }

    console.log('[useTTS] Reproduciendo desde cola:', next.text);
    isPlayingRef.current = true;

    try {
      await window.electronAPI.ttsSpeak(next.text, next.voice, next.rate);
      console.log('[useTTS] Reproducción terminada:', next.text);
    } catch (error) {
      console.error('[useTTS] Error reproduciendo TTS:', error);
    } finally {
      isPlayingRef.current = false;
      playNext(); // Reproducir siguiente en cola
    }
  }, []);

  /**
   * speak
   * Añade texto a la cola y lo reproduce si no hay nada en curso
   */
  const speak = useCallback((text, voice = 'alloy', rate = 1.0) => {
    if (!text || typeof text !== 'string') {
      console.warn('[useTTS] Texto inválido para speak:', text);
      return;
    }

    console.log('[useTTS] Añadiendo texto a la cola:', text);
    queueRef.current.push({ text, voice, rate });
    playNext();
  }, [playNext]);

  /**
   * stop
   * Vacía la cola y detiene cualquier reproducción
   */
  const stop = useCallback(() => {
    console.log('[useTTS] Stop llamado, vaciando cola y cancelando reproducción...');
    queueRef.current = [];
    isPlayingRef.current = false;
    window.electronAPI.ttsStop();
  }, []);

  return { speak, stop };
};
