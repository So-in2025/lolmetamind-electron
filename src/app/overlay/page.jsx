// src/app/overlay/page.jsx - VERSIÓN FINAL DE PRODUCCIÓN Y MONTAJE CORREGIDO
"use client"

import React, { useEffect, useState, Suspense } from 'react';
import { useInteractiveWidget } from '../../hooks/useInteractiveWidget'; 
import { useLcuData } from '../../hooks/useLcuData';
import { useAppState } from '@/context/AppStateContext';
import { ScaleProvider } from '@/context/ScaleContext';
import DragAndScaleWidget from '@/components/widgets/DragAndScaleWidget';

// Importamos los widgets usando React.lazy para carga diferida y fallback
const ControlsHUD = React.lazy(() => import('../../components/widgets/ControlsHUD'));
const ChampSelectCoach = React.lazy(() => import('../../components/widgets/ChampSelectCoach'));
const InGameCoach = React.lazy(() => import('../../components/widgets/InGameCoach'));
const StatusHUD = React.lazy(() => import('../../components/widgets/StatusHUD'));

// Función TTS (Solo para Coach AI)
const speak = (text, priority = 'normal') => {
  // Función vacía: El TTS SOLO se activa dentro de InGameCoach.jsx
  return; 
};

// Componente principal del Overlay (Envuelto en ScaleProvider en la exportación)
function OverlayContent() {
    console.log("[OverlayPage] 🟢 Montando componente...");
    
    const { isWidgetInteractive } = useInteractiveWidget('global-overlay'); 
    const lcuData = useLcuData();
    const { userData } = useAppState();
    
    let gamePhase = lcuData?.gameflow?.phase; 
    
    // Dejamos de forzar la fase para producción final (aunque los logs indican que el LCU sí detecta la fase).
    // Si la fase es inactiva, no renderizamos nada, confiando en el Hotkey.
    if (gamePhase === 'EndOfGame' || gamePhase === 'None' || !gamePhase) {
        gamePhase = null;
    }
    
    // Eliminamos todo el useEffect de pruebas y TTS genérico.
    
    const WidgetFallback = ({ name }) => (
        <div className="text-red-500 bg-black/80 p-2 rounded-md border border-red-500">
            Error al cargar el widget: {name}
        </div>
    );

    return (
        // FIX CRÍTICO: El contenedor principal es la ventana. 
        // Eliminamos el 'relative' innecesario y el texto de prueba.
        <div className={`h-full w-full bg-transparent ${isWidgetInteractive ? 'pointer-events-auto' : 'pointer-events-none'}`}>
            
            {/* El texto de prueba central ha sido ELIMINADO para el modo final */}
            
            {/* 1. Controles Globales (Fijos en la esquina superior izquierda) */}
            {isWidgetInteractive && (
                <div style={{ position: 'fixed', top: '20px', left: '20px', zIndex: 10000 }}>
                     <Suspense fallback={<WidgetFallback name="ControlsHUD" />}>
                        <ControlsHUD isInteractive={isWidgetInteractive} />
                    </Suspense>
                </div>
            )}
            
            {/* 2. Status HUD (Visible si hay fase activa) */}
            {gamePhase && (
                 <DragAndScaleWidget widgetId="StatusHUD" defaultPosition={{ x: 100, y: 100 }}>
                    <Suspense fallback={<WidgetFallback name="StatusHUD" />}>
                        <StatusHUD gamePhase={gamePhase} />
                    </Suspense>
                </DragAndScaleWidget>
            )}
            

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

            {/* 4. Coach En Partida (TTS de IA) */}
            {gamePhase === 'InProgress' && (
                <DragAndScaleWidget widgetId="InGameCoach" defaultPosition={{ x: 100, y: 700 }}>
                    <Suspense fallback={<WidgetFallback name="InGameCoach" />}>
                        {/* El InGameCoach ahora contiene la lógica de llamada a la IA y TTS */}
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
