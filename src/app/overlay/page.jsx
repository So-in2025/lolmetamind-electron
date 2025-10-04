// src/app/overlay/page.jsx
'use client';
import React, { useMemo, useEffect } from 'react';
import { useLcuData } from '@/hooks/useLcuData';
import { useInteractiveWidget } from '@/hooks/useInteractiveWidget';
import PreGameCoach from '@/components/widgets/PreGameCoach'; 
import ChampSelectCoach from '@/components/widgets/ChampSelectCoach';
import InGameCoach from '@/components/widgets/InGameCoach'; 
import { FaWifi, FaTools, FaSync } from 'react-icons/fa';
import { AppStateProvider } from '@/context/AppStateContext';
import { ScaleProvider } from '@/context/ScaleContext';
import { useTTS } from '@/hooks/useTTS'; // <-- Hook TTS

function CoachContainer() {
    const { gamePhase, draftData, LCU_STATUS, userData, liveData } = useLcuData();
    const { isInteractive, setInteractive } = useInteractiveWidget(false);
    const { speak } = useTTS(); // <-- TTS

    // Reproducir mensaje cuando cambia la fase de la partida
    useEffect(() => {
        if (!userData) return;

        console.log('[OverlayPage] Fase de partida actualizada:', gamePhase);

        switch (gamePhase) {
            case 'Lobby':
            case 'Matchmaking':
            case 'ReadyCheck':
                speak('Preparando estrategia previa a la partida.', 'alloy', 1.0);
                break;
            case 'ChampSelect':
                speak('Comienza la selección de campeones. Analizando draft...', 'alloy', 1.0);
                break;
            case 'InProgress':
                speak('La partida ha iniciado. Coach activado.', 'alloy', 1.0);
                break;
            default:
                console.log('[OverlayPage] Fase no reconocida para TTS:', gamePhase);
        }
    }, [gamePhase, userData, speak]);

    const CurrentWidget = useMemo(() => {
        if (LCU_STATUS === 'OFFLINE' || !userData) {
            console.log('[OverlayPage] LCU offline o userData ausente, no se renderiza widget');
            return null;
        }

        switch (gamePhase) {
            case 'Lobby':
            case 'Matchmaking':
            case 'ReadyCheck':
                return <PreGameCoach LCU_STATUS={LCU_STATUS} userData={userData} />;
            case 'ChampSelect':
                return <ChampSelectCoach draftData={draftData} LCU_STATUS={LCU_STATUS} userData={userData} />;
            case 'InProgress':
                return <InGameCoach LCU_STATUS={LCU_STATUS} userData={userData} liveData={liveData} />;
            default:
                return null;
        }
    }, [gamePhase, draftData, LCU_STATUS, userData, liveData]);

    const baseClass = "absolute inset-0 transition-all duration-300";

    return (
        <div 
            className={`${baseClass} ${isInteractive ? 'pointer-events-auto' : 'pointer-events-none'}`}
            style={{ backgroundColor: isInteractive ? 'rgba(0, 0, 0, 0.1)' : 'transparent' }}
        >
            <div 
                className={`absolute top-4 left-4 p-2 rounded-full ${isInteractive ? 'cursor-default' : 'pointer-events-auto'} bg-lol-blue-medium/90 text-lol-gold-light flex items-center shadow-xl`}
                onMouseEnter={() => setInteractive(true)}
                onMouseLeave={() => setInteractive(false)}
            >
                {!userData ? (
                    <FaSync className="animate-spin mr-2" />
                ) : (
                    <FaWifi className={`mr-2 ${LCU_STATUS === 'ONLINE' ? 'text-lol-blue-accent' : 'text-red-500'}`} />
                )}
                <span className="text-sm font-bold">{LCU_STATUS} | {gamePhase}</span>
                {isInteractive && <FaTools title="Controles (Interactivos)" className="ml-2 text-lol-gold" />}
            </div>

            <div className="w-full h-full flex justify-center items-center p-12">
                {CurrentWidget}
            </div>
        </div>
    );
}

export default function OverlayPage() {
    return (
        <AppStateProvider>
            <ScaleProvider>
                <CoachContainer />
            </ScaleProvider>
        </AppStateProvider>
    );
}
