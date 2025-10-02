// src/components/widgets/InGameCoach.jsx - VERSIÓN CORREGIDA
import React, { useEffect, useState } from 'react';
import { FaEye, FaVolumeUp, FaSync, FaExclamationTriangle } from 'react-icons/fa';
import { useTTS } from '@/hooks/useTTS';
import { useInteractiveWidget } from '@/hooks/useInteractiveWidget';
import { useWebSocketCoach } from '@/hooks/useWebSocketCoach';
// 🚨 'useAppState' ya no es necesario aquí.
// import { useAppState } from '@/context/AppStateContext';

/**
 * Widget de Coaching en Partida (Fase InProgress).
 */
// 🚨 1. ACEPTAMOS 'userData' COMO PROP
export default function InGameCoach({ LCU_STATUS, userData }) {
    console.log('[InGameCoach] --- RENDERIZANDO ---');
    console.log('[InGameCoach] Props recibidas -> LCU_STATUS:', LCU_STATUS);
    console.log('[InGameCoach] Props recibidas -> userData:', userData);

    // 🚨 2. ELIMINAMOS LA LLAMADA A 'useAppState'
    // const { userData } = useAppState();
    
    // El hook 'useWebSocketCoach' ahora recibe el 'userData' de las props.
    const { aiAdvice, wsStatus } = useWebSocketCoach({
        userData,
        targetEvent: 'IN_GAME_ADVICE'
    });
    const { speak } = useTTS();
    const { isInteractive, setInteractive } = useInteractiveWidget(false);
    
    const [lastAdvice, setLastAdvice] = useState(null);
    const [lastAdviceTime, setLastAdviceTime] = useState(Date.now());

    console.log('[InGameCoach] Estado actual del WebSocket:', wsStatus);
    
    // 🚨 NOTA IMPORTANTE: Este useEffect es un placeholder.
    // La lógica real de envío de datos en partida ya está en tu 'lol-client-api.js'.
    // Este bloque de React no necesita hacer nada, ya que el backend de Electron
    // es el que proactivamente envía los datos a tu servidor de IA en cada ciclo de sondeo.
    // Podemos eliminar la simulación.
    useEffect(() => {
        console.log('[InGameCoach] Este widget está en modo de escucha pasiva. El sondeo lo realiza el Core de Electron.');
    }, []);

    // Actualizar y hablar cuando llega un nuevo consejo desde el WebSocket.
    useEffect(() => {
        console.log('[InGameCoach] useEffect [aiAdvice] -> Verificando si hay nuevo consejo de la IA.');
        // Añadimos una comprobación para no repetir el mismo consejo hablado
        if (aiAdvice?.realtimeAdvice && aiAdvice.realtimeAdvice !== lastAdvice?.realtimeAdvice) {
            console.log('[InGameCoach] ¡Nuevo consejo de IA recibido!', aiAdvice);
            setLastAdvice(aiAdvice);
            setLastAdviceTime(Date.now());
            console.log('[InGameCoach] Texto para hablar:', aiAdvice.realtimeAdvice);
            speak(aiAdvice.realtimeAdvice);
        } else {
             // El consejo es el mismo que el anterior o es nulo.
        }
    }, [aiAdvice, speak, lastAdvice]); // Añadimos lastAdvice a las dependencias

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
                            <p className="text-lol-gold-light text-sm italic">"{lastAdvice.realtimeAdvice}"</p>
                            <p className={`text-center font-bold mt-1 text-lg ${lastAdvice.priorityAction === 'RETREAT' ? 'text-red-500' : 'text-lol-blue-accent'}`}>
                                {lastAdvice.priorityAction} ({new Date(lastAdviceTime).toLocaleTimeString()})
                            </p>
                        </div>
                    ) : (
                        <div className="text-center p-3 text-lol-gold-light">
                            <FaSync className="animate-spin text-lol-gold mx-auto text-2xl mb-1" />
                            <p className="text-sm">Escuchando la Grieta...</p>
                        </div>
                    )}
                    
                    <button 
                        onClick={() => {
                            const text = lastAdvice?.realtimeAdvice || "Esperando consejo táctico.";
                            speak(text);
                        }} 
                        className="w-full py-1 bg-lol-blue-accent hover:bg-lol-blue-medium font-bold rounded text-lol-blue-dark text-sm transition-colors"
                    >
                        <FaVolumeUp className="inline mr-1" /> REPETIR
                    </button>
                </div>
            )}
        </div>
    );
}