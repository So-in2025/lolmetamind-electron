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
import { useTTS } from '@/hooks/useTTS'; // <-- Hook TTS personalizado

// =======================================================
// COMPONENTE PRINCIPAL DEL OVERLAY (COACH CONTAINER)
// =======================================================
function CoachContainer() {
    const { gamePhase, draftData, LCU_STATUS, userData, liveData } = useLcuData();
    const { isInteractive, setInteractive } = useInteractiveWidget(false);
    const { speak } = useTTS(); // Hook TTS

    // ---------------------------------------------------
    // 🎙️ Reproducir mensajes TTS según la fase de partida
    // ---------------------------------------------------
    useEffect(() => {
        if (!gamePhase) return; // evitamos TTS vacío

        console.log('[OverlayPage] 🔄 Fase de partida actualizada:', gamePhase);

        switch (gamePhase) {
            case 'Lobby':
            case 'Matchmaking':
            case 'ReadyCheck':
                speak('Preparando estrategia previa a la partida.', 'alloy', 1.0);
                break;

            case 'ChampSelect':
                if (userData)
                    speak('Comienza la selección de campeones. Analizando draft...', 'alloy', 1.0);
                break;

            case 'InProgress':
                if (userData)
                    speak('La partida ha iniciado. Coach activado.', 'alloy', 1.0);
                break;

            default:
                console.log('[OverlayPage] ⚠️ Fase no reconocida para TTS:', gamePhase);
        }
    }, [gamePhase, userData, speak]);

    // ---------------------------------------------------
    // 🧩 Render dinámico del widget según la fase
    // ---------------------------------------------------
    const CurrentWidget = useMemo(() => {
        if (LCU_STATUS === 'OFFLINE') {
            console.log('[OverlayPage] 🚫 LCU OFFLINE: no se renderiza ningún widget');
            return null;
        }

        switch (gamePhase) {
            // ===============================
            // 🔹 Fases previas a la partida
            // ===============================
            case 'Lobby':
            case 'Matchmaking':
            case 'ReadyCheck':
                // Permite renderizar PreGameCoach aunque userData sea null
                console.log('[OverlayPage] 🧭 Renderizando PreGameCoach');
                return (
                    <PreGameCoach
                        LCU_STATUS={LCU_STATUS}
                        userData={userData || null}
                        liveData={liveData || null}
                    />
                );

            // ===============================
            // 🔹 Selección de campeones
            // ===============================
            case 'ChampSelect':
                if (!userData) {
                    console.log('[OverlayPage] ⚠️ Sin userData: no se renderiza ChampSelectCoach');
                    return null;
                }
                console.log('[OverlayPage] 🧠 Renderizando ChampSelectCoach');
                return (
                    <ChampSelectCoach
                        draftData={draftData}
                        LCU_STATUS={LCU_STATUS}
                        userData={userData}
                    />
                );

            // ===============================
            // 🔹 Partida en curso
            // ===============================
            case 'InProgress':
                if (!userData) {
                    console.log('[OverlayPage] ⚠️ Sin userData: no se renderiza InGameCoach');
                    return null;
                }
                console.log('[OverlayPage] 🕹️ Renderizando InGameCoach');
                return (
                    <InGameCoach
                        LCU_STATUS={LCU_STATUS}
                        userData={userData}
                        liveData={liveData}
                    />
                );

            // ===============================
            // 🔹 Cualquier otro estado
            // ===============================
            default:
                console.log('[OverlayPage] ℹ️ Ningún widget aplicable para:', gamePhase);
                return null;
        }
    }, [gamePhase, draftData, LCU_STATUS, userData, liveData]);

    // ---------------------------------------------------
    // 🧰 Overlay Base + Botón Interactivo
    // ---------------------------------------------------
    const baseClass = "absolute inset-0 transition-all duration-300";

    return (
        <div 
            className={`${baseClass} ${isInteractive ? 'pointer-events-auto' : 'pointer-events-none'}`}
            style={{ backgroundColor: isInteractive ? 'rgba(0, 0, 0, 0.1)' : 'transparent' }}
        >
            {/* Indicador de estado LCU */}
            <div 
                className={`absolute top-4 left-4 p-2 rounded-full ${isInteractive ? 'cursor-default' : 'pointer-events-auto'} bg-lol-blue-medium/90 text-lol-gold-light flex items-center shadow-xl`}
                onMouseEnter={() => setInteractive(true)}
                onMouseLeave={() => setInteractive(false)}
            >
                {/* Spinner si no hay userData aún */}
                {!userData ? (
                    <FaSync className="animate-spin mr-2" />
                ) : (
                    <FaWifi className={`mr-2 ${LCU_STATUS === 'ONLINE' ? 'text-lol-blue-accent' : 'text-red-500'}`} />
                )}

                <span className="text-sm font-bold">
                    {LCU_STATUS} | {gamePhase || 'Desconocido'}
                </span>

                {isInteractive && (
                    <FaTools title="Controles (Interactivos)" className="ml-2 text-lol-gold" />
                )}
            </div>

            {/* Contenedor central para widgets */}
            <div className="w-full h-full flex justify-center items-center p-12">
                {CurrentWidget}
            </div>
        </div>
    );
}

// =======================================================
// EXPORT PRINCIPAL (CONTEXTOS GLOBALES)
// =======================================================
export default function OverlayPage() {
    return (
        <AppStateProvider>
            <ScaleProvider>
                <CoachContainer />
            </ScaleProvider>
        </AppStateProvider>
    );
}
