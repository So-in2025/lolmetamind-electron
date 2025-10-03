// src/components/widgets/PreGameCoach.jsx - VERSIÓN CORREGIDA
'use client';
import React, { useEffect, useState } from 'react';
import { FaSync, FaBrain, FaMicrophoneAlt } from 'react-icons/fa';
import { useWebSocketCoach } from '@/hooks/useWebSocketCoach';
import { useTTS } from '@/hooks/useTTS';
import { useInteractiveWidget } from '@/hooks/useInteractiveWidget';
// 🚨 'useAppState' ya no es necesario aquí.
// import { useAppState } from '@/context/AppStateContext';

// 🚨 1. ACEPTAMOS 'userData' COMO PROP
//    Ahora el componente recibe los datos del usuario directamente de su padre (CoachContainer).
export default function PreGameCoach({ LCU_STATUS, userData }) {
    console.log('[PreGameCoach] --- RENDERIZANDO ---');
    console.log('[PreGameCoach] Props recibidas -> LCU_STATUS:', LCU_STATUS);
    console.log('[PreGameCoach] Props recibidas -> userData:', userData);

    // 🚨 2. ELIMINAMOS LA LLAMADA A 'useAppState'
    // const { userData, isFirstTimeUser, isLoadingUser } = useAppState();

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
        // 🚨 La condición se simplifica: ya no necesitamos 'isLoadingUser'.
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
        if (aiAdvice && isLoadingAdvice) {
            console.log('[PreGameCoach] ¡Nuevo consejo de IA recibido!', aiAdvice);
            setIsLoadingAdvice(false);

            const playstyle = aiAdvice?.playstyleAnalysis;
            const synergy = aiAdvice?.newChampionRecommendations?.synergy?.champion;

            if (playstyle && synergy) {
            const ttsText = `MetaMind. Tu diagnóstico: ${playstyle.style}. ${playstyle.description}. Tu campeón de sinergia es ${synergy}.`; // Elimina .split('.')[0]
                console.log('[PreGameCoach] Texto para hablar (diagnóstico completo):', ttsText);
                speak(ttsText);
            } else {
                const welcomeText = `Bienvenido ${userData?.summonerName || 'Invocador'}. Tu asistente está listo para el draft.`;
                console.log('[PreGameCoach] Texto para hablar (bienvenida simple):', welcomeText);
                speak(welcomeText);
            }
        } else {
            // No hay consejo nuevo o ya no estamos en la fase de carga de consejo.
        }
    }, [aiAdvice, speak, isLoadingAdvice, userData]);

    const isReady = aiAdvice && LCU_STATUS === 'ONLINE';
    
    return (
        <div
            className={`transition-all duration-300 max-w-xl mx-auto p-5 rounded-xl shadow-lol-lg ${isInteractive ? 'bg-lol-blue-medium/95 border-2 border-lol-blue-accent' : 'bg-lol-blue-medium/80 border border-lol-gold-dark'}`}
            onMouseEnter={() => setInteractive(true)}
            onMouseLeave={() => setInteractive(false)}
        >
            {/* El JSX ahora usará el 'userData' de las props, mostrando el nombre y signo correctos. */}
            <h2 className="font-display text-2xl font-bold text-lol-gold flex items-center mb-3">
                <FaBrain className="mr-2 text-lol-blue-accent" />
                COACH EN COLA: {userData?.summonerName || 'Invocador'} ({userData?.zodiacSign || 'N/A'})
            </h2>

            {/* La lógica de renderizado condicional se mantiene, pero ahora se resolverá correctamente. */}
            {!isReady || isLoadingAdvice ? (
                <div className="text-center p-4 bg-lol-blue-dark rounded">
                    <FaSync className="animate-spin text-lol-gold mx-auto text-3xl mb-3" />
                    <p className="text-lol-gold-light">
                        Esperando respuesta de MetaMind... ({wsStatus})
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="p-3 bg-lol-blue-dark rounded border-l-4 border-lol-gold">
                        <h3 className="text-lol-gold font-bold mb-1">{aiAdvice.playstyleAnalysis.title}</h3>
                        <p className="text-lol-gold-light text-sm italic">Estilo: {aiAdvice.playstyleAnalysis.style}</p>
                        <p className="text-lol-gold-light text-sm mt-1">{aiAdvice.playstyleAnalysis.description}</p>
                    </div>

                     <button 
                        onClick={() => {
                            // ▼▼▼ CORRECCIÓN TAMBIÉN AQUÍ (en el botón de repetir) ▼▼▼
                            const fullAdviceText = `
                            Tu diagnóstico: ${aiAdvice.playstyleAnalysis.style}. 
                            ${aiAdvice.playstyleAnalysis.description}. 
                            Tu campeón de sinergia recomendado es ${aiAdvice.newChampionRecommendations.synergy.champion}.
                            `; // Asegúrate de que aquí tampoco esté el .split('.')[0]
                            // ▲▲▲ FIN DE LA CORRECCIÓN ▲▲▲
                            speak(fullAdviceText);
                        }} 
                        className="clickable w-full ..."
                    >
                        <FaMicrophoneAlt className="inline mr-2" /> REPETIR CONSEJO
                    </button>
                </div>
            )}
        </div>
    );
}