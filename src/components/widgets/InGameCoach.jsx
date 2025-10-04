// src/components/widgets/InGameCoach.jsx - VERSIÓN FINAL Y DESBLOQUEADA (Activación Garantizada)
'use client';
import React, { useEffect, useState, useRef } from 'react';
import { FaEye, FaVolumeUp, FaSync, FaExclamationTriangle, FaFistRaised } from 'react-icons/fa';
import { useTTS } from '@/hooks/useTTS';
import { useInteractiveWidget } from '@/hooks/useInteractiveWidget';
import { useWebSocketCoach } from '@/hooks/useWebSocketCoach';

/**
 * Widget de Coaching en Partida (Fase InProgress).
 * Implementa el activador más robusto, basado en el tiempo de juego real.
 */
// 🚨 ACEPTAMOS 'liveData' COMO PROP
export default function InGameCoach({ LCU_STATUS, userData, liveData }) { 
    console.log('[InGameCoach] --- RENDERIZANDO ---');
    console.log('[InGameCoach] Props recibidas -> LCU_STATUS:', LCU_STATUS);
    console.log('[InGameCoach] Props recibidas -> liveData:', liveData);

    // El hook debe exponer sendInGameUpdate
    const { aiAdvice, wsStatus, sendInGameUpdate } = useWebSocketCoach({
        userData,
        targetEvent: 'IN_GAME_ADVICE'
    });
    const { speak } = useTTS();
    const { isInteractive, setInteractive } = useInteractiveWidget(false);
    
    const [lastAdvice, setLastAdvice] = useState(null);
    const [lastAdviceTime, setLastAdviceTime] = useState(Date.now());
    
    // 💎 ACTIVADOR CRÍTICO: Ref para rastrear el último GameTime enviado.
    const lastSentGameTimeRef = useRef(0); 

    console.log('[InGameCoach] Estado actual del WebSocket:', wsStatus);
    
    // 💎 LÓGICA DE ENVÍO DE DATOS EN PARTIDA (Activación Garantizada)
    useEffect(() => {
        const gameData = liveData?.gameData;
        // Usamos solo los segundos para evitar ruido del milisegundo en la comparación
        const gameTime = Math.floor(gameData?.gameTime) || 0; 

        // CRÍTICO: Envía si el WS está conectado y el tiempo de juego ha avanzado.
        // Si el gameTime cambia (lo cual pasa cada 1.5s/3s en el polling), la solicitud es disparada.
        if (wsStatus === 'CONNECTED' && gameData && gameTime > lastSentGameTimeRef.current) {
            
            console.log(`[InGameCoach] 🚀 ACTIVACIÓN GARANTIZADA: Enviando Live Game Update (Tiempo: ${gameTime}s)`);
            
            sendInGameUpdate(liveData); 
            
            // 🚨 CRÍTICO: Actualizamos el Ref al tiempo actual para evitar spam en el mismo segundo.
            lastSentGameTimeRef.current = gameTime; 
        }
    }, [wsStatus, liveData, sendInGameUpdate]); 

    // Actualizar y hablar cuando llega un nuevo consejo desde el WebSocket.
    useEffect(() => {
        // Solo si el consejo es nuevo y no es idéntico al último hablado
        if (aiAdvice?.realtimeAdvice && aiAdvice.realtimeAdvice !== lastAdvice?.realtimeAdvice) {
            console.log('[InGameCoach] ¡Nuevo consejo de IA recibido!', aiAdvice);
            setLastAdvice(aiAdvice);
            setLastAdviceTime(Date.now());
            console.log('[InGameCoach] Texto para hablar:', aiAdvice.realtimeAdvice);
            speak(aiAdvice.realtimeAdvice);
        }
    }, [aiAdvice, speak, lastAdvice]); 

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
                                <FaFistRaised className="inline mr-1" /> {lastAdvice.priorityAction} ({new Date(lastAdviceTime).toLocaleTimeString()})
                            </p>
                        </div>
                    ) : (
                        <div className="text-center p-3 text-lol-gold-light">
                            {/* Mostrar el tiempo de juego si la data en vivo está disponible pero el consejo no ha llegado */}
                            {liveData?.gameData ? (
                                <>
                                    <FaSync className="animate-spin text-lol-gold mx-auto text-2xl mb-1" />
                                    <p className="text-sm">Analizando la jugada... ({Math.floor(liveData.gameData.gameTime / 60)}:{Math.floor(liveData.gameData.gameTime % 60).toString().padStart(2, '0')})</p>
                                </>
                            ) : (
                                <>
                                    <FaSync className="animate-spin text-lol-gold mx-auto text-2xl mb-1" />
                                    <p className="text-sm">Escuchando la Grieta...</p>
                                </>
                            )}
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