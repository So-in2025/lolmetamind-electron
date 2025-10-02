// src/app/overlay/page.jsx - VERSIÓN CORREGIDA
'use client';
import React, { useMemo } from 'react';
import { useLcuData } from '@/hooks/useLcuData';
import { useInteractiveWidget } from '@/hooks/useInteractiveWidget';
import PreGameCoach from '@/components/widgets/PreGameCoach'; 
import ChampSelectCoach from '@/components/widgets/ChampSelectCoach';
import InGameCoach from '@/components/widgets/InGameCoach'; 
import { FaWifi, FaTools, FaSync } from 'react-icons/fa';
import { AppStateProvider } from '@/context/AppStateContext';
import { ScaleProvider } from '@/context/ScaleContext';

function CoachContainer() {
    // 1. Obtenemos todos los datos necesarios, incluyendo 'userData', desde el hook central.
    const { gamePhase, draftData, LCU_STATUS, userData } = useLcuData();
    const { isInteractive, setInteractive } = useInteractiveWidget(false); 
    
    // Ya no se necesita `useAppState` aquí.

    const CurrentWidget = useMemo(() => {
        // --- LOGS DE DEPURACIÓN ---
        console.log('[OVERLAY] Evaluando widget. Estado actual:');
        console.log(` -> LCU_STATUS: ${LCU_STATUS}`);
        console.log(` -> userData:`, userData);
        console.log(` -> gamePhase: ${gamePhase}`);
        
        // La condición de corte ahora funcionará porque 'userData' llegará con el sondeo.
        if (LCU_STATUS === 'OFFLINE' || !userData) {
            console.log('[OVERLAY] Condición de corte: LCU offline o no hay datos de usuario. No se muestra ningún widget.');
            return null;
        }
        
        // 🚨 CAMBIO CLAVE: Pasamos 'userData' como prop a cada widget.
        switch (gamePhase) {
            case 'Lobby':
            case 'Matchmaking':
            case 'ReadyCheck':
                console.log('[OVERLAY] RENDER: PreGameCoach');
                return <PreGameCoach LCU_STATUS={LCU_STATUS} userData={userData} />;
            case 'ChampSelect':
                if (draftData) {
                    console.log('[OVERLAY] RENDER: ChampSelectCoach');
                    return <ChampSelectCoach draftData={draftData} LCU_STATUS={LCU_STATUS} userData={userData} />;
                }
                return null;
            case 'InProgress':
                console.log('[OVERLAY] RENDER: InGameCoach');
                return <InGameCoach LCU_STATUS={LCU_STATUS} userData={userData} />;
            default:
                console.log(`[OVERLAY] RENDER: Nulo (gamePhase '${gamePhase}' no reconocido)`);
                return null;
        }
    }, [gamePhase, draftData, LCU_STATUS, userData]); // 'userData' está en las dependencias.

    const baseClass = "absolute inset-0 transition-all duration-300";

    return (
        <div 
            className={`${baseClass} ${isInteractive ? 'pointer-events-auto' : 'pointer-events-none'}`}
            style={{ backgroundColor: isInteractive ? 'rgba(0, 0, 0, 0.1)' : 'transparent' }}
        >
            {/* Widget de Estado (Control de Interacción) */}
            <div 
                className={`absolute top-4 left-4 p-2 rounded-full ${isInteractive ? 'cursor-default' : 'pointer-events-auto'} bg-lol-blue-medium/90 text-lol-gold-light flex items-center shadow-xl`}
                onMouseEnter={() => setInteractive(true)}
                onMouseLeave={() => setInteractive(false)}
            >
                {/* La lógica de carga ahora se basa en si tenemos 'userData' */}
                {!userData ? (
                    <FaSync className="animate-spin mr-2" />
                ) : (
                    <FaWifi className={`mr-2 ${LCU_STATUS === 'ONLINE' ? 'text-lol-blue-accent' : 'text-red-500'}`} />
                )}
                <span className="text-sm font-bold">{LCU_STATUS} | {gamePhase}</span>
                {isInteractive && (
                    <FaTools title="Controles (Interactivos)" className="ml-2 text-lol-gold" />
                )}
            </div>
            
            {/* Contenedor de Widget Activo */}
            <div className="w-full h-full flex justify-center items-center p-12">
                {CurrentWidget}
            </div>
        </div>
    );
}

export default function OverlayPage() {
    // Aunque CoachContainer ya no usa AppState directamente, los widgets hijos sí lo hacen.
    // Mantenemos AppStateProvider aquí para que toda la aplicación tenga acceso al contexto.
    return (
        <AppStateProvider> 
            <ScaleProvider>
                <CoachContainer />
            </ScaleProvider>
        </AppStateProvider>
    );
}