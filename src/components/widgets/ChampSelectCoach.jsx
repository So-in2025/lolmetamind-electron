// src/components/widgets/ChampSelectCoach.jsx - VERSIÓN FINAL DRAFT MIND-MAP (DINAMISMO Y ESTABILIDAD)
'use client';
import React, { useEffect, useState, useMemo, useRef } from 'react'; 
import { FaBookOpen, FaMicrophoneAlt, FaSync, FaShieldAlt, FaTachometerAlt, FaBullseye, FaFistRaised } from 'react-icons/fa';
import { useWebSocketCoach } from '@/hooks/useWebSocketCoach';
import { useTTS } from '@/hooks/useTTS';
import { useInteractiveWidget } from '@/hooks/useInteractiveWidget';

// Función utilitaria para acceder a LcuService solo en el cliente (SSR-Safe)
const getLcuService = () => {
    if (typeof window !== 'undefined' && window.api) {
        return window.api.lcuService; 
    }
    return null;
}

// Helpers (asumo que existen)
const getScoreColor = (score) => {
    if (score >= 80) return 'bg-green-600 border-green-400';
    if (score >= 60) return 'bg-yellow-500 border-yellow-300';
    if (score >= 40) return 'bg-yellow-700 border-yellow-500';
    return 'bg-red-600 border-red-400';
};

const getFocusColor = (phase) => {
    switch (phase) {
        case 'EARLY-GAME': return 'bg-lol-blue-accent border-lol-blue-dark';
        case 'MID-GAME': return 'bg-lol-gold border-lol-gold-light';
        case 'LATE-GAME': return 'bg-purple-600 border-purple-400';
        default: return 'bg-gray-600 border-gray-400';
    }
};

const getTextColors = (phase) => {
    if (phase === 'MID-GAME') return 'text-lol-blue-dark'; 
    return 'text-white';
};


