// src/hooks/useTTS.js
// ============================================================
// 🧠 useTTS Hook (v4.6 – Preload, Reuse de Audio, Cache en memoria, soporte Base64)
// ============================================================
// OBJETIVOS v4.6:
// - Reproducción instantánea siempre que el audio esté en cache/preloaded.
// - Reutilizar instancias Audio para evitar recargas de disco/IO.
// - Soportar respuesta del backend tanto filePath (ruta) como audioBase64 (buffer).
// - Exponer API: speak(), stop(), pause(), resume(), preload(), clearCache().
// - TTL simple para cache y limpieza periódica.
// - Logs PRO-DEV para trazabilidad y debugging.
// ============================================================

import { useCallback, useEffect, useRef } from 'react';

// ---------------------------
// CONFIG
// ---------------------------
const DEFAULT_CACHE_TTL_MS = 20 * 60 * 1000; // 10 minutos
const CACHE_CLEAN_INTERVAL_MS = 60 * 1000; // limpieza cada minuto
const ELECTRON_TTS_FN = 'coquiTtsSpeak'; // nombre de la API IPC esperada en window.electronAPI

// ---------------------------
// Caches globales (persisten entre instancias del hook)
// ---------------------------
// audioMetaCache: key -> { filePath?, blobUrl?, expiresAt }
// audioElementCache: key -> { audio: HTMLAudioElement, inUseCount: number }
const audioMetaCache = new Map();
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
      // liberar blobUrl si existe
      if (meta.blobUrl) {
        try { URL.revokeObjectURL(meta.blobUrl); } catch (e) { /* ignore */ }
      }
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

  // coquiTtsSpeak puede devolver { filePath } o { audioBase64 } (optativo)
const clampedRate = Math.min(Math.max(rate || 0.85, 0.7), 1.1);
const clampedPitch = Math.min(Math.max(pitch || 0.95, 0.8), 1.1);

  console.log('[useTTS] Llamando IPC TTS (electronAPI)...');
  const result = await window.electronAPI[ELECTRON_TTS_FN](text, clampedRate, clampedPitch);
  if (!result || (!result.filePath && !result.audioBase64)) {
    throw new Error('La API TTS no devolvió filePath ni audioBase64');
  }
  return result;
}

function createAudioFromMeta(meta) {
  // meta: { filePath?, blobUrl? }
  const src = meta.blobUrl || meta.filePath;
  const audio = new Audio(src);
  audio.preload = 'auto';
  return audio;
}

