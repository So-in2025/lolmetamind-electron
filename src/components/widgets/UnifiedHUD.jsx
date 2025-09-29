// src/components/widgets/UnifiedHUD.jsx
'use client';

import React, { useState, useEffect } from 'react';
import { useLcuData } from '../../hooks/useLcuData';

import ChampSelectCoach from './ChampSelectCoach';
import InGameCoach from './InGameCoach'; // <-- Importado y AHORA SÍ se usa

// --- FUNCIÓN TTS (Text-to-Speech) ---
const speak = (text, priority = 'normal') => {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window && text) {
    if (priority === 'high') window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'es-ES';
    utterance.rate = 1.1;
    window.speechSynthesis.speak(utterance);
  }
};

// --- COMPONENTE PRINCIPAL (EL CEREBRO DEL OVERLAY) ---
export default function UnifiedHUD({ isInteractive }) {
    const lcuData = useLcuData();
    const [lastSpokenAdvice, setLastSpokenAdvice] = useState('');

    useEffect(() => {
        if (!lcuData) return;
        const gamePhase = lcuData.lcuState?.gameflow?.phase;

        if (gamePhase === 'ChampSelect') {
            const simulatedAdvice = "Analizando el draft. Revisa el HUD para ver las recomendaciones.";
            if (simulatedAdvice !== lastSpokenAdvice) {
                speak(simulatedAdvice, 'high');
                setLastSpokenAdvice(simulatedAdvice);
            }
        } else if (gamePhase === 'InProgress') {
            const inGameAdvice = "Partida en curso. Activa la 'R' de MetaMind para un impulso de IA.";
            if (inGameAdvice !== lastSpokenAdvice) {
                speak(inGameAdvice, 'normal');
                setLastSpokenAdvice(inGameAdvice);
            }
        } else {
            setLastSpokenAdvice('');
        }
    }, [lcuData, lastSpokenAdvice]);

    // --- RENDERIZADO CONDICIONAL DEL OVERLAY ---
    if (!lcuData) return null;
    const gamePhase = lcuData.lcuState?.gameflow?.phase;

    // Si estamos en Selección de Campeón, mostramos el coach de ChampSelect
    if (gamePhase === 'ChampSelect') {
        return (
            <ChampSelectCoach 
                champSelectData={lcuData.lcuState.champSelect}
                isInteractive={isInteractive}
            />
        );
    }

    // 🔑 CORRECCIÓN: Si estamos dentro del juego, mostramos el coach In-Game
    if (gamePhase === 'InProgress') {
        return (
            <InGameCoach
                liveClientDataStatus={lcuData.liveClientDataStatus}
                isInteractive={isInteractive}
            />
        );
    }
    
    // Si no estamos en una fase activa, no mostramos nada.
    return null;
};