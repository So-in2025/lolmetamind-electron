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
    const { speak } = useTTS(); // Hook TTS (ahora es la API de Hugging Face)

    // ---------------------------------------------------
    // 🎙️ Reproducir mensajes TTS según la fase de partida
    // ---------------------------------------------------
    useEffect(() => {
        if (!gamePhase) return; // evitamos TTS vacío

        console.log('[OverlayPage] 🔄 Fase de partida actualizada:', gamePhase);

        // Mensaje de inicio de fase (TTS)
        let ttsMessage = '';
        switch (gamePhase) {
            case 'Lobby':
            case 'Matchmaking':
            case 'ReadyCheck':
                ttsMessage = 'Analizando tu cola. Preparando consejos de perfil.';
                break;
            case 'ChampSelect':
                ttsMessage = 'Atención, fase de selección de campeones. Analizando el draft.';
                break;
            case 'InProgress':
                ttsMessage = 'Partida en curso. El coach en vivo está activado.';
                break;
            case 'WaitingForStats':
            case 'EndOfGame':
                ttsMessage = 'Partida terminada. Desactivando coach en vivo.';
                break;
            default:
                break;
        }

        if (ttsMessage) {
            // 🎤 LOG PRO-DEV: Reproducción automática al cambiar de fase
            console.log(`[OverlayPage] 🔊 Reproduciendo mensaje de fase: ${ttsMessage}`);
            speak(ttsMessage);
        }

    }, [gamePhase, speak]);


    // ---------------------------------------------------
    // 🖥️ Determinar qué widget renderizar
    // ---------------------------------------------------
    const CurrentWidget = useMemo(() => {
        switch (gamePhase) {
            case 'ChampSelect':
                return <ChampSelectCoach draftData={draftData} LCU_STATUS={LCU_STATUS} userData={userData} />;
            case 'InProgress':
                return <InGameCoach liveData={liveData} LCU_STATUS={LCU_STATUS} userData={userData} />;
            case 'Lobby':
            case 'Matchmaking':
            case 'ReadyCheck':
            case 'None': // Si estamos fuera de partida, pero en el cliente
                // Renderizar el coach de pre-juego si hay datos del cliente, si no, un estado vacío.
                if (LCU_STATUS === 'ONLINE') {
                    return <PreGameCoach LCU_STATUS={LCU_STATUS} userData={userData} />;
                }
                return (
                    <div className="text-center p-4 rounded-xl bg-lol-blue-dark max-w-xs text-lol-gold-light border border-lol-gold-dark">
                        <FaSync className="animate-spin mx-auto mb-2" size={24} />
                        <p className="font-bold">Esperando al cliente de LoL</p>
                        <p className="text-xs">Abre el cliente para activar el coach.</p>
                    </div>
                );
            default:
                return (
                    <div className="text-center p-4 rounded-xl bg-lol-blue-dark max-w-xs text-lol-gold-light border border-lol-gold-dark">
                        <FaSync className="animate-spin mx-auto mb-2" size={24} />
                        <p className="font-bold">Fase {gamePhase} desconocida.</p>
                        <p className="text-xs">Coach en modo de espera.</p>
                    </div>
                );
        }
    }, [gamePhase, draftData, LCU_STATUS, userData, liveData]);


    // ---------------------------------------------------
    // ⚙️ Renderizado del Overlay
    // ---------------------------------------------------
    return (
        <div className="w-screen h-screen relative overflow-hidden" style={{ WebkitAppRegion: 'drag' }}>
            
            {/* Barra de estado y Controles */}
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