export default function ChampSelectCoach({ LCU_STATUS, userData, draftData }) {
    
    // El hook debe exponer sendChampSelectUpdate
    const { aiAdvice, wsStatus, sendChampSelectUpdate } = useWebSocketCoach({
        userData,
        targetEvent: 'CHAMP_SELECT_ADVICE'
    });
    const { speak } = useTTS();
    const { isInteractive, setInteractive } = useInteractiveWidget(false);
    const [isLoadingAdvice, setIsLoadingAdvice] = useState(true);
    const [injectionStatus, setInjectionStatus] = useState(null);
    
    // 💎 CRÍTICO: Usamos un REF para almacenar el hash del último envío (ESTABILIZADOR)
    const lastSentDraftHashRef = useRef(null); 


    // 💎 HASH DE ESTADO: Crea un HASH de la composición para detectar cambios
    const draftStateHash = useMemo(() => {
        if (!draftData || !draftData.gameData) return null;
        // Crea un hash de la composición (picks, bans) para detectar cambios
        const picks = (draftData.gameData.teamOne || []).map(p => p.championId).join(',');
        const bans = (draftData.gameData.bannedChampions || []).map(b => b.championId).join(',');
        return `${draftData.phase}-${picks}-${bans}`; 
    }, [draftData]);


    // 1. Efecto para enviar el evento al WebSocket.
    useEffect(() => {
        // 🚨 FIX: Compara el hash actual con el hash almacenado en el REF.
        if (wsStatus === 'CONNECTED' && 
            draftStateHash && 
            draftStateHash !== lastSentDraftHashRef.current && // Si el hash cambió, enviamos
            LCU_STATUS === 'ONLINE' && 
            draftData?.gameData) {
            
            console.log(`[ChampSelectCoach] ✅ DETECTADO CAMBIO: Enviando "CHAMP_SELECT_UPDATE". Hash: ${draftStateHash}`);
            
            sendChampSelectUpdate(draftData); 
            setIsLoadingAdvice(true);
            setInjectionStatus(null); 
            
            // 🚨 CRÍTICO: Actualiza el ref inmediatamente, el próximo render usará este valor
            lastSentDraftHashRef.current = draftStateHash; 
        }
    }, [wsStatus, draftStateHash, sendChampSelectUpdate, LCU_STATUS, draftData]);


    // 2. Efecto para manejar la respuesta de la IA (TTS).
    useEffect(() => {
        if (aiAdvice && aiAdvice.draftScore && isLoadingAdvice) {
            console.log('[ChampSelectCoach] ¡Consejo de draft Mind-Map recibido!', aiAdvice);
            setIsLoadingAdvice(false);

            const ttsText = `MetaMind: Análisis de draft listo. Score ${aiAdvice.draftScore} de 100. Foco en ${aiAdvice.phaseFocus}. Acción: ${aiAdvice.playerRoleAction}.`;
            speak(ttsText);
        } else if (aiAdvice && isLoadingAdvice) {
            setIsLoadingAdvice(false);
            console.log('[ChampSelectCoach] Advertencia: aiAdvice recibido, pero sin estructura de Mind-Map completa.');
        }
    }, [aiAdvice, speak, isLoadingAdvice]);
    
    // Función para inyectar runas (Llama al getter SSR-safe)
    const handleInjectRunes = async () => {
        const LcuService = getLcuService(); // Llamada segura

        if (!LcuService) {
            setInjectionStatus('NOT_AVAILABLE');
            return;
        }
        if (!aiAdvice || !aiAdvice.runes) {
            setInjectionStatus('ERROR');
            return;
        }

        setInjectionStatus('LOADING');
        try {
            const success = await LcuService.injectRunes(aiAdvice.runes); 
            if (success) {
                setInjectionStatus('SUCCESS');
            } else {
                setInjectionStatus('ERROR');
            }
        } catch (error) {
            console.error('Error al inyectar runas:', error);
            setInjectionStatus('ERROR');
        }
    };

    const isReady = aiAdvice && LCU_STATUS === 'ONLINE';
    const analysis = aiAdvice; 

    // Renderizado del Mind-Map (Matriz de Prioridad)
    return (
        <div
            className={`transition-all duration-300 max-w-4xl w-full mx-auto p-3 rounded-xl shadow-lol-lg ${isInteractive ? 'bg-lol-blue-medium/95 border-2 border-lol-blue-accent' : 'bg-lol-blue-medium/80 border border-lol-gold-dark'}`}
            onMouseEnter={() => setInteractive(true)}
            onMouseLeave={() => setInteractive(false)}
        >
            <h2 className="font-display text-lg font-bold text-lol-gold flex items-center justify-center mb-3">
                <FaBookOpen className="mr-2 text-lol-blue-accent" />
                DRAFT MIND-MAP: {userData?.summonerName || 'Invocador'}
            </h2>

            {/* Renderizado Condicional de Carga (Si no hay draftScore) */}
            {!isReady || isLoadingAdvice || !analysis?.draftScore ? ( 
                <div className="text-center p-4 bg-lol-blue-dark rounded">
                    <FaSync className="animate-spin text-lol-gold mx-auto text-3xl mb-2" />
                    <p className="text-lol-gold-light text-sm">
                        {draftData ? 'Analizando el Draft en tiempo real...' : 'Esperando data de selección de campeón...'} ({wsStatus})
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {/* MATRIZ DE PRIORIDAD (4 Paneles) */}
                    <div className="flex flex-col md:flex-row space-y-2 md:space-y-0 md:space-x-2">
                        
                        {/* Panel I: SCORE GLOBAL (Tensión del Draft) */}
                        <div className={`flex-1 p-3 rounded-lg flex flex-col justify-center items-center font-bold border-l-4 ${getScoreColor(analysis.draftScore)}`}>
                            <FaTachometerAlt className="text-xl mb-1 text-white" />
                            <span className="text-sm uppercase text-white opacity-80">Tensión Draft</span>
                            <span className="text-2xl font-display text-white">{analysis.draftScore}/100</span>
                        </div>

                        {/* Panel II: FASE CRÍTICA (Foco de Fase) */}
                        <div className={`flex-1 p-3 rounded-lg flex flex-col justify-center items-center font-bold border-l-4 ${getFocusColor(analysis.phaseFocus)}`}>
                            <FaBullseye className={`text-xl mb-1 ${getTextColors(analysis.phaseFocus)}`} />
                            <span className={`text-sm uppercase opacity-80 ${getTextColors(analysis.phaseFocus)}`}>Foco de Fase</span>
                            <span className={`text-xl font-display ${getTextColors(analysis.phaseFocus)}`}>{analysis.phaseFocus}</span>
                        </div>
                        
                        {/* Panel III: ACCIÓN CLAVE (Mi Prioridad) */}
                        <div className="flex-1 p-3 rounded-lg flex flex-col justify-center items-center font-bold border-l-4 border-lol-gold bg-lol-blue-dark">
                            <FaFistRaised className="text-xl mb-1 text-lol-gold" />
                            <span className="text-sm uppercase text-lol-gold opacity-80">Mi Acción</span>
                            <span className="text-base font-display text-lol-gold text-center">{analysis.playerRoleAction}</span>
                        </div>
                        
                        {/* Panel IV: INYECCIÓN DE RUNAS (Acción Inmediata) */}
                        <div className="flex-1 flex flex-col justify-center">
                            <button 
                                onClick={handleInjectRunes}
                                disabled={injectionStatus === 'LOADING' || !analysis.runes}
                                className={`w-full p-3 rounded transition duration-200 text-sm font-bold flex items-center justify-center ${
                                    injectionStatus === 'SUCCESS' ? 'bg-green-600 text-white' : 
                                    injectionStatus === 'ERROR' || injectionStatus === 'NOT_AVAILABLE' ? 'bg-red-600 text-white' :
                                    analysis.runes ? 'bg-lol-blue-accent hover:bg-lol-blue-accent/80 text-lol-gold' :
                                    'bg-gray-700 text-gray-500 cursor-not-allowed'
                                }`}
                            >
                                <FaShieldAlt className="inline mr-2" /> 
                                {injectionStatus === 'LOADING' ? 'INYECTANDO RUNAS...' :
                                 injectionStatus === 'SUCCESS' ? 'RUNAS INYECTADAS ✅' :
                                 injectionStatus === 'ERROR' ? 'ERROR EN INYECCIÓN ❌' :
                                 injectionStatus === 'NOT_AVAILABLE' ? 'LCU NO DISPONIBLE' :
                                 'INYECCIÓN DE RUNAS'}
                            </button>
                        </div>
                    </div>
                    
                    {/* Resumen Estratégico Detallado */}
                    <div className="p-3 bg-lol-blue-darker rounded border-t border-lol-gold-dark">
                        <p className="text-lol-gold text-sm font-bold">Resumen de la IA:</p>
                        <p className="text-lol-gold-light text-xs italic mt-1">{analysis.metaAdvantage}</p>
                    </div>

                    {/* Botón de Repetir Consejo (TTS) */}
                    <button 
                        onClick={() => {
                            const fullAdviceText = `Análisis de draft listo. Score ${analysis.draftScore} de 100. Foco en ${analysis.phaseFocus}. Acción clave: ${analysis.playerRoleAction}.`;
                            speak(fullAdviceText);
                        }} 
                        className="clickable w-full flex items-center justify-center p-2 rounded bg-lol-gold/10 hover:bg-lol-gold/20 transition duration-200 text-lol-gold-light text-xs font-bold"
                    >
                        <FaMicrophoneAlt className="inline mr-2" /> Repetir Consejo de la Matriz
                    </button>

                </div>
            )}
        </div>
    );
}