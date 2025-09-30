// src/app/overlay/page.jsx - VERSIÓN FINAL CON HEXTECH MODULAR Y LÓGICA DE FASE CORREGIDA
"use client"

import React, { useEffect, useState, Suspense } from 'react';
import { useInteractiveWidget } from '../../hooks/useInteractiveWidget'; 
import { useLcuData } from '../../hooks/useLcuData';
import { useAppState } from '@/context/AppStateContext';
import { ScaleProvider } from '@/context/ScaleContext'; // Importar el nuevo Provider
import DragAndScaleWidget from '@/components/widgets/DragAndScaleWidget'; // Importar el nuevo Wrapper

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

      // FIX CRÍTICO: Eliminados los backslashes innecesarios
      utterance.onstart = () => console.log(`[TTS] ✅ INICIO: Hablando "${text}"`); 
      utterance.onerror = (event) => console.error(`[TTS] ❌ ERROR: ${event.error}`);
      
      window.speechSynthesis.speak(utterance);
      
    } else {
      console.warn("[TTS] ⚠️ API de SpeechSynthesis no disponible o el texto está vacío.");
    }
  } catch (e) {
    // FIX CRÍTICO: Eliminados los backslashes innecesarios
    console.error(`[TTS] 🚨 Fallo catastrófico al intentar hablar: ${e.message}`);
  }
};

// Componente principal del Overlay (Envuelto en ScaleProvider en la exportación)
function OverlayContent() {
    console.log("[OverlayPage] 🟢 Montando componente...");
    
    // isWidgetInteractive ahora controla si los controles de drag/scale son visibles
    const { isWidgetInteractive } = useInteractiveWidget('global-overlay'); 
    const lcuData = useLcuData();
    const { userData } = useAppState();

    const [lastSpokenGamePhase, setLastSpokenGamePhase] = useState('');
    
    // --- LÓGICA DE FASE (CORRECCIÓN CRÍTICA Y DEBUG) ---
    let gamePhase = lcuData?.gameflow?.phase; 
    const realLcuPhase = gamePhase; 
    
    // Bandera temporal para pruebas: Poner a 'false' para producción.
    const DEBUG_FORCE_WIDGETS_ON = true; 
    
    // Forzamos fase si es inactiva para poder probar el overlay y TTS.
    if (DEBUG_FORCE_WIDGETS_ON && (gamePhase === 'EndOfGame' || gamePhase === 'None' || !gamePhase)) {
        gamePhase = 'ChampSelect'; 
        // FIX CRÍTICO: Eliminados los backslashes innecesarios
        console.warn(`[OverlayPage] ⚠️ FASE FORZADA A 'ChampSelect' (DEBUG). LCU real: ${realLcuPhase || "N/A"}`);
    }
    // --- FIN LÓGICA DE FASE ---
    
    useEffect(() => {
        // FIX CRÍTICO: Eliminados los backslashes innecesarios
        console.log(`[OverlayPage] 🔄 Actualización de estado detectada. GamePhase (Forzada): ${gamePhase}.`);
        
        if (!gamePhase || gamePhase === lastSpokenGamePhase) return;

        let adviceToSpeak = '';
        let priority = 'normal';

        if (gamePhase === 'ChampSelect') {
            adviceToSpeak = "Analizando selección de campeones. El coach Hextech está listo en pantalla.";
            priority = 'high';
        } else if (gamePhase === 'InProgress') {
            adviceToSpeak = "Partida en curso. Pulsa Control F1 para activar la interfaz, o Control F2 para el modo pasivo.";
            priority = 'normal';
        }

        if (adviceToSpeak) {
            // FIX CRÍTICO: Eliminados los backslashes innecesarios
            console.log(`[OverlayPage] 🎤 Intentando activar TTS para la fase: ${gamePhase}`);
            speak(adviceToSpeak, priority);
            setLastSpokenGamePhase(gamePhase);
        }
    }, [gamePhase, lastSpokenGamePhase]);

    // Fallback de renderizado para cada widget.
    const WidgetFallback = ({ name }) => (
        <div className="text-red-500 bg-black/80 p-2 rounded-md border border-red-500">
            Error al cargar el widget: {name}
        </div>
    );

    return (
        // El contenedor principal ahora solo controla la transparencia al click
        <div className={`h-full w-full bg-transparent ${isWidgetInteractive ? 'pointer-events-auto' : 'pointer-events-none'}`}>
            {/* Etiqueta de diagnóstico VISUAL (Fija en el centro) */}
            <p style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: 'lime', fontSize: '24px', textShadow: '0 0 5px black', zIndex: 9998 }}>
                [Overlay Activo - LCU Real: {realLcuPhase || "N/A"} **(Fase: {gamePhase})**]
            </p>

            {/* WIDGETS ENVUELTOS EN EL NUEVO DRAGANDSCALEWRAPPER */}
            
            {/* 1. Controles Globales (Fijos en la esquina superior izquierda, se ocultan en CTRL+F2) */}
            {isWidgetInteractive && (
                <div style={{ position: 'fixed', top: '20px', left: '20px', zIndex: 10000 }}>
                     <Suspense fallback={<WidgetFallback name="ControlsHUD" />}>
                        <ControlsHUD isInteractive={isWidgetInteractive} />
                    </Suspense>
                </div>
            )}
            
            {/* 2. Status HUD (No necesita drag, pero usa la info de fase) */}
            <DragAndScaleWidget widgetId="StatusHUD" defaultPosition={{ x: 100, y: 100 }}>
                <Suspense fallback={<WidgetFallback name="StatusHUD" />}>
                    <StatusHUD gamePhase={gamePhase} />
                </Suspense>
            </DragAndScaleWidget>
            

            {/* 3. Coach de Selección de Campeones */}
            {gamePhase === 'ChampSelect' && (
                <DragAndScaleWidget widgetId="ChampSelectCoach" defaultPosition={{ x: 500, y: 200 }}>
                    <Suspense fallback={<WidgetFallback name="ChampSelectCoach" />}>
                        <ChampSelectCoach 
                            champSelectData={lcuData?.gameflow}
                            isInteractive={isWidgetInteractive} 
                        />
                    </Suspense>
                </DragAndScaleWidget>
            )}

            {/* 4. Coach En Partida */}
            {gamePhase === 'InProgress' && (
                <DragAndScaleWidget widgetId="InGameCoach" defaultPosition={{ x: 100, y: 700 }}>
                    <Suspense fallback={<WidgetFallback name="InGameCoach" />}>
                        <InGameCoach 
                            liveData={lcuData?.liveData}
                            userData={userData}
                            isInteractive={isWidgetInteractive}
                        />
                    </Suspense>
                </DragAndScaleWidget>
            )}
        </div>
    );
}

// Exportación envuelta en el ScaleProvider
export default function OverlayPage() {
    return (
        <ScaleProvider>
            <OverlayContent />
        </ScaleProvider>
    );
}
