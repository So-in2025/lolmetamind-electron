// ===========================================
// 🧠 useTTS Hook (Versión PRO-DEV, Coqui TTS)
// ===========================================
// Este hook centraliza el control de Text-To-Speech en el front React
// - Usa exclusivamente Coqui TTS vía Electron IPC
// - Implementa cola de reproducción y evita superposición de audios
// - Permite personalización de velocidad y pitch
// - Todos los logs detallados para desarrollo
// ===========================================

import { useCallback, useRef } from 'react';

export const useTTS = () => {
  // -----------------------------
  // ESTADOS INTERNOS Y REFERENCIAS
  // -----------------------------

  // Cola de mensajes pendientes
  const queueRef = useRef([]);
  // Bandera: ¿hay un audio reproduciéndose?
  const isPlayingRef = useRef(false);
  // Audio actual (archivo generado por Coqui TTS)
  const currentAudioRef = useRef(null);

  // =====================================================
  // ▶️ FUNCIÓN PRINCIPAL: Reproducir siguiente texto en la cola
  // =====================================================
  const playNext = useCallback(async () => {
    if (isPlayingRef.current) return; // Ya hay un audio activo
    const next = queueRef.current.shift();

    if (!next) {
      console.log('[TTS HOOK] 🔕 Cola vacía. Nada por reproducir.');
      isPlayingRef.current = false;
      return;
    }

    console.log(`[TTS HOOK] ▶ Reproduciendo: "${next.text}"`);
    isPlayingRef.current = true;

    try {
      // Intentamos usar Coqui TTS vía Electron IPC
      if (!window.electronAPI?.coquiTtsSpeak) {
        throw new Error('Coqui TTS no disponible en preload.js');
      }

      const result = await window.electronAPI.coquiTtsSpeak(next.text, next.rate, next.pitch);

      if (result?.filePath) {
        console.log('[TTS HOOK] 🔊 Audio Coqui recibido:', result.filePath);
        const audio = new Audio(result.filePath);
        currentAudioRef.current = audio;

        await new Promise((resolve, reject) => {
          audio.onended = resolve;
          audio.onerror = reject;
          audio.play().catch(reject);
        });
      } else {
        console.warn('[TTS HOOK] ⚠ No se generó archivo de audio Coqui TTS. Reproducción cancelada.');
      }
    } catch (error) {
      console.error('[TTS HOOK] ❌ Error al usar Coqui TTS:', error);
    } finally {
      isPlayingRef.current = false;
      currentAudioRef.current = null;
      // Continuar con siguiente mensaje en la cola
      playNext();
    }
  }, []);

  // =====================================================
  // 🗣️ FUNCIÓN PÚBLICA: speak()
  // =====================================================
  const speak = useCallback((text, rate = 1.0, pitch = 1.0) => {
    if (!text || typeof text !== 'string') {
      console.warn('[TTS HOOK] Texto inválido recibido para speak():', text);
      return;
    }

    // Agregar a la cola
    queueRef.current.push({ text, rate, pitch });
    console.log(`[TTS HOOK] ➕ Añadido a la cola (${queueRef.current.length} items):`, text);

    // Si nada se está reproduciendo, iniciar reproducción
    playNext();
  }, [playNext]);

  // =====================================================
  // ⏹ FUNCIÓN PÚBLICA: stop()
  // =====================================================
  const stop = useCallback(() => {
    console.log('[TTS HOOK] ⏹ Deteniendo TTS y limpiando cola.');

    // Vaciar cola
    queueRef.current = [];
    isPlayingRef.current = false;

    // Si hay audio reproduciéndose
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }

    // Avisar al preload/main para detener cualquier generación en curso
    if (window.electronAPI?.coquiTtsStop) window.electronAPI.coquiTtsStop();
  }, []);

  // =====================================================
  // Retornamos API pública del hook
  // =====================================================
  return { speak, stop };
};
