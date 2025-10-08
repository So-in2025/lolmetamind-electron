// src/hooks/useTTS.js
// ============================================================
// 🧠 useTTS Hook (v4.7 – SOPORTE DATA-URI SIN DISCO/BLOB)
// ============================================================
// OBJETIVOS v4.7:
// - Reproducción instantánea usando Data URI directo (sin I/O de disco).
// - Eliminación de la lógica compleja de conversión Base64 -> Blob URL.
// - Reutilizar instancias Audio y cachear la Data URI.
// ============================================================

import { useCallback, useEffect, useRef } from 'react';

// ---------------------------
// CONFIG
// ---------------------------
const DEFAULT_CACHE_TTL_MS = 20 * 60 * 1000; // 20 minutos
const CACHE_CLEAN_INTERVAL_MS = 60 * 1000; // limpieza cada minuto
const ELECTRON_TTS_FN = 'coquiTtsSpeak'; // nombre de la API IPC esperada en window.electronAPI

// ---------------------------
// Caches globales (persisten entre instancias del hook)
// ---------------------------
// audioMetaCache: key -> { dataUri?, expiresAt } 🚨 CAMBIO: Ahora guarda dataUri
const audioMetaCache = new Map();
// audioElementCache: key -> { audio: HTMLAudioElement, inUseCount: number }
const audioElementCache = new Map();

function now() { return Date.now(); }

function makeCacheKey(text, rate, pitch) {
  return `${text}||rate:${Number(rate).toFixed(3)}||pitch:${Number(pitch).toFixed(3)}`;
}

// limpieza periódica de cache (GC)
setInterval(() => {
  const t = now();
  for (const [key, meta] of audioMetaCache.entries()) {
    if (meta.expiresAt && meta.expiresAt < t) {
      console.log(`[useTTS][GC] Expiring cache meta key=${key}`);
      // 🚨 IMPORTANTE: Ya no se llama URL.revokeObjectURL porque usamos Data URI directo,
      // no Blob URLs que necesitan ser revocadas.
      audioMetaCache.delete(key);
      
      // también limpiar elemento de audio si existe y no está en uso
      const el = audioElementCache.get(key);
      if (el && el.inUseCount === 0) {
        try {
          el.audio.pause();
          el.audio.src = '';
        } catch (e) {}
        audioElementCache.delete(key);
      }
    }
  }
}, CACHE_CLEAN_INTERVAL_MS).unref?.();

// ---------------------------
// Helpers internos
// ---------------------------
async function generateTtsViaElectron(text, rate, pitch) {
  if (typeof window === 'undefined' || !window.electronAPI || !window.electronAPI[ELECTRON_TTS_FN]) {
    throw new Error(`API TTS no disponible (window.electronAPI.${ELECTRON_TTS_FN})`);
  }

// 🚨 CAMBIO: La API Electron ahora SOLO devuelve dataUri
const clampedRate = Math.min(Math.max(rate || 0.85, 0.7), 1.1);
const clampedPitch = Math.min(Math.max(pitch || 0.95, 0.8), 1.1);

  console.log('[useTTS] Llamando IPC TTS (electronAPI) para obtener Data URI...'); // 🚨 LOG PRO-DEV
  const result = await window.electronAPI[ELECTRON_TTS_FN]({ text, rate: clampedRate, pitch: clampedPitch });
  
  // 🚨 CAMBIO CRÍTICO: Validar que contenga dataUri
  if (!result || !result.dataUri) {
    throw new Error('La API TTS no devolvió un Data URI válido.');
  }
  return result; // result: { dataUri: 'data:audio/wav;base64,....' }
}

function createAudioFromMeta(meta) {
  // 🚨 CAMBIO: Usa directamente el dataUri como src
  const src = meta.dataUri;
  const audio = new Audio(src);
  audio.preload = 'auto';
  return audio;
}

// 🚨 CAMBIO: La función de cache solo guarda el Data URI
function storeMetaInCache(cacheKey, { dataUri = null }, ttl = DEFAULT_CACHE_TTL_MS) {
  const expiresAt = now() + ttl;
  audioMetaCache.set(cacheKey, { dataUri, expiresAt });
  console.log(`[useTTS] Cache meta SET key=${cacheKey} ttl=${ttl}ms (dataUri=${Boolean(dataUri)})`); // 🚨 LOG PRO-DEV
}

function getMetaFromCache(cacheKey) {
  const meta = audioMetaCache.get(cacheKey);
  if (!meta) return null;
  if (meta.expiresAt && meta.expiresAt < now()) {
    // expired
    audioMetaCache.delete(cacheKey);
    return null;
  }
  return meta;
}

function getAudioElement(cacheKey) {
  const entry = audioElementCache.get(cacheKey);
  if (!entry) return null;
  return entry.audio;
}

function setAudioElement(cacheKey, audio) {
  audioElementCache.set(cacheKey, { audio, inUseCount: 0 });
}

