// src/components/widgets/InGameCoach.jsx
"use client";

import React, { useState, useCallback } from 'react';
import { useAppState } from '@/context/AppStateContext';

// Función TTS (Text-to-Speech) para que funcione al hacer clic
const speak = (text) => {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window && text) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'es-ES';
    utterance.rate = 1.2;
    utterance.pitch = 1.1;
    window.speechSynthesis.speak(utterance);
    console.log(`[TTS] Hablando: "${text}"`);
  } else {
    console.warn("[TTS] SpeechSynthesis API no disponible.");
  }
};

const LoadingSpinner = () => (
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-400"></div>
);

export default function InGameCoach({ liveData, isInteractive }) {
    const { userData } = useAppState(); // Obtenemos userData para el ZodiacSign
    const [lastAdvice, setLastAdvice] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [cooldown, setCooldown] = useState(0);

    const handleUltimateCoachRequest = useCallback(async () => {
        if (isLoading || cooldown > 0 || !window.electronAPI || !liveData || !userData) {
             console.warn("[InGame Coach] No se puede solicitar consejo: en cooldown, cargando, o faltan datos.");
             return;
        }
        
        // ACTIVACIÓN DE TTS CON LA PRIMERA INTERACCIÓN
        speak("Solicitando análisis a MetaMind.");

        setIsLoading(true);
        setError('');

        try {
            console.log('[InGame Coach] ¡"R Definitiva" activada! Enviando datos a la IA...');
            
            // LLAMADA REAL A LA IA A TRAVÉS DE ELECTRON
            const analysis = await window.electronAPI.invoke('get-live-coaching', {
                liveData: liveData,
                userData: userData,
            });
            
            if (analysis.error) throw new Error(analysis.error);
            
            // Suponemos que la IA devuelve { realtimeAdvice, priorityAction }
            const adviceText = `Consejo: ${analysis.realtimeAdvice}. Acción prioritaria: ${analysis.priorityAction}`;
            setLastAdvice(adviceText);
            
            // Hablamos el consejo recibido de la IA
            speak(analysis.realtimeAdvice);
            
            // Iniciar cooldown de éxito
            setCooldown(120); 
            const intervalId = setInterval(() => {
                setCooldown(prev => {
                    if (prev <= 1) {
                        clearInterval(intervalId);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);

        } catch (err) {
            console.error("[InGame Coach] Error al obtener consejo de la IA:", err);
            setError('La IA no pudo generar un consejo.');
            speak("Error al contactar la inteligencia artificial.");
            
            // Iniciar cooldown de error
            setCooldown(30); 
             const intervalId = setInterval(() => {
                setCooldown(prev => {
                    if (prev <= 1) {
                        clearInterval(intervalId);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        } finally {
            setIsLoading(false);
        }
    }, [isLoading, cooldown, liveData, userData]);

    if (liveData?.status === 'NotAvailable') {
        return (
             <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] bg-red-900/80 backdrop-blur-md border-2 border-red-500/50 rounded-lg shadow-2xl text-white p-4 text-center user-select-none">
                <h3 className="font-bold text-lg mb-2">Error de Datos en Tiempo Real</h3>
                <p className="text-sm">{liveData.reason}</p>
                <p className="text-xs mt-2 text-gray-300">El coaching de partida está deshabilitado.</p>
            </div>
        );
    }
    
    return (
        <div className="fixed bottom-4 right-4 flex flex-col items-end gap-2 user-select-none">
            {lastAdvice && !isLoading && (
                <div className="w-[350px] bg-black/80 p-3 rounded-lg border border-yellow-400/30 text-sm animate-fade-in text-white">
                    <p className="font-bold text-yellow-300">Impulso de MetaMind:</p>
                    <p>{lastAdvice}</p>
                </div>
            )}
            
            {error && <p className="text-red-400 text-sm bg-black/50 p-2 rounded">{error}</p>}
            
            <button 
                onClick={handleUltimateCoachRequest}
                disabled={!isInteractive || isLoading || cooldown > 0}
                className="w-20 h-20 rounded-full bg-gray-900 border-4 border-yellow-500 flex justify-center items-center text-yellow-400 font-black text-3xl shadow-lg transition-all duration-300 hover:border-yellow-300 hover:text-yellow-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:border-gray-600 disabled:text-gray-600"
                title={isInteractive ? "Activar Impulso de IA (R)" : "Activa la interacción (Alt+O) para usar"}
            >
                {isLoading ? <LoadingSpinner /> : cooldown > 0 ? cooldown : 'R'}
            </button>
        </div>
    );
}