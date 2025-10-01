// src/app/overlay/page.jsx - MONTAJE FINAL Y COMPLETO CON COACH DE IA Y TTS (V5.0 FIX)
"use client"

import React, { useEffect, useState, Suspense } from 'react';
import { useInteractiveWidget } from '../../hooks/useInteractiveWidget'; 
import { useLcuData } from '../../hooks/useLcuData';
import { useAppState } from '@/context/AppStateContext';

// Importamos los widgets
const ControlsHUD = React.lazy(() => import('../../components/widgets/ControlsHUD'));
const ChampSelectCoach = React.lazy(() => import('../../components/widgets/ChampSelectCoach'));
const InGameCoach = React.lazy(() => import('../../components/widgets/InGameCoach'));
const StatusHUD = React.lazy(() => import('../../components/widgets/StatusHUD'));
const BuildsHUD = React.lazy(() => import('../../components/widgets/BuildsHUD')); // Nuevo Import

// Componente CRÍTICO para activar el TTS del sistema
const TTS_NARRATION_HANDLER = () => {
    useEffect(() => {
        if (!window.electronAPI || !window.speechSynthesis) return;

        const handleTtsRequest = (text) => {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = "es-ES";
            utterance.pitch = 1;
            utterance.rate = 1.1;

            window.speechSynthesis.cancel();
            window.speechSynthesis.speak(utterance);
        };

        const unsubscribe = window.electronAPI.on("tts-narrate", handleTtsRequest);
        return () => {
            window.speechSynthesis.cancel();
            unsubscribe();
        };
    }, []);
    return null;
};

function OverlayContent() {
    console.log("[OverlayPage] 🟢 Montando componente.");
    
    const { isWidgetInteractive } = useInteractiveWidget('global-overlay'); 
    const lcuData = useLcuData();
    
    // El filtrado de fase (InProgress, ChampSelect) se maneja DENTRO de cada Widget.

    return (
        <React.Fragment> 
            <Suspense fallback={null}>
                {/* CRÍTICO: El manejador de TTS debe estar activo en la raíz */}
                <TTS_NARRATION_HANDLER /> 
            </Suspense>

            {/* Contenedor principal: interactivo o pasivo según la hotkey */}
            <div className={`h-full w-full bg-transparent ${isWidgetInteractive ? 'pointer-events-auto' : 'pointer-events-none'}`}>
            
                {/* 1. Controles Globales (Fixed, Posición 20, 20) - Siempre interactivo */}
                <div style={{ position: 'fixed', top: '20px', left: '20px', zIndex: 10000, pointerEvents: 'auto' }}>
                    <Suspense fallback={null}>
                        <ControlsHUD isInteractive={isWidgetInteractive} />
                    </Suspense>
                </div>
                
                {/* 2. Status HUD (Fixed, Posición 100, 100) - Recibe lcuData completo */}
                <div style={{ position: 'fixed', top: '100px', left: '100px', zIndex: 9000, pointerEvents: isWidgetInteractive ? 'auto' : 'none' }}>
                    <Suspense fallback={null}>
                        <StatusHUD lcuData={lcuData} />
                    </Suspense>
                </div>
            
                {/* 3. Coach de Selección de Campeones (Fixed, Posición 200, 500) - Recibe lcuData completo */}
                <div style={{ position: 'fixed', top: '200px', left: '500px', zIndex: 9000, pointerEvents: isWidgetInteractive ? 'auto' : 'none' }}>
                    <Suspense fallback={null}>
                        <ChampSelectCoach lcuData={lcuData} isInteractive={isWidgetInteractive} />
                    </Suspense>
                </div>

                {/* 4. Coach En Partida (Fixed, Posición 250, 700) - Recibe lcuData completo */}
                <div style={{ position: 'fixed', top: '250px', left: '700px', zIndex: 9000, pointerEvents: isWidgetInteractive ? 'auto' : 'none' }}>
                    <Suspense fallback={null}>
                        <InGameCoach lcuData={lcuData} isInteractive={isWidgetInteractive} />
                    </Suspense>
                </div>

                {/* 5. BuildHUD (Fixed, Posición 400, 20) - Recibe lcuData completo */}
                <div style={{ position: 'fixed', top: '400px', left: '20px', zIndex: 9000, pointerEvents: isWidgetInteractive ? 'auto' : 'none' }}>
                    <Suspense fallback={null}>
                        <BuildsHUD lcuData={lcuData} />
                    </Suspense>
                </div>
      
            </div>
        </React.Fragment>
    );
}

// Exportación FINAL simplificada del componente OverlayPage.
export default function OverlayPage() {
    return (
       <OverlayContent />
    );
}