function incAudioInUse(cacheKey) {
  const entry = audioElementCache.get(cacheKey);
  if (!entry) return;
  entry.inUseCount += 1;
}

function decAudioInUse(cacheKey) {
  const entry = audioElementCache.get(cacheKey);
  if (!entry) return;
  entry.inUseCount = Math.max(0, entry.inUseCount - 1);
}

// ---------------------------
// Hook principal
// ---------------------------
export const useTTS = ({ defaultTTL = DEFAULT_CACHE_TTL_MS } = {}) => {
  // referencias internas que persisten entre renders
  const currentAudioRef = useRef(null); // instancia Audio activa
  const isPlayingRef = useRef(false);
  const lastCacheKeyRef = useRef(null);

  // cleanup on unmount: detener audio activo
  useEffect(() => {
    return () => {
      try {
        if (currentAudioRef.current) {
          currentAudioRef.current.pause();
          currentAudioRef.current.src = '';
          currentAudioRef.current = null;
        }
      } catch (e) {}
    };
  }, []);

  // ---------------------------
  // stop(): detiene reproducción actual
  // ---------------------------
  const stop = useCallback(() => {
    console.log('[useTTS] ⏹ stop() llamado'); // 🚨 LOG PRO-DEV
    if (currentAudioRef.current) {
      try {
        currentAudioRef.current.pause();
      } catch (e) { /* ignore */ }
      currentAudioRef.current = null;
    }
    isPlayingRef.current = false;
  }, []);

  // pause / resume (utils)
  const pause = useCallback(() => {
    if (currentAudioRef.current) {
      try { currentAudioRef.current.pause(); console.log('[useTTS] pausa audio'); } catch (e) {} // 🚨 LOG PRO-DEV
      isPlayingRef.current = false;
    }
  }, []);

  const resume = useCallback(async () => {
    if (currentAudioRef.current) {
      try {
        await currentAudioRef.current.play();
        isPlayingRef.current = true;
        console.log('[useTTS] resume audio'); // 🚨 LOG PRO-DEV
      } catch (e) {
        console.warn('[useTTS] resume fallo play():', e.message); // 🚨 LOG PRO-DEV
      }
    }
  }, []);

  // ---------------------------
  // preload(): forzar generación y preload del audio en cache
  // ---------------------------
  const preload = useCallback(async (text, rate = 1.0, pitch = 1.0, { ttl = defaultTTL } = {}) => {
    if (!text || typeof text !== 'string') {
      console.warn('[useTTS] preload() texto inválido', text); // 🚨 LOG PRO-DEV
      return null;
    }
    const cacheKey = makeCacheKey(text.trim(), rate, pitch);
    const existing = getMetaFromCache(cacheKey);
    if (existing) {
      console.log('[useTTS] preload -> ya en cache meta, devolviendo meta existente'); // 🚨 LOG PRO-DEV
      // si no hay audio element aún, crearlo en background
      if (!getAudioElement(cacheKey)) {
        try {
          const audio = createAudioFromMeta(existing);
          audio.load();
          setAudioElement(cacheKey, audio);
          console.log('[useTTS] preload -> audio element creado desde meta existente'); // 🚨 LOG PRO-DEV
        } catch (e) {
          console.warn('[useTTS] preload -> fallo al crear audio element desde meta existente', e.message); // 🚨 LOG PRO-DEV
        }
      }
      return existing;
    }

    // No está en cache -> generar vía electronAPI
    try {
      console.log('[useTTS] preload -> Cache miss. Llamando Electron para generar Data URI...'); // 🚨 LOG PRO-DEV
      const result = await generateTtsViaElectron(text, rate, pitch);

      // 🚨 CAMBIO: Se almacena directamente el dataUri
      const dataUri = result.dataUri;
      
      // almacenar meta + crear audio element preloaded
      storeMetaInCache(cacheKey, { dataUri }, ttl);
      
      try {
        const meta = getMetaFromCache(cacheKey);
        const audio = createAudioFromMeta(meta);
        audio.load();
        setAudioElement(cacheKey, audio);
        console.log('[useTTS] preload -> audio element preloaded y almacenado en cache element'); // 🚨 LOG PRO-DEV
      } catch (e) {
        console.warn('[useTTS] preload -> fallo al crear/preload audio element', e.message); // 🚨 LOG PRO-DEV
      }

      return getMetaFromCache(cacheKey);
    } catch (err) {
      console.error('[useTTS] preload -> Error al generar audio:', err.message); // 🚨 LOG PRO-DEV
      throw err;
    }
  }, [defaultTTL]);

  // ---------------------------
  // internal helper: ensure audio element exists for cacheKey
  // ---------------------------
  async function ensureAudioElement(cacheKey) {
    let el = getAudioElement(cacheKey);
    if (el) return el;

    const meta = getMetaFromCache(cacheKey);
    if (!meta) return null;

    try {
      const audio = createAudioFromMeta(meta);
      // establecer handlers mínimos
      audio.preload = 'auto';
      audio.load();
      setAudioElement(cacheKey, audio);
      console.log('[useTTS] ensureAudioElement -> creado nuevo elemento audio para cacheKey'); // 🚨 LOG PRO-DEV
      return audio;
    } catch (e) {
      console.warn('[useTTS] ensureAudioElement -> fallo crear audio element:', e.message); // 🚨 LOG PRO-DEV
      return null;
    }
  }

  // ---------------------------
  // speak(): principal
  // ---------------------------
  const speak = useCallback(async (text, rate = 1.0, pitch = 1.0, { ttl = defaultTTL } = {}) => {
    if (!text || typeof text !== 'string') {
      console.warn('[useTTS] speak() texto inválido', text); // 🚨 LOG PRO-DEV
      return;
    }

    const trimmed = text.trim();
    const cacheKey = makeCacheKey(trimmed, rate, pitch);
    lastCacheKeyRef.current = cacheKey;

    // stop any current playback to avoid solapamientos
    stop();

    try {
      // 1) intentar meta cache
      let meta = getMetaFromCache(cacheKey);
      if (!meta) {
        // 2) no está en cache -> generar
        console.log('[useTTS] speak -> Cache MISS. Generando Data URI via Electron...'); // 🚨 LOG PRO-DEV
        const result = await generateTtsViaElectron(trimmed, rate, pitch);

        // 🚨 CAMBIO: Almacenar Data URI
        const dataUri = result.dataUri;

        storeMetaInCache(cacheKey, { dataUri }, ttl);
        meta = getMetaFromCache(cacheKey);
      } else {
        console.log('[useTTS] speak -> Cache HIT meta'); // 🚨 LOG PRO-DEV
      }

      // 3) asegurar audio element
      let audio = await ensureAudioElement(cacheKey);
      if (!audio) {
        // fallback crear de meta manualmente
        console.warn('[useTTS] speak -> No pudo crearse elemento audio, intentando crear directamente...'); // 🚨 LOG PRO-DEV
        const metaNow = getMetaFromCache(cacheKey);
        if (!metaNow) throw new Error('Meta ausente después de generar audio');
        audio = createAudioFromMeta(metaNow);
        setAudioElement(cacheKey, audio);
      }

      // 4) reproducir (reutilizando instancia)
      incAudioInUse(cacheKey);
      currentAudioRef.current = audio;
      isPlayingRef.current = true;

      console.log(`[useTTS] ▶ Reproduciendo audio (cacheKey=${cacheKey})...`); // 🚨 LOG PRO-DEV
      await new Promise((resolve, reject) => {
        let settled = false;
        const cleanup = () => {
          audio.onended = null;
          audio.onerror = null;
        };

        audio.onended = () => {
          if (settled) return;
          settled = true;
          cleanup();
          resolve();
        };

        audio.onerror = (e) => {
          if (settled) return;
          settled = true;
          cleanup();
          reject(new Error(`Audio playback error: ${e.message}`));
        };

        // Some environments require load() before play if element was reused.
        try { audio.load(); } catch (e) { /* ignore */ }

        audio.play().catch((err) => {
          // autoplay policy or other error
          if (settled) return;
          settled = true;
          cleanup();
          reject(err);
        });
      });

      console.log('[useTTS] ✅ Reproducción finalizada.'); // 🚨 LOG PRO-DEV
      isPlayingRef.current = false;
      currentAudioRef.current = null;
      decAudioInUse(cacheKey);
    } catch (err) {
      console.error('[useTTS] ❌ Error en speak():', err.message || err); // 🚨 LOG PRO-DEV
      isPlayingRef.current = false;
      currentAudioRef.current = null;
    }
  }, [stop, defaultTTL]);

  // ---------------------------
  // clearCache(): limpia todo (meta + audio elements)
  // ---------------------------
  const clearCache = useCallback(() => {
    console.log('[useTTS] clearCache() llamado. Liberando todos los elementos de audio.'); // 🚨 LOG PRO-DEV
    // 🚨 CAMBIO: Se eliminó la revocación de Blob URL porque ya no se usan.
    audioMetaCache.clear();

    for (const [key, entry] of audioElementCache.entries()) {
      try {
        entry.audio.pause();
        entry.audio.src = '';
      } catch (e) {}
    }
    audioElementCache.clear();
    currentAudioRef.current = null;
    isPlayingRef.current = false;
  }, []);

  // ---------------------------
  // Exponer API pública
  // ---------------------------
  return {
    speak,
    stop,
    pause,
    resume,
    preload,
    clearCache,
    // Métodos utilitarios PRO-DEV:
    _debug: {
      audioMetaCacheSize: () => audioMetaCache.size,
      audioElementCacheSize: () => audioElementCache.size,
      getMeta: (key) => audioMetaCache.get(key),
    }
  };
};