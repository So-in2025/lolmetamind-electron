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
    // 🛑 CRÍTICO: gamePhase viene de useLcuData
    const { gamePhase, draftData, LCU_STATUS, userData, liveData } = useLcuData(); 
    const { isInteractive, setInteractive } = useInteractiveWidget(false);
    const { speak } = useTTS(); 

    // ---------------------------------------------------
    // 🎙️ SE ELIMINA EL TTS AUTOMÁTICO AL CAMBIAR DE FASE (Audio Artefacto)
    // ---------------------------------------------------
    /* // ELIMINAR ESTE BLOQUE COMPLETO DE TTS AUTOMÁTICO DEL ARCHIVO ORIGINAL
    useEffect(() => {
        // ... Lógica que llama a speak(ttsMessage)
    }, [gamePhase, speak]);
    */


    // ---------------------------------------------------
    // 🖥️ Determinar qué widget renderizar
    // ---------------------------------------------------
    const CurrentWidget = useMemo(() => {
        // Definir las fases donde el Coach Pre-Game debe estar visible y activo
        const PRE_GAME_PHASES = ['Lobby', 'Matchmaking', 'ReadyCheck'];
        
        switch (gamePhase) {
            case 'ChampSelect':
                return <ChampSelectCoach draftData={draftData} LCU_STATUS={LCU_STATUS} userData={userData} />;
            case 'InProgress':
                return <InGameCoach liveData={liveData} LCU_STATUS={LCU_STATUS} userData={userData} />;
                
            // Fases donde se espera el consejo PRE-GAME (Lobby, Matchmaking, ReadyCheck)
            case 'Lobby':
            case 'Matchmaking':
            case 'ReadyCheck':
                // 🔑 CORRECCIÓN REPETICIÓN: Se pasa gamePhase como prop para el reset en PreGameCoach
                return <PreGameCoach LCU_STATUS={LCU_STATUS} userData={userData} gamePhase={gamePhase} />;
            
            // Fases donde NO debe haber un widget de juego activo
            case 'None': // Pantalla principal del cliente
            case 'EndOfGame':
            case 'WaitingForStats':
                // Si la fase es irrelevante, no mostramos nada (return null)
                // A menos que LCU_STATUS esté OFFLINE, que se maneja abajo.
                if (LCU_STATUS === 'ONLINE') {
                    return (
                        <div className="text-center p-4 rounded-xl bg-lol-blue-dark max-w-xs text-lol-gold-light border border-lol-gold-dark">
                            <FaSync className="animate-spin mx-auto mb-2" size={24} />
                            <p className="font-bold">Cliente en línea</p>
                            <p className="text-xs">Esperando a que inicies una cola o selección de campeón.</p>
                        </div>
                    );
                }
                return null; // Ocultar el widget completamente si no hay fase de juego activa
                
            default:
                // Si el LCU está OFFLINE, mostrar el estado de error/espera del cliente.
                if (LCU_STATUS === 'OFFLINE') {
                    return (
                        <div className="text-center p-4 rounded-xl bg-lol-blue-dark max-w-xs text-lol-gold-light border border-lol-gold-dark">
                            <FaSync className="animate-spin mx-auto mb-2" size={24} />
                            <p className="font-bold">Esperando al cliente de LoL</p>
                            <p className="text-xs">Abre el cliente para activar el coach.</p>
                        </div>
                    );
                }
                // Manejar cualquier otra fase desconocida
                return null;
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