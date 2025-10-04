// preload.js - VERSIÓN FINAL CON TTS AVANZADO
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // --- Funciones de usuario ---
    notifyLoginSuccess: (userData) => ipcRenderer.send('user-logged-in', userData),
    closeApp: () => ipcRenderer.send('close-app'),

    // --- Overlay y LCU ---
    setIgnoreMouseEvents: (ignore, forward) => ipcRenderer.send('set-ignore-mouse-events', ignore, forward),
    onLcuStateUpdate: (callback) => {
        ipcRenderer.removeAllListeners('lcu-state-update'); 
        ipcRenderer.on('lcu-state-update', (event, value) => callback(value));
    },

    getUserData: () => ipcRenderer.invoke('get-user-data'),
    lcuCommand: (method, endpoint, payload) => ipcRenderer.invoke('lcu-command', method, endpoint, payload),
    getMetaAnalysis: (payload) => ipcRenderer.invoke('get-meta-analysis', payload),
    getRecommendations: (payload) => ipcRenderer.invoke('get-recommendations', payload),
    getWeeklyChallenges: (payload) => ipcRenderer.invoke('get-weekly-challenges', payload),
    analyzeMatches: (payload) => ipcRenderer.invoke('analyze-matches', payload),
    getStrategicAdvice: (payload) => ipcRenderer.invoke('get-strategic-advice', payload),
    getLiveCoaching: (payload) => ipcRenderer.invoke('get-live-coaching', payload),

    // --- 🚀 TTS AVANZADO ---
    ttsSpeak: async (text, voice = 'alloy', rate = 1.0) => {
        if (!text) {
            console.warn('[preload TTS] Texto vacío, no se reproducirá nada.');
            return;
        }

        console.log('[preload TTS] Reproduciendo texto:', text);

        // --- 1️⃣ Intento principal: Google Cloud TTS ---
        try {
            console.log('[preload TTS] Intentando Google Cloud TTS...');
            const result = await ipcRenderer.invoke('google-tts', { text, voice, rate });
            if (result?.audioContent) {
                const audio = new Audio(`data:audio/mp3;base64,${result.audioContent}`);
                audio.play();
                console.log('[preload TTS] Google Cloud TTS reproducido ✅');
                return;
            } else {
                throw new Error('Respuesta vacía de Google TTS');
            }
        } catch (error) {
            console.error('[preload TTS] Falló Google Cloud TTS, pasando a fallback 1', error);
        }

        // --- 2️⃣ Fallback: Voces de Google Chrome ---
        if (typeof window !== 'undefined' && window.speechSynthesis) {
            try {
                console.log('[preload TTS] Intentando voces de Google Chrome...');
                const voices = window.speechSynthesis.getVoices();
                const googleVoice = voices.find(v => v.name.includes('Google')) || voices[0];

                if (!googleVoice) throw new Error('No se encontró voz de Google Chrome');

                const utterance = new SpeechSynthesisUtterance(text);
                utterance.voice = googleVoice;
                utterance.rate = rate;
                utterance.onstart = () => console.log('[preload TTS] Chrome Google Voice iniciado');
                utterance.onend = () => console.log('[preload TTS] Chrome Google Voice terminado');
                utterance.onerror = (err) => console.error('[preload TTS] Error Chrome Google Voice:', err);

                window.speechSynthesis.cancel();
                window.speechSynthesis.speak(utterance);
                return;
            } catch (error) {
                console.error('[preload TTS] Falló voz de Google Chrome, pasando a fallback 2', error);
            }
        }

        // --- 3️⃣ Fallback final: Voces Microsoft ---
        if (typeof window !== 'undefined' && window.speechSynthesis) {
            try {
                console.log('[preload TTS] Intentando voces Microsoft...');
                const voices = window.speechSynthesis.getVoices();
                const msVoice = voices.find(v => v.name.includes('Microsoft')) || voices[0];

                if (!msVoice) throw new Error('No se encontró voz Microsoft');

                const utterance = new SpeechSynthesisUtterance(text);
                utterance.voice = msVoice;
                utterance.rate = rate;
                utterance.onstart = () => console.log('[preload TTS] Microsoft Voice iniciado');
                utterance.onend = () => console.log('[preload TTS] Microsoft Voice terminado');
                utterance.onerror = (err) => console.error('[preload TTS] Error Microsoft Voice:', err);

                window.speechSynthesis.cancel();
                window.speechSynthesis.speak(utterance);
                return;
            } catch (error) {
                console.error('[preload TTS] Falló voz de Microsoft, TTS cancelado', error);
            }
        }

        console.warn('[preload TTS] Ningún TTS disponible, no se reproducirá nada');
    },

    ttsStop: () => {
        if (typeof window !== 'undefined' && window.speechSynthesis) {
            console.log('[preload TTS] Deteniendo cualquier TTS en curso...');
            window.speechSynthesis.cancel();
        }
    }
});