function storeMetaInCache(cacheKey, { filePath = null, blobUrl = null }, ttl = DEFAULT_CACHE_TTL_MS) {
  const expiresAt = now() + ttl;
  audioMetaCache.set(cacheKey, { filePath, blobUrl, expiresAt });
  console.log(`[useTTS] Cache meta SET key=${cacheKey} ttl=${ttl}ms (filePath=${Boolean(filePath)}, blob=${Boolean(blobUrl)})`);
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
  // stop(): detiene reproducción actual pero NO elimina cache meta (para permitir repeats rápidos)
  // ---------------------------
  const stop = useCallback(() => {
    console.log('[useTTS] ⏹ stop() llamado');
    if (currentAudioRef.current) {
      try {
        currentAudioRef.current.pause();
      } catch (e) { /* ignore */ }
      // No limpiar src aquí si queremos permitir replay instantáneo del mismo audio.
      // Pero liberamos la referencia activa para evitar solapamientos.
      currentAudioRef.current = null;
    }
    isPlayingRef.current = false;
  }, []);

  // pause / resume (utils)
  const pause = useCallback(() => {
    if (currentAudioRef.current) {
      try { currentAudioRef.current.pause(); console.log('[useTTS] pausa audio'); } catch (e) {}
      isPlayingRef.current = false;
    }
  }, []);

  const resume = useCallback(async () => {
    if (currentAudioRef.current) {
      try {
        await currentAudioRef.current.play();
        isPlayingRef.current = true;
        console.log('[useTTS] resume audio');
      } catch (e) {
        console.warn('[useTTS] resume fallo play():', e.message);
      }
    }
  }, []);

  // ---------------------------
  // preload(): forzar generación y preload del audio en cache
  // - útil para precaching proactivo en lobby/matchmaking
  // ---------------------------
  const preload = useCallback(async (text, rate = 1.0, pitch = 1.0, { ttl = defaultTTL } = {}) => {
    if (!text || typeof text !== 'string') {
      console.warn('[useTTS] preload() texto inválido', text);
      return null;
    }
    const cacheKey = makeCacheKey(text.trim(), rate, pitch);
    const existing = getMetaFromCache(cacheKey);
    if (existing) {
      console.log('[useTTS] preload -> ya en cache meta, devolviendo meta existente');
      // si no hay audio element aún, crearlo en background
      if (!getAudioElement(cacheKey)) {
        try {
          const audio = createAudioFromMeta(existing);
          audio.load();
          setAudioElement(cacheKey, audio);
          console.log('[useTTS] preload -> audio element creado desde meta existente');
        } catch (e) {
          console.warn('[useTTS] preload -> fallo al crear audio element desde meta existente', e.message);
        }
      }
      return existing;
    }

    // No está en cache -> generar vía electronAPI
    try {
      console.log('[useTTS] preload -> Cache miss. Llamando backend para generar audio...');
      const result = await generateTtsViaElectron(text, rate, pitch);

      let blobUrl = null;
      let filePath = null;
      if (result.audioBase64) {
        // Crear Blob y URL
        const byteCharacters = atob(result.audioBase64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'audio/wav' });
        blobUrl = URL.createObjectURL(blob);
        filePath = null;
        console.log('[useTTS] preload -> recibido audio Base64 y creado blobUrl');
      } else if (result.filePath) {
        filePath = result.filePath;
        console.log('[useTTS] preload -> recibido filePath desde backend:', filePath);
      }

      // almacenar meta + crear audio element preloaded
      storeMetaInCache(cacheKey, { filePath, blobUrl }, ttl);
      try {
        const meta = getMetaFromCache(cacheKey);
        const audio = createAudioFromMeta(meta);
        audio.load();
        // intentar tocar un poco para precache buffer (puede fallar por políticas autoplay; en Electron normalmente ok)
        setAudioElement(cacheKey, audio);
        console.log('[useTTS] preload -> audio element preloaded y almacenado en cache element');
      } catch (e) {
        console.warn('[useTTS] preload -> fallo al crear/preload audio element', e.message);
      }

      return getMetaFromCache(cacheKey);
    } catch (err) {
      console.error('[useTTS] preload -> Error al generar audio:', err.message);
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
      // no tocar play aqui, solo cargar
      audio.load();
      setAudioElement(cacheKey, audio);
      console.log('[useTTS] ensureAudioElement -> creado nuevo elemento audio para cacheKey');
      return audio;
    } catch (e) {
      console.warn('[useTTS] ensureAudioElement -> fallo crear audio element:', e.message);
      return null;
    }
  }

  // ---------------------------
  // speak(): principal (reutiliza cache/meta cuando esté disponible)
  // - detiene cualquier audio activo (no solapamiento)
  // - si audio en cache -> reuse y play inmediatamente
  // - si no -> genera, guarda en cache, crea elemento y reproduce
  // ---------------------------
  const speak = useCallback(async (text, rate = 1.0, pitch = 1.0, { ttl = defaultTTL } = {}) => {
    if (!text || typeof text !== 'string') {
      console.warn('[useTTS] speak() texto inválido', text);
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
        // 2) no está en cache -> generar (sin bloquear hilo principal si quieres precache en background)
        console.log('[useTTS] speak -> Cache MISS. Generando audio via backend...');
        const result = await generateTtsViaElectron(trimmed, rate, pitch);

        let blobUrl = null;
        let filePath = null;
        if (result.audioBase64) {
          const byteCharacters = atob(result.audioBase64);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: 'audio/wav' });
          blobUrl = URL.createObjectURL(blob);
          console.log('[useTTS] speak -> recibido audioBase64 y creado blobUrl');
        } else if (result.filePath) {
          filePath = result.filePath;
          console.log('[useTTS] speak -> recibido filePath:', filePath);
        }

        storeMetaInCache(cacheKey, { filePath, blobUrl }, ttl);
        meta = getMetaFromCache(cacheKey);
      } else {
        console.log('[useTTS] speak -> Cache HIT meta');
      }

      // 3) asegurar audio element
      let audio = await ensureAudioElement(cacheKey);
      if (!audio) {
        // fallback crear de meta manualmente
        console.warn('[useTTS] speak -> No pudo crearse elemento audio desde meta, intentando crear directamente...');
        const metaNow = getMetaFromCache(cacheKey);
        if (!metaNow) throw new Error('Meta ausente después de generar audio');
        audio = createAudioFromMeta(metaNow);
        setAudioElement(cacheKey, audio);
      }

      // 4) reproducir (reutilizando instancia)
      incAudioInUse(cacheKey);
      currentAudioRef.current = audio;
      isPlayingRef.current = true;

      console.log(`[useTTS] ▶ Reproduciendo audio (cacheKey=${cacheKey})...`);
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
          reject(new Error('Audio playback error'));
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

      console.log('[useTTS] ✅ Reproducción finalizada.');
      isPlayingRef.current = false;
      currentAudioRef.current = null;
      decAudioInUse(cacheKey);
    } catch (err) {
      console.error('[useTTS] ❌ Error en speak():', err.message || err);
      isPlayingRef.current = false;
      currentAudioRef.current = null;
    }
  }, [stop, defaultTTL]);

  // ---------------------------
  // clearCache(): limpia todo (meta + audio elements)
  // ---------------------------
  const clearCache = useCallback(() => {
    console.log('[useTTS] clearCache() llamado. Liberando todos los blobs y elementos de audio.');
    for (const [key, meta] of audioMetaCache.entries()) {
      if (meta.blobUrl) {
        try { URL.revokeObjectURL(meta.blobUrl); } catch (e) {}
      }
    }
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
