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
    // Asumo que useLcuData ahora expone 'liveData', crucial para InGameCoach.
    const { gamePhase, draftData, LCU_STATUS, userData, liveData } = useLcuData();
    const { isInteractive, setInteractive } = useInteractiveWidget(false); 
    
    // Ya no se necesita `useAppState` aquí.

    const CurrentWidget = useMemo(() => {
        // --- LOGS DE DEPURACIÓN ---
        console.log('[OVERLAY] Evaluando widget. Estado actual:');
        console.log(` -> LCU_STATUS: ${LCU_STATUS}`);
        console.log(` -> userData:`, userData);
        console.log(` -> gamePhase: ${gamePhase}`);
        
        // 1. CONDICIÓN DE CORTE: Si LCU está OFFLINE o no tenemos datos base, no renderizamos widgets.
        if (LCU_STATUS === 'OFFLINE' || !userData) {
            console.log('[OVERLAY] Condición de corte: LCU offline o no hay datos de usuario.');
            return null;
        }
        
        // 🚨 FIX FINAL: Montamos el widget incondicionalmente basado en la FASE DETECTADA.
        switch (gamePhase) {
            case 'Lobby':
            case 'Matchmaking':
            case 'ReadyCheck':
                console.log('[OVERLAY] RENDER: PreGameCoach');
                return <PreGameCoach LCU_STATUS={LCU_STATUS} userData={userData} />;
                
            case 'ChampSelect':
                // 💎 MONTAJE INCONDICIONAL: El widget se monta y maneja el estado de carga (null draftData)
                console.log('[OVERLAY] RENDER: ChampSelectCoach (Incondicionalmente montado)');
                return <ChampSelectCoach draftData={draftData} LCU_STATUS={LCU_STATUS} userData={userData} />;
                
            case 'InProgress':
                // 💎 MONTAJE INCONDICIONAL: El widget se monta y recibe liveData para su activación
                console.log('[OVERLAY] RENDER: InGameCoach (Incondicionalmente montado)');
                return <InGameCoach LCU_STATUS={LCU_STATUS} userData={userData} liveData={liveData} />; // CRÍTICO: Pasa liveData
                
            default:
                console.log(`[OVERLAY] RENDER: Nulo (gamePhase '${gamePhase}' no reconocido)`);
                return null;
        }
    }, [gamePhase, draftData, LCU_STATUS, userData, liveData]); // 'liveData' debe estar en las dependencias.

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

// Nota: Asegúrate de que este CoachContainer está siendo exportado y usado
// como el componente principal en tu src/app/overlay/page.jsx (o donde corresponda).

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