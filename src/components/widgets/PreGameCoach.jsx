// src/components/widgets/PreGameCoach.jsx - VERSIÓN CORREGIDA FINAL ASTRO-TÉCNICA
'use client';
import React, { useEffect, useState } from 'react';
import { FaSync, FaBrain, FaMicrophoneAlt } from 'react-icons/fa';
import { useWebSocketCoach } from '@/hooks/useWebSocketCoach';
import { useTTS } from '@/hooks/useTTS';
import { useInteractiveWidget } from '@/hooks/useInteractiveWidget';
// import { useAppState } from '@/context/AppStateContext'; // Eliminado

// ACEPTAMOS 'userData' COMO PROP
export default function PreGameCoach({ LCU_STATUS, userData }) {
    console.log('[PreGameCoach] --- RENDERIZANDO ---');
    console.log('[PreGameCoach] Props recibidas -> LCU_STATUS:', LCU_STATUS);
    console.log('[PreGameCoach] Props recibidas -> userData:', userData);

    // 'useWebSocketCoach' ahora usa el 'userData' que viene de las props.
    const { aiAdvice, wsStatus, sendQueueUpdate } = useWebSocketCoach({
        userData,
        targetEvent: 'QUEUE_ADVICE'
    });
    const { speak } = useTTS();
    const { isInteractive, setInteractive } = useInteractiveWidget(false);
    const [adviceSpoken, setAdviceSpoken] = useState(false);
    const [isLoadingAdvice, setIsLoadingAdvice] = useState(true);

    console.log('[PreGameCoach] Estado actual del WebSocket:', wsStatus);

    useEffect(() => {
        console.log('[PreGameCoach] useEffect [wsStatus, userData] -> Verificando condiciones para enviar actualización de cola.');
        if (wsStatus === 'CONNECTED' && !adviceSpoken && userData) {
            console.log('[PreGameCoach] Condiciones cumplidas. Enviando "QueueUpdate" al WebSocket.');
            sendQueueUpdate();
            setIsLoadingAdvice(true);
            setAdviceSpoken(true); // Para que no se envíe en cada re-render
        } else {
            console.log('[PreGameCoach] Condiciones para "QueueUpdate" no cumplidas (WS no conectado, ya enviado, o sin userData).');
        }
    }, [wsStatus, adviceSpoken, sendQueueUpdate, userData]);

    useEffect(() => {
        console.log('[PreGameCoach] useEffect [aiAdvice] -> Verificando si hay nuevo consejo de la IA.');
        // CORRECCIÓN CLAVE: Usamos 'preGameAnalysis' y verificamos si existe.
        const preGameAnalysis = aiAdvice?.preGameAnalysis;
        
        if (preGameAnalysis && isLoadingAdvice) {
            console.log('[PreGameCoach] ¡Nuevo consejo de IA recibido!', aiAdvice);
            setIsLoadingAdvice(false);

            // LOGICA TTS CORREGIDA: Hablar el Mantra Astral y el Foco Técnico
            // Esto reemplaza la lógica fallida de playstyle y synergy.
            const ttsText = `${preGameAnalysis.title}. ${preGameAnalysis.astralMantra}. Foco técnico: ${preGameAnalysis.technicalFocus}.`; 
            
            console.log('[PreGameCoach] Texto para hablar (consejo pre-partida):', ttsText);
            speak(ttsText);
            
        } else if (!preGameAnalysis && aiAdvice) {
            // Manejo de un caso de respuesta de IA inesperada (no tiene preGameAnalysis)
            setIsLoadingAdvice(false);
            console.log('[PreGameCoach] Advertencia: aiAdvice recibido, pero sin estructura preGameAnalysis.');
            
        } else {
            // No hay consejo nuevo o ya no estamos en la fase de carga de consejo.
        }
    }, [aiAdvice, speak, isLoadingAdvice, userData]);

    const isReady = aiAdvice && LCU_STATUS === 'ONLINE';
    // Se extrae la data para que el JSX sea más limpio y se evite el error de undefined
    const preGameAnalysis = aiAdvice?.preGameAnalysis;
    
    return (
        <div
            className={`transition-all duration-300 max-w-xl mx-auto p-5 rounded-xl shadow-lol-lg ${isInteractive ? 'bg-lol-blue-medium/95 border-2 border-lol-blue-accent' : 'bg-lol-blue-medium/80 border border-lol-gold-dark'}`}
            onMouseEnter={() => setInteractive(true)}
            onMouseLeave={() => setInteractive(false)}
        >
            <h2 className="font-display text-2xl font-bold text-lol-gold flex items-center mb-3">
                <FaBrain className="mr-2 text-lol-blue-accent" />
                COACH EN COLA: {userData?.summonerName || 'Invocador'} ({userData?.zodiacSign || 'N/A'})
            </h2>

            {/* Renderizado condicional: Ahora verifica si existe el objeto de análisis para evitar el TypeError */}
            {!isReady || isLoadingAdvice || !preGameAnalysis ? ( 
                <div className="text-center p-4 bg-lol-blue-dark rounded">
                    <FaSync className="animate-spin text-lol-gold mx-auto text-3xl mb-3" />
                    <p className="text-lol-gold-light">
                        Esperando respuesta de MetaMind... ({wsStatus})
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="p-3 bg-lol-blue-dark rounded border-l-4 border-lol-gold">
                        {/* LÍNEA 94 CORREGIDA: Accede a preGameAnalysis.title */}
                        <h3 className="text-lol-gold font-bold mb-1">{preGameAnalysis.title}</h3>
                        {/* LÍNEA 95 CORREGIDA: Accede a astralMantra */}
                        <p className="text-lol-gold-light text-sm italic">Mantra Astral: {preGameAnalysis.astralMantra}</p>
                        {/* LÍNEA 96 CORREGIDA: Accede a technicalFocus */}
                        <p className="text-lol-gold-light text-sm mt-1">Foco Técnico: {preGameAnalysis.technicalFocus}</p>
                    </div>

                     <button 
                        onClick={() => {
                            // CORRECCIÓN EN TTS DEL BOTÓN: Usa la estructura Astro-Técnica
                            const fullAdviceText = `
                            ${preGameAnalysis.title}. 
                            ${preGameAnalysis.astralMantra}. 
                            Foco técnico: ${preGameAnalysis.technicalFocus}.
                            `;
                            speak(fullAdviceText);
                        }} 
                        className="clickable w-full flex items-center justify-center p-2 rounded bg-lol-gold hover:bg-lol-gold-light transition duration-200 text-lol-blue-dark text-sm font-bold"
                    >
                        <FaMicrophoneAlt className="inline mr-2" /> REPETIR CONSEJO
                    </button>
                </div>
            )}
        </div>
    );
}