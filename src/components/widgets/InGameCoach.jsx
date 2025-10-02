import React, { useEffect, useState } from 'react';
import { FaEye, FaVolumeUp, FaSync, FaExclamationTriangle } from 'react-icons/fa';
import { useTTS } from '@/hooks/useTTS';
import { useInteractiveWidget } from '@/hooks/useInteractiveWidget';
import { useWebSocketCoach } from '@/hooks/useWebSocketCoach';
import { useAppState } from '@/context/AppStateContext';

/**
 * Widget de Coaching en Partida (Fase InProgress).
 * Este HUD está activo y escuchando consejos tácticos periódicos del backend.
 */
export default function InGameCoach({ LCU_STATUS }) {
    const { userData } = useAppState();
    
    // Este hook WS pide el evento 'IN_GAME_ADVICE' (que el backend envia cada ~30s)
    const { aiAdvice, wsStatus, sendMessage } = useWebSocketCoach({
        userData,
        targetEvent: 'IN_GAME_ADVICE'
    });
    const { speak } = useTTS();
    const { isInteractive, setInteractive } = useInteractiveWidget(false);
    
    const [lastAdvice, setLastAdvice] = useState(null);
    const [lastAdviceTime, setLastAdviceTime] = useState(Date.now());
    
    // 🚨 Polling de envío de datos de juego a la IA (Lo hará tu LCU Core)
    useEffect(() => {
        if (LCU_STATUS === 'ONLINE' && wsStatus === 'CONNECTED' && userData) {
            const interval = setInterval(() => {
                // 🚨 CRÍTICO: Aquí debes usar TU lol-client-api.js para obtener el estado
                // y pasarlo al backend para que la IA lo analice.
                // Ejemplo: const gameState = await getGameData(); sendMessage({ type: 'inGameUpdate', payload: gameState });
                console.log("Simulando envío de datos de partida al backend...");
            }, 30000); // Cada 30 segundos, como ejemplo

            return () => clearInterval(interval);
        }
    }, [LCU_STATUS, wsStatus, userData, sendMessage]);

    // Actualizar y hablar cuando llega un nuevo consejo
    useEffect(() => {
        if (aiAdvice && aiAdvice.realtimeAdvice) {
            setLastAdvice(aiAdvice);
            setLastAdviceTime(Date.now());
            speak(aiAdvice.realtimeAdvice);
        }
    }, [aiAdvice, speak]);

    return (
        <div 
            className={`w-full max-w-xs p-3 bg-lol-blue-dark/95 rounded-xl shadow-2xl border-2 border-lol-gold-dark transition-all duration-300 font-sans ${isInteractive ? 'pointer-events-auto' : 'pointer-events-none'}`}
            onMouseEnter={() => setInteractive(true)}
            onMouseLeave={() => setInteractive(false)}
        >
            <div className="flex justify-between items-center mb-2">
                <h2 className="text-md font-bold text-lol-gold font-cinzel">Coach en Partida</h2>
                <FaEye className={isInteractive ? 'text-lol-accent' : 'text-lol-gold-light/50'} />
            </div>

            {wsStatus !== 'CONNECTED' ? (
                <div className="text-center p-3 text-red-400">
                    <FaExclamationTriangle className="mx-auto text-2xl mb-1" />
                    <p className="text-sm">WS Desconectado ({wsStatus})</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {lastAdvice ? (
                        <div className="p-3 bg-lol-blue-dark rounded border-l-4 border-red-500">
                            <p className="text-lol-gold-light text-sm italic">{lastAdvice.realtimeAdvice}</p>
                            <p className={`text-center font-bold mt-1 text-lg ${lastAdvice.priorityAction === 'RETREAT' ? 'text-red-500' : 'text-lol-blue-accent'}`}>
                                {lastAdvice.priorityAction} ({new Date(lastAdviceTime).toLocaleTimeString()})
                            </p>
                        </div>
                    ) : (
                        <div className="text-center p-3 text-lol-gold-light">
                            <FaSync className="animate-spin text-lol-gold mx-auto text-2xl mb-1" />
                            <p className="text-sm">Escuchando la Grieta... (Próximo análisis en 30s)</p>
                        </div>
                    )}
                    
                    <button 
                        onClick={() => speak(lastAdvice?.realtimeAdvice || "Esperando consejo táctico.")} 
                        className="w-full py-1 bg-lol-blue-accent hover:bg-lol-blue-medium font-bold rounded text-lol-blue-dark text-sm transition-colors"
                    >
                        <FaVolumeUp className="inline mr-1" /> REPETIR
                    </button>
                </div>
            )}
        </div>
    );
}