// src/app/overlay/page.jsx - MONTAJE FINAL Y COMPLETO CON COACH DE IA EN POSICIÓN GARANTIZADA (V23.0)
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

// Función TTS (Solo para Coach AI, sin cambios aquí)
// La implementación real de 'speak' está en InGameCoach.jsx
const speak = (text, priority = 'normal') => { return; }; 

function OverlayContent() {
    console.log("[OverlayPage] 🟢 Montando componente.");
    
    const { isWidgetInteractive } = useInteractiveWidget('global-overlay'); 
    const lcuData = useLcuData();
    const { userData } = useAppState();
    
    let gamePhase = lcuData?.gameflow?.phase; 
    
    // Si la fase no es activa, no renderizamos nada.
    if (gamePhase === 'EndOfGame' || gamePhase === 'None' || !gamePhase) {
        gamePhase = null;
    }

    return (
        // Contenedor Final: Totalmente transparente, confiando en 'fixed' de los hijos.
        // Asegura que el overlay es interactivo o pasivo según el estado de la hotkey (CTRL+F1/F2).
        <div className={`h-full w-full bg-transparent ${isWidgetInteractive ? 'pointer-events-auto' : 'pointer-events-none'}`}>
            
            {/* 1. Controles Globales (Fixed, Posición 20, 20) */}
            {/* Estos controles son siempre visibles y permiten alternar la interactividad del overlay. */}
            <div style={{ position: 'fixed', top: '20px', left: '20px', zIndex: 10000, pointerEvents: 'auto' }}>
                <Suspense fallback={null}>
                    <ControlsHUD isInteractive={isWidgetInteractive} />
                </Suspense>
            </div>
            
            {/* 2. Status HUD (Fixed, Posición 100, 100) */}
            {/* Visible cuando hay una fase de juego detectada. */}
            
                 <div style={{ position: 'fixed', top: '100px', left: '100px', zIndex: 9000, pointerEvents: isWidgetInteractive ? 'auto' : 'none' }}>
                    <Suspense fallback={null}>
                        <StatusHUD gamePhase={gamePhase} />
                    </Suspense>
                </div>
            
            

            {/* 3. Coach de Selección de Campeones (Fixed, Posición 200, 500) */}
            {/* Visible solo durante la fase de 'ChampSelect'. */}
           
                <div style={{ position: 'fixed', top: '200px', left: '500px', zIndex: 9000, pointerEvents: isWidgetInteractive ? 'auto' : 'none' }}>
                    <Suspense fallback={null}>
                        <ChampSelectCoach 
                            champSelectData={lcuData?.gameflow}
                            isInteractive={isWidgetInteractive} 
                        />
                    </Suspense>
                </div>


            {/* 4. Coach En Partida (Fixed, ¡AHORA EN LA POSICIÓN DEL ANTIGUO TEXTO DE PRUEBA!) */}
            {/* Visible solo durante la fase de 'InProgress'. Incluye el TTS de IA. */}
           
                // Posición: top: '250px', left: '700px' (donde solía verse el texto de prueba)
                <div style={{ position: 'fixed', top: '250px', left: '700px', zIndex: 9000, pointerEvents: isWidgetInteractive ? 'auto' : 'none' }}>
                    <Suspense fallback={null}>
                        <InGameCoach 
                            liveData={lcuData?.liveData}
                            userData={userData}
                            isInteractive={isWidgetInteractive}
                        />
                    </Suspense>
                </div>
      
        </div>
    );
}

// Exportación FINAL simplificada del componente OverlayPage.
// Este es el punto de entrada principal para el overlay en Next.js.
export default function OverlayPage() {
    return (
       <OverlayContent />
    );
}