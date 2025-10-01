// src/components/widgets/InGameCoach.jsx - MOTOR COACH CLASE MUNDIAL (ENDPOINT CONSOLIDADO)
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAppState } from '../../context/AppStateContext';

const speak = (text) => {
    if (window.electronAPI && text) {
        window.electronAPI.send('speak-text', text);
    }
};

const LoadingSpinner = () => (
    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-lol-accent-gold"></div>
);

// Nota: Ahora usa el endpoint único 'get-live-coaching' para los 3 tipos de consejos.
export default function InGameCoach({ lcuData, isInteractive }) { 
    const { userData } = useAppState();
    const [strategyAdvice, setStrategyAdvice] = useState('');
    const [buildsAdvice, setBuildsAdvice] = useState('');
    const [eliteCoachAdvice, setEliteCoachAdvice] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    
    // ** LÓGICA CLAVE DE FASE (FIX DE BLOQUEO) **
    const inGameData = lcuData?.gameflow?.phase === 'InProgress' ? lcuData : null;
    const gameTime = inGameData?.liveData?.gameData?.gameTime || 0;
    const currentGold = inGameData?.liveData?.activePlayer?.currentGold || 0;
    const currentCS = inGameData?.liveData?.activePlayer?.cs || inGameData?.liveData?.activePlayer?.scores?.creepScore || 0;
    
    // El payload contiene toda la data, el backend remoto decide qué análisis correr.
    const coachPayload = useMemo(() => ({
        summoner: userData,
        matchData: inGameData,
        gameTime: gameTime,
        currentCS: currentCS,
        currentGold: currentGold,
    }), [userData, inGameData, gameTime, currentCS, currentGold]);

    // Función unificada para llamar a la IA
    const callLiveCoach = useCallback(async (triggerType, payload, setState, narration) => {
        if (!window.electronAPI || !inGameData) return;
        setIsLoading(true);
        try {
            // El payload ahora incluye el tipo de trigger para que el backend remoto diferencie la petición.
            const result = await window.electronAPI.invoke('get-live-coaching', { ...payload, triggerType });
            
            if (result.error) throw new Error(result.error);
            
            // Asumimos que el backend devuelve el campo de advice relevante para el trigger.
            const advice = result.advice || result.strategy || result.message || JSON.stringify(result);
            setState(advice);
            
            if (narration && advice) {
                speak(narration + advice);
            }
        } catch (err) {
            console.error(`🚨 Fallo en get-live-coaching (Trigger: ${triggerType}):`, err);
            setState(`Error en ${triggerType}: ${err.message}`);
        } finally {
             setIsLoading(false);
        }
    }, [inGameData]);


    // 1. COACHING ESTRATÉGICO (Cada 5 minutos)
    useEffect(() => {
        if (!inGameData || gameTime < 290) return; 
        
        if (Math.abs(gameTime % 300) < 20 && gameTime > 0) { 
            console.log(`[IA ESTRATÉGICA] Disparo a tiempo: ${gameTime}s.`);
            callLiveCoach(
                'STRATEGY', // Trigger para backend
                coachPayload, 
                setStrategyAdvice, 
                'MetaMind, consejo estratégico: '
            );
        }
    }, [inGameData, gameTime, coachPayload, callLiveCoach]);

    
    // 2. BUILDS TÁCTICAS (Cada 1 minuto)
    useEffect(() => {
         if (!inGameData || gameTime < 50) return;

         if (Math.abs(gameTime % 60) < 15 && gameTime > 0) {
              callLiveCoach(
                  'BUILDS', // Trigger para backend
                  coachPayload, 
                  setBuildsAdvice, 
                  'Asesor de Builds: '
              );
         }
    }, [inGameData, gameTime, coachPayload, callLiveCoach]);

    // 3. COUCH ÉLITE (Real-Time Performance Deviation)
    useEffect(() => {
        if (!inGameData || gameTime < 180 || isLoading) return; 
        
        const expectedCS = Math.floor(gameTime / 60) * 8; 
        const csDeficit = expectedCS - currentCS;
        
        if (csDeficit > 15) { 
            const payload = { ...coachPayload, event: `CS_DEFICIT_${csDeficit}` };
            
            callLiveCoach(
                'ELITE', // Trigger para backend
                payload, 
                setEliteCoachAdvice, 
                '¡Atención Jugador! ' 
            );
        }
        
    }, [inGameData, gameTime, currentCS, currentGold, coachPayload, callLiveCoach, isLoading]);

    if (!inGameData) return null;

    return (
        <div className="fixed bottom-4 right-4 w-[450px] bg-lol-dark-blue/90 backdrop-blur-sm border-2 border-lol-gold/50 rounded-lg shadow-2xl text-white p-4 user-select-none">
            <h2 className="text-xl font-bold text-lol-highlight uppercase tracking-wider mb-3 border-b border-lol-gold/30 pb-2">
                Coach Élite en Partida <span className="text-lol-accent-gold text-sm">({Math.floor(gameTime / 60)}:{String(Math.floor(gameTime % 60)).padStart(2, '0')})</span>
            </h2>
            
            {isLoading && <LoadingSpinner />}
            
            <div className="space-y-3 text-sm">
                <div className="text-xs p-2 bg-lol-dark-blue rounded border border-lol-gold/20">
                    <h3 className="font-bold text-lol-accent-gold uppercase">Estrategia (Cada 5 min)</h3>
                    <p className="text-lol-light">{strategyAdvice || 'Esperando el siguiente ciclo estratégico...'}</p>
                </div>

                <div className="text-xs p-2 bg-lol-dark-blue rounded border border-lol-gold/20">
                    <h3 className="font-bold text-lol-accent-gold uppercase">Builds (Cada 1 min)</h3>
                    <p className="text-lol-light">{buildsAdvice || 'Analizando items y composiciones...'}</p>
                </div>
                
                <div className="text-xs p-2 bg-red-900/40 rounded border border-red-500/50">
                    <h3 className="font-bold text-red-400 uppercase">Coach Élite (Tiempo Real)</h3>
                    <p className="text-lol-light">{eliteCoachAdvice || 'Monitoreando tu performance. Juega con confianza.'}</p>
                </div>
            </div>
            
        </div>
    );
}
