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
                // y pasarlo al backend. Por ahora es un MOCK que DEBES REEMPLAZAR.
                const liveData = {
                    time: new Date().toLocaleTimeString(),
                    objectiveStatus: 'Next Dragon in 1:30',
                    kda: '4/2/8',
                    goldAdvantage: 'Enemy +1.5k'
                };
                
                sendMessage('IN_GAME_UPDATE', liveData);
            }, 30000); // Envía un update cada 30 segundos (ritmo táctico)
            return () => clearInterval(interval);
        }
    }, [LCU_STATUS, wsStatus, userData, sendMessage]);

    // Gestión de TTS y Almacenamiento del último consejo
    useEffect(() => {
        if (aiAdvice && JSON.stringify(aiAdvice) !== JSON.stringify(lastAdvice)) {
            const ttsText = aiAdvice.realtimeAdvice;
            speak(ttsText);
            setLastAdvice(aiAdvice);
            setLastAdviceTime(Date.now());
        }
    }, [aiAdvice, speak, lastAdvice]);
    
    const isError = LCU_STATUS !== 'ONLINE' || wsStatus !== 'CONNECTED';
    
    // UI del HUD
    return (
        <div
            className={`transition-all duration-300 fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 max-w-sm p-4 rounded-xl shadow-lol-lg \${isInteractive ? 'bg-lol-blue-medium/95 border-2 border-lol-blue-accent' : 'bg-lol-blue-medium/80 border border-lol-gold-dark'}\`}
            onMouseEnter={() => setInteractive(true)}
            onMouseLeave={() => setInteractive(false)}
        >
            <h3 className="font-display text-xl font-bold text-lol-gold flex items-center mb-2">
                <FaEye className="mr-2 text-lol-blue-accent" /> ASISTENTE TÁCTICO
            </h3>

            {isError ? (
                <div className="p-2 text-center text-red-500">
                    <FaExclamationTriangle className="inline mr-2" /> Desconectado.
                </div>
            ) : (
                <div className="space-y-2">
                    {lastAdvice ? (
                        <div className="p-3 bg-lol-blue-dark rounded border-l-4 border-red-500">
                            <p className="text-lol-gold-light text-sm italic">{lastAdvice.realtimeAdvice}</p>
                            <p className={`text-center font-bold mt-1 text-lg \${lastAdvice.priorityAction === 'RETREAT' ? 'text-red-500' : 'text-lol-blue-accent'}`}>
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
