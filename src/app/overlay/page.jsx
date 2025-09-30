// src/app/overlay/page.jsx - VERSIÓN FINAL DE PRODUCCIÓN CON DIAGNÓSTICO
"use client"

import React, { useEffect, useState, Suspense } from 'react';
import { useInteractiveWidget } from '../../hooks/useInteractiveWidget'; 
import { useLcuData } from '../../hooks/useLcuData';
import { useAppState } from '@/context/AppStateContext';

// Importamos los widgets usando React.lazy para carga diferida y fallback
const ControlsHUD = React.lazy(() => import('../../components/widgets/ControlsHUD'));
const ChampSelectCoach = React.lazy(() => import('../../components/widgets/ChampSelectCoach'));
const InGameCoach = React.lazy(() => import('../../components/widgets/InGameCoach'));
const StatusHUD = React.lazy(() => import('../../components/widgets/StatusHUD'));

// Función TTS (Text-to-Speech) con logs de diagnóstico
const speak = (text, priority = 'normal') => {
  try {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window && text) {
      if (priority === 'high') {
        window.speechSynthesis.cancel();
      }
      
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'es-ES';
      utterance.rate = 1.2;
      utterance.pitch = 1.1;

      utterance.onstart = () => console.log(`[TTS] ✅ INICIO: Hablando "${text}"`);
      utterance.onerror = (event) => console.error(`[TTS] ❌ ERROR: ${event.error}`);
      
      window.speechSynthesis.speak(utterance);
      
    } else {
      console.warn("[TTS] ⚠️ API de SpeechSynthesis no disponible o el texto está vacío.");
    }
  } catch (e) {
    console.error(`[TTS] 🚨 Fallo catastrófico al intentar hablar: ${e.message}`);
  }
};

export default function OverlayPage() {
    console.log("[OverlayPage] 🟢 Montando componente...");
    
    const { isWidgetInteractive } = useInteractiveWidget('global-overlay');
    const lcuData = useLcuData();
    const { userData } = useAppState();

    const [lastSpokenGamePhase, setLastSpokenGamePhase] = useState('');
    const gamePhase = lcuData?.gameflow?.phase;

    useEffect(() => {
        console.log(`[OverlayPage] 🔄 Actualización de estado detectada. GamePhase: ${gamePhase}, LCU Data:`, lcuData);
        
        if (!gamePhase || gamePhase === lastSpokenGamePhase) return;

        let adviceToSpeak = '';
        let priority = 'normal';

        if (gamePhase === 'ChampSelect') {
            adviceToSpeak = "Analizando selección de campeones.";
            priority = 'high';
        } else if (gamePhase === 'InProgress') {
            adviceToSpeak = "Partida en curso. Pulsa la R de MetaMind para un impulso de IA.";
            priority = 'normal';
        }

        if (adviceToSpeak) {
            console.log(`[OverlayPage] 🎤 Intentando activar TTS para la fase: ${gamePhase}`);
            speak(adviceToSpeak, priority);
            setLastSpokenGamePhase(gamePhase);
        }
    }, [gamePhase, lastSpokenGamePhase, lcuData]);

    // Fallback de renderizado para cada widget. Si uno falla, los otros seguirán funcionando.
    const WidgetFallback = ({ name }) => (
        <div style={{ position: 'fixed', top: 0, left: 0, color: 'red', backgroundColor: 'black', padding: '5px', zIndex: 10000 }}>
            Error al cargar el widget: {name}
        </div>
    );

    return (
        <div className={`h-full w-full bg-transparent ${isWidgetInteractive ? 'pointer-events-auto' : 'pointer-events-none'}`}>
            <p style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: 'lime', fontSize: '24px', textShadow: '0 0 5px black', zIndex: 9998 }}>
                [Overlay Activo - Fase: {gamePhase || "Desconocida"}]
            </p>

            <Suspense fallback={<WidgetFallback name="ControlsHUD" />}>
                <ControlsHUD />
            </Suspense>

            <Suspense fallback={<WidgetFallback name="StatusHUD" />}>
                <StatusHUD gamePhase={gamePhase} />
            </Suspense>

            {gamePhase === 'ChampSelect' && (
                <Suspense fallback={<WidgetFallback name="ChampSelectCoach" />}>
                    <ChampSelectCoach 
                        champSelectData={lcuData.gameflow}
                        isInteractive={isWidgetInteractive} 
                    />
                </Suspense>
            )}

            {gamePhase === 'InProgress' && (
                <Suspense fallback={<WidgetFallback name="InGameCoach" />}>
                    <InGameCoach 
                        liveData={lcuData.liveData}
                        userData={userData}
                        isInteractive={isWidgetInteractive}
                    />
                </Suspense>
            )}
        </div>
    );
}