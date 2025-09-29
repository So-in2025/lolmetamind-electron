// src/app/overlay/page.jsx
"use client"

import React from 'react';
import { useInteractiveWidget } from '../../hooks/useInteractiveWidget'; 
import { useLcuData } from '../../hooks/useLcuData';

// Importamos TODOS los widgets que queremos mostrar
import ControlsHUD from '../../components/widgets/ControlsHUD';
import BuildsHUD from '../../components/widgets/BuildsHUD';
import StrategicHUD from '../../components/widgets/StrategicHUD';
import ChampSelectCoach from '../../components/widgets/ChampSelectCoach';
import InGameCoach from '../../components/widgets/InGameCoach';
import RealtimeCoachHUD from '../../components/widgets/RealtimeCoachHUD'; // El HUD que habla

export default function OverlayPage() {
    // Hook para la interactividad global (Alt+O)
    const { isWidgetInteractive } = useInteractiveWidget('global-overlay'); // Usamos un ID genérico
    
    // Hook para recibir los datos de la LCU en tiempo real
    const lcuData = useLcuData();

    // Clases para permitir o denegar clics en todo el overlay
    const containerClasses = `h-screen w-screen bg-transparent ${isWidgetInteractive ? 'pointer-events-auto' : 'pointer-events-none'}`;
    
    // Extraemos la fase del juego para decidir qué mostrar
    const gamePhase = lcuData?.lcuState?.gameflow?.phase;

    // --- LÓGICA DE DATOS PARA LOS WIDGETS ---
    // Aquí preparamos los datos y mensajes que cada widget necesitará
    
    const realtimeCoachProps = {
        message: "Esperando conexión con el cliente de LoL...",
        priority: "STATUS",
    };
    
    const buildsHUDProps = {
        build: lcuData?.lcuState?.buildRecommendation || null, // Asumimos que la IA enviará esto
    };

    const strategicHUDProps = {
        message: lcuData?.lcuState?.strategicAdvice || "Mantén la visión en objetivos clave.",
    };

    // Actualizamos los mensajes basados en la fase del juego
    if (gamePhase === 'ChampSelect') {
        realtimeCoachProps.message = "Analizando el draft. Revisa las recomendaciones de MetaMind.";
        realtimeCoachProps.priority = "ANALYSIS";
    } else if (gamePhase === 'InProgress') {
        realtimeCoachProps.message = "Partida en curso. Activa la 'R' de MetaMind para un impulso de IA.";
        realtimeCoachProps.priority = "ANALYSIS";
    }

    return (
        <div className={containerClasses}>
            
            {/* WIDGETS PERSISTENTES (Siempre visibles si hay datos) */}
            {lcuData && (
                <>
                    <ControlsHUD />
                    {/* Puedes decidir si estos HUDs se muestran siempre o solo en partida */}
                    {/* <BuildsHUD build={buildsHUDProps.build} /> */}
                    {/* <StrategicHUD message={strategicHUDProps.message} /> */}
                    {/* <RealtimeCoachHUD message={realtimeCoachProps.message} priority={realtimeCoachProps.priority} /> */}
                </>
            )}

            {/* WIDGETS CONTEXTUALES (Aparecen y desaparecen con la fase del juego) */}

            {/* Si estamos en Selección de Campeón, mostramos el coach de ChampSelect */}
            {gamePhase === 'ChampSelect' && (
                <ChampSelectCoach 
                    champSelectData={lcuData.lcuState.champSelect}
                    isInteractive={isWidgetInteractive} 
                />
            )}

            {/* Si estamos dentro del juego, mostramos el coach In-Game (con la "R") */}
            {gamePhase === 'InProgress' && (
                <InGameCoach 
                    liveClientDataStatus={lcuData.liveClientDataStatus}
                    isInteractive={isWidgetInteractive}
                />
            )}
        </div>
    );
}