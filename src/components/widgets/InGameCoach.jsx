// src/components/widgets/InGameCoach.jsx
"use client";

import React, { useState, useCallback } from 'react';

const LoadingSpinner = () => (
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-lol-accent-gold"></div>
);

export default function InGameCoach({ liveClientDataStatus, isInteractive }) {
    const [lastAdvice, setLastAdvice] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [cooldown, setCooldown] = useState(0);

    const handleUltimateCoachRequest = useCallback(async () => {
        if (isLoading || cooldown > 0 || !window.electronAPI) return;
        setIsLoading(true);
        setError('');

        console.log('[InGame Coach] ¡"R Definitiva" activada!');
        try {
            // SIMULACIÓN DE LA FASE 2 (Captura + Nano Banana)
            await new Promise(resolve => setTimeout(resolve, 2000));
            const simulatedAnalysis = {
                advice: "El jungla enemigo fue visto en bot. Tienes prioridad en top para presionar o asegurar el Heraldo.",
                nextAction: "Busca un trade favorable o coordina con tu jungla."
            };
            
            if (simulatedAnalysis.error) throw new Error(simulatedAnalysis.error);
            setLastAdvice(`Consejo: ${simulatedAnalysis.advice} | Próxima Acción: ${simulatedAnalysis.nextAction}`);
            
            setCooldown(120); // 2 minutos de cooldown
            const interval = setInterval(() => {
                setCooldown(prev => {
                    if (prev <= 1) {
                        clearInterval(interval);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);

        } catch (err) {
            setError('La IA no pudo generar un consejo.');
            setCooldown(30); // 30s de cooldown en caso de error
             const interval = setInterval(() => {
                setCooldown(prev => {
                    if (prev <= 1) {
                        clearInterval(interval);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        } finally {
            setIsLoading(false);
        }
    }, [isLoading, cooldown]);

    if (liveClientDataStatus?.status === 'NotAvailable') {
        return (
             <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] bg-red-900/80 backdrop-blur-md border-2 border-red-500/50 rounded-lg shadow-2xl text-white p-4 text-center user-select-none">
                <h3 className="font-bold text-lg mb-2">Error de Datos en Tiempo Real</h3>
                <p className="text-sm">{liveClientDataStatus.reason}</p>
                <p className="text-xs mt-2 text-gray-300">El coaching durante la partida está deshabilitado. El coaching de Selección de Campeón seguirá funcionando.</p>
            </div>
        );
    }
    
    return (
        <div className="fixed bottom-4 right-4 flex flex-col items-end gap-2 user-select-none">
            {lastAdvice && !isLoading && (
                <div className="w-[350px] bg-black/80 p-3 rounded-lg border border-lol-gold/30 text-sm animate-fade-in">
                    <p className="text-lol-highlight font-bold">Impulso de MetaMind:</p>
                    <p className="text-lol-light">{lastAdvice}</p>
                </div>
            )}
            <button 
                onClick={handleUltimateCoachRequest}
                disabled={!isInteractive || isLoading || cooldown > 0}
                className="w-20 h-20 rounded-full bg-lol-dark-blue border-4 border-lol-accent-gold flex justify-center items-center text-lol-gold font-black text-3xl shadow-lg transition-all duration-300 hover:border-lol-highlight hover:text-lol-highlight disabled:opacity-50 disabled:cursor-not-allowed disabled:border-gray-500 disabled:text-gray-500"
                title={isInteractive ? "Activar Impulso de IA (R)" : "Activa la interacción (Alt+O) para usar"}
            >
                {isLoading ? <LoadingSpinner /> : cooldown > 0 ? cooldown : 'R'}
            </button>
        </div>
    );
}