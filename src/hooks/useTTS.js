// ============================================================
// 🧠 useTTS Hook (v3.2 – Optimizado para facebook/mms-tts)
// ============================================================
// 🔍 PROPÓSITO:
// Hook React responsable del control completo de síntesis de voz (TTS)
// en la capa de frontend de la app Electron (entorno de coaching IA).
//
// 💡 OBJETIVOS DE ESTA VERSIÓN (v3.2):
// 1. Mejorar fluidez y naturalidad de la voz generada por facebook/mms-tts.
// 2. Simular prosodia humana mediante pausas sintéticas y puntuación extendida.
// 3. Evitar superposición de audios y solapamientos entre frases.
// 4. Controlar dinámicamente velocidad y pitch con límites seguros.
// 5. Fragmentar texto largo en frases manejables para el modelo TTS.
// 6. Introducir micro-pauses entre audios (300 ms) para respiración perceptible.
//
// 📦 DEPENDENCIAS:
// - Requiere que `window.electronAPI.coquiTtsSpeak(text, rate, pitch)` esté expuesto
//   vía preload.js y conectado al backend Hugging Face TTS (facebook/mms-tts).
//
// 🧩 ARQUITECTURA DE EJECUCIÓN:
//   speak(text) → preprocessText() → splitIntoChunks()
//       → encolado → playNext() (llama a coquiTtsSpeak) → reproduce secuencialmente
//
// ============================================================

import { useCallback, useRef } from 'react';

export const useTTS = () => {
  // ============================================================
  // 🧩 REFERENCIAS INTERNAS (Persisten entre renders)
  // ============================================================
  const queueRef = useRef([]);          // Cola FIFO de mensajes pendientes
  const isPlayingRef = useRef(false);   // Bandera de reproducción activa
  const currentAudioRef = useRef(null); // Instancia actual de Audio en uso

  // ============================================================
  // 🧹 PREPROCESAMIENTO DE TEXTO (Simula prosodia humana)
  // ============================================================
  // Añade pausas lógicas donde el modelo suele hablar de corrido.
  // Ejemplo: "Vamos a analizar, tu build actual." → pausa corta tras coma.
  const preprocessText = (text) => {
    return text
      .replace(/([,;])/g, '$1 ...')               // pausa corta (~300 ms)
      .replace(/([.?!])\s*/g, '$1 ... ')          // pausa larga (~600 ms)
      .replace(/\b(y|pero|aunque|sin embargo)\b/gi, '... $1') // respiración previa a conector
      .trim();
  };

  // ============================================================
  // ✂️ DIVISIÓN DE TEXTO EN FRASES
  // ============================================================
  // facebook/mms-tts rinde mejor con frases cortas (<10 s cada una).
  // Esta función separa por puntuación principal para mantener ritmo natural.
  const splitIntoChunks = (text) => {
    const chunks = text.match(/[^.!?]+[.!?]+/g);
    return chunks ? chunks.map(c => c.trim()) : [text.trim()];
  };

  // ============================================================
  // ▶️ playNext(): Reproduce siguiente frase en la cola
  // ============================================================
  const playNext = useCallback(async () => {
    if (isPlayingRef.current) return; // Evita solapamientos
    const next = queueRef.current.shift();
    if (!next) {
      isPlayingRef.current = false;
      return;
    }

    isPlayingRef.current = true;
    console.log(`[TTS] ▶ Reproduciendo: "${next.text}"`);

    try {
      // Validación de disponibilidad del puente IPC
      if (!window.electronAPI?.coquiTtsSpeak) {
        throw new Error('API TTS no disponible: window.electronAPI.coquiTtsSpeak');
      }

      // 🔧 Clamps de seguridad: evita valores extremos no soportados
      const rate = Math.min(Math.max(next.rate || 1.0, 0.8), 1.2);
      const pitch = Math.min(Math.max(next.pitch || 1.0, 0.8), 1.2);

      // Llamada a la API TTS (facebook/mms-tts vía backend Electron)
      const result = await window.electronAPI.coquiTtsSpeak(next.text, rate, pitch);

      if (result?.filePath) {
        const audio = new Audio(result.filePath);
        currentAudioRef.current = audio;

        await new Promise((resolve, reject) => {
          audio.onended = resolve;
          audio.onerror = reject;
          audio.play().catch(reject);
        });
      } else {
        console.warn('[TTS] ⚠ No se generó archivo de audio. Reproducción omitida.');
      }
    } catch (err) {
      console.error('[TTS] ❌ Error durante síntesis o reproducción:', err);
    } finally {
      isPlayingRef.current = false;
      currentAudioRef.current = null;

      // 🔁 Delay natural entre frases (~300 ms)
      setTimeout(() => playNext(), 300);
    }
  }, []);

  // ============================================================
  // 🗣️ speak(): Agrega texto a la cola y lanza reproducción
  // ============================================================
  const speak = useCallback((text, rate = 1.0, pitch = 1.0) => {
    if (!text || typeof text !== 'string') {
      console.warn('[TTS] Texto inválido recibido para speak():', text);
      return;
    }

    // Preprocesamiento + fragmentación
    const processed = preprocessText(text);
    const chunks = splitIntoChunks(processed);

    // Encolado
    chunks.forEach(chunk => queueRef.current.push({ text: chunk, rate, pitch }));
    console.log(`[TTS] ➕ ${chunks.length} frases añadidas a la cola.`);

    // Si nada está reproduciéndose, iniciar ciclo
    if (!isPlayingRef.current) playNext();
  }, [playNext]);

  // ============================================================
  // ⏹ stop(): Detiene reproducción y limpia recursos
  // ============================================================
  const stop = useCallback(() => {
    console.log('[TTS] ⏹ Deteniendo síntesis y limpiando cola.');

    queueRef.current = [];
    isPlayingRef.current = false;

    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.src = ''; // libera memoria
      currentAudioRef.current = null;
    }
  }, []);

  // ============================================================
  // 📤 API Pública del Hook
  // ============================================================
  // - speak(text, rate?, pitch?): sintetiza voz con control de velocidad/tono
  // - stop(): detiene cualquier audio en curso y vacía la cola
  return { speak, stop };
};
