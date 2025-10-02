'use client';
import React, { useEffect, useState } from 'react';
import { FaSync, FaBrain, FaMicrophoneAlt } from 'react-icons/fa';
import { useWebSocketCoach } from '@/hooks/useWebSocketCoach';
import { useTTS } from '@/hooks/useTTS';
import { useInteractiveWidget } from '@/hooks/useInteractiveWidget';
import { useAppState } from '@/context/AppStateContext';

export default function PreGameCoach({ LCU_STATUS }) {
    const { userData, isFirstTimeUser, isLoadingUser } = useAppState();

    const { aiAdvice, wsStatus, sendQueueUpdate } = useWebSocketCoach({
        userData,
        targetEvent: 'QUEUE_ADVICE'
    });
    const { speak } = useTTS();
    const { isInteractive, setInteractive } = useInteractiveWidget(false);
    const [adviceSpoken, setAdviceSpoken] = useState(false);
    const [isLoadingAdvice, setIsLoadingAdvice] = useState(true);

    useEffect(() => {
        if (wsStatus === 'CONNECTED' && !adviceSpoken && userData && !isLoadingUser) {
            sendQueueUpdate();
            setIsLoadingAdvice(true);
            setAdviceSpoken(true);
        }
    }, [wsStatus, adviceSpoken, sendQueueUpdate, userData, isLoadingUser]);

    useEffect(() => {
        if (aiAdvice && isLoadingAdvice) {
            const playstyle = aiAdvice?.playstyleAnalysis;
            const synergy = aiAdvice?.newChampionRecommendations?.synergy?.champion;

            if (playstyle && synergy) {
                const ttsText = `MetaMind. Tu diagnóstico: ${playstyle.style}. ${playstyle.description.split('.')[0]}. Tu campeón de sinergia es ${synergy}.`;
                speak(ttsText);
            } else {
                speak(`Bienvenido ${userData?.summonerName || 'Invocador'}. Tu asistente está listo para el draft.`);
            }
            setIsLoadingAdvice(false);
        }
    }, [aiAdvice, speak, isLoadingAdvice, userData]);

    const isReady = aiAdvice && LCU_STATUS === 'ONLINE';

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

            {!isReady || isLoadingAdvice ? (
                <div className="text-center p-4 bg-lol-blue-dark rounded">
                    <FaSync className="animate-spin text-lol-gold mx-auto text-3xl mb-3" />
                    <p className="text-lol-gold-light">
                        {isFirstTimeUser ? 'Generando perfil inicial...' : 'Esperando respuesta de MetaMind...'} ({wsStatus})
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="p-3 bg-lol-blue-dark rounded border-l-4 border-lol-gold">
                        <h3 className="text-lol-gold font-bold mb-1">{aiAdvice.playstyleAnalysis.title}</h3>
                        <p className="text-lol-gold-light text-sm italic">Estilo: {aiAdvice.playstyleAnalysis.style}</p>
                        <p className="text-lol-gold-light text-sm mt-1">{aiAdvice.playstyleAnalysis.description}</p>
                    </div>

                    <button onClick={() => speak(`Tu diagnóstico es ${aiAdvice.playstyleAnalysis.style}.`)} className="w-full py-2 bg-lol-blue-accent hover:bg-lol-blue-medium font-bold rounded text-lol-blue-dark transition-colors">
                        <FaMicrophoneAlt className="inline mr-2" /> REPETIR CONSEJOS
                    </button>
                </div>
            )}
        </div>
    );
}