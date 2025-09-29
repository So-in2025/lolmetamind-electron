// src/app/overlay/page.jsx
"use client"
import React from 'react';
import { useInteractiveWidget } from '../../hooks/useInteractiveWidget'; 
import { useLcuData } from '../../hooks/useLcuData'; // <-- 1. IMPORTA EL HOOK DE DATOS
import UnifiedHUD from '../../components/widgets/UnifiedHUD';
// (Opcional) Puedes importar componentes específicos si quieres más control aquí
import ChampSelectCoach from '../../components/widgets/ChampSelectCoach'; // <-- COMPONENTE A CREAR
import InGameCoach from '../../components/widgets/InGameCoach';       // <-- COMPONENTE A CREAR

export default function OverlayPage() {
    const { isWidgetInteractive } = useInteractiveWidget();
    const lcuData = useLcuData(); // <-- 2. USA EL HOOK PARA RECIBIR DATOS LCU

    const containerClasses = `h-screen w-screen bg-transparent ${isWidgetInteractive ? 'pointer-events-auto' : 'pointer-events-none'}`;
    
    // Extraemos la fase del juego para decidir qué mostrar
    const gamePhase = lcuData?.lcuState?.gameflow?.phase;

    return (
        <div className={containerClasses}>
            
            {/* 
                RENDERIZADO CONDICIONAL:
                Ahora, el overlay solo mostrará contenido cuando la fase del juego sea relevante.
                Esto previene que el overlay aparezca vacío o con contenido incorrecto en el lobby.
            */}

            {/* Si estamos en Selección de Campeón, mostramos el coach de ChampSelect */}
            {gamePhase === 'ChampSelect' && (
                <ChampSelectCoach 
                    champSelectData={lcuData.lcuState.champSelect}
                    isInteractive={isWidgetInteractive} 
                />
            )}

            {/* Si estamos dentro del juego, mostramos el coach In-Game (con la "R Definitiva") */}
            {gamePhase === 'InProgress' && (
                <InGameCoach 
                    // No tenemos datos de liveclientdata, pero podemos pasar el estado de Vanguard
                    liveClientDataStatus={lcuData.liveClientDataStatus}
                    isInteractive={isWidgetInteractive}
                />
            )}
            
            {/* 
                NOTA: El componente UnifiedHUD podría seguir siendo útil como un layout 
                que envuelve a ChampSelectCoach y InGameCoach si comparten estilos o 
                posicionamiento, pero para mayor claridad, los he separado aquí.
            */}
        </div>
    );
}