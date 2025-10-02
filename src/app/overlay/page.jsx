'use client';
import React, { useMemo } from 'react';
import { useLcuData } from '@/hooks/useLcuData';
import { useInteractiveWidget } from '@/hooks/useInteractiveWidget';
import PreGameCoach from '@/components/widgets/PreGameCoach';
import ChampSelectCoach from '@/components/widgets/ChampSelectCoach';
import InGameCoach from '@/components/widgets/InGameCoach';
import { FaWifi, FaTools, FaSync } from 'react-icons/fa';
import { AppStateProvider, useAppState } from '@/context/AppStateContext';
import { ScaleProvider } from '@/context/ScaleContext';

function CoachContainer() {
    const { gamePhase, draftData, LCU_STATUS } = useLcuData();
    const { isInteractive, setInteractive } = useInteractiveWidget(false);
    const { isLoadingUser, userData } = useAppState();

    // 3. Lógica de renderizado condicional de Fases
    const CurrentWidget = useMemo(() => {
        if (isLoadingUser || LCU_STATUS === 'OFFLINE' || !userData) {
            return null;
        }

        // 🚨 Flujo de Coaching Completo de Producción 🚨
        switch (gamePhase) {
            case 'Matchmaking':
            case 'ReadyCheck':
                return <PreGameCoach LCU_STATUS={LCU_STATUS} />;
            case 'ChampSelect':
                if (draftData) {
                    return <ChampSelectCoach draftData={draftData} LCU_STATUS={LCU_STATUS} />;
                }
                return null;
            case 'InProgress':
                return <InGameCoach LCU_STATUS={LCU_STATUS} />;
            default:
                return null;
        }
    }, [gamePhase, draftData, LCU_STATUS, isLoadingUser, userData]);

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
                {isLoadingUser ? (
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
    return (
        <AppStateProvider>
            <ScaleProvider>
                <CoachContainer />
            </ScaleProvider>
        </AppStateProvider>
    );
}