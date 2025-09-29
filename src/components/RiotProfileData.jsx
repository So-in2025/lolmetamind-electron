// src/components/RiotProfileData.jsx

"use client";

import React from 'react';
import useRiotProfileData from '@/hooks/useRiotProfileData'; 
import { ExclamationTriangleIcon, CheckCircleIcon, ArrowPathIcon, TrophyIcon, ShieldExclamationIcon, PuzzlePieceIcon, ClockIcon } from '@heroicons/react/24/solid';

const Card = ({ title, children, icon: Icon, status = 'info' }) => {
    const statusClasses = {
        success: 'border-green-500 bg-green-900/20',
        error: 'border-red-500 bg-red-900/20',
        warning: 'border-yellow-500 bg-yellow-900/20',
        info: 'border-blue-500 bg-blue-900/20',
    };
    return (
        <div className={`p-4 rounded-lg shadow-xl border ${statusClasses[status]} transition-shadow hover:shadow-2xl bg-[#1A2328]`}>
            <div className="flex items-center space-x-3 mb-3">
                <Icon className={`w-6 h-6 ${status === 'success' ? 'text-green-400' : status === 'error' ? 'text-red-400' : 'text-[#C89B3C]'}`} />
                <h3 className="text-lg font-bold text-[#F0E6D2]">{title}</h3>
            </div>
            {children}
        </div>
    );
};

const RiotProfileData = () => {
    const data = useRiotProfileData();

    // Diagnóstico de Fallos 403 (Basado en el log que nos diste)
    const isRankDataBlocked = data.mode === 'Strategic_API_Profile' && data.summonerRankData.length === 0;
    const isMasteryBlocked = data.mode === 'Strategic_API_Profile' && data.championMasteries.length === 0;
    const isChallengesBlocked = data.mode === 'Strategic_API_Profile' && data.challengesPlayerInfo === null;
    const isTftBlocked = data.mode === 'Strategic_API_Profile' && data.tftLeagueData.length === 0;
    
    // Diagnóstico de Éxito
    const isMatchHistoryAvailable = data.matchHistory && data.matchHistory.length > 0;
    const isTimelineAvailable = data.matchTimeline !== null;
    const isServiceStatusOk = data.serviceStatus !== null && data.serviceStatus.services && data.serviceStatus.services.length > 0;

    const getRankDisplay = (rankData) => {
        if (rankData.length === 0) return "UNRANKED / No data";
        
        const soloQ = rankData.find(e => e.queueType === 'RANKED_SOLO_5x5');
        if (soloQ) {
            return `${soloQ.tier} ${soloQ.rank} (${soloQ.leaguePoints} LP)`;
        }
        return "No SoloQ data";
    };

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-[#F0E6D2] border-b border-[#C89B3C]/50 pb-2">
                Estatus de Adquisición de Datos
            </h2>

            {/* 1. Estatus General */}
            <Card title="Estatus de Conexión" icon={ArrowPathIcon} status={data.mode === 'LCU_ACTIVE' ? 'warning' : 'success'}>
                <p className="text-lol-light/80">
                    Modo: <span className={`font-bold ${data.mode === 'LCU_ACTIVE' ? 'text-yellow-400' : 'text-green-400'}`}>{data.mode}</span>
                </p>
                {data.mode === 'LCU_ACTIVE' && (
                    <p className="text-yellow-300">LCU Activo: Juego en curso. Análisis de Estrategia AI pausado.</p>
                )}
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* 2. Bloque de Clasificación (Ligas) */}
                <Card 
                    title="Clasificación (League-V4)" 
                    icon={TrophyIcon} 
                    status={isRankDataBlocked ? 'error' : data.summonerRankData.length > 0 ? 'success' : 'info'}
                >
                    <p className={`text-xl font-extrabold ${isRankDataBlocked ? 'text-red-400' : 'text-[#C89B3C]'}`}>
                        {isRankDataBlocked ? "BLOQUEADO (ERROR 403)" : getRankDisplay(data.summonerRankData)}
                    </p>
                    {isRankDataBlocked && (
                        <p className="text-red-300 text-sm mt-1">Acceso a Ligas restringido en API de Desarrollo.</p>
                    )}
                </Card>

                {/* 3. Bloque de Maestrías */}
                <Card 
                    title="Maestrías (Mastery-V4)" 
                    icon={ShieldExclamationIcon}
                    status={isMasteryBlocked ? 'error' : data.championMasteries.length > 0 ? 'success' : 'info'}
                >
                    <p className={`font-bold ${isMasteryBlocked ? 'text-red-400' : 'text-[#C89B3C]'}`}>
                         {isMasteryBlocked ? "BLOQUEADO (ERROR 403)" : `Top ${data.championMasteries.length} Campeones`}
                    </p>
                    {isMasteryBlocked && (
                         <p className="text-red-300 text-sm mt-1">Restringido en API de Desarrollo.</p>
                    )}
                </Card>
                
                 {/* 4. Bloque de Desafíos */}
                <Card 
                    title="Desafíos (Challenges-V1)" 
                    icon={PuzzlePieceIcon}
                    status={isChallengesBlocked ? 'error' : 'info'}
                >
                    <p className={`font-bold ${isChallengesBlocked ? 'text-red-400' : 'text-[#C89B3C]'}`}>
                         {isChallengesBlocked ? "BLOQUEADO (ERROR 403)" : `Data no disponible`}
                    </p>
                    {isChallengesBlocked && (
                         <p className="text-red-300 text-sm mt-1">Acceso a Desafíos restringido.</p>
                    )}
                </Card>
            </div>

            <h2 className="text-2xl font-bold text-[#F0E6D2] border-b border-[#C89B3C]/50 pb-2 mt-6">
                Datos Cruciales para IA (Funcionando)
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* 5. Historial y Timeline (Tu dato más valioso) */}
                <Card 
                    title="Match History & Timeline (V5)" 
                    icon={ClockIcon}
                    status={isTimelineAvailable ? 'success' : 'warning'}
                >
                    <p className="text-[#F0E6D2]">Historial (IDs): {isMatchHistoryAvailable ? `OK (${data.matchHistory.length} partidas)` : 'FALLO / No Data'}</p>
                    <p className="text-[#F0E6D2]">Timeline (Detalle): {isTimelineAvailable ? 'OK (Análisis Detallado Activo)' : 'FALLO (Timeline no disponible)'}</p>
                    {isTimelineAvailable && <p className="text-green-300 mt-1 font-semibold">¡Datos listos para el Backend de Estrategia AI!</p>}
                </Card>

                {/* 6. Bloque de Estrategia AI (Preparación) */}
                <Card title="Estrategia AI | Status" icon={TrophyIcon} status={isTimelineAvailable ? "warning" : "info"}>
                    <p className="text-[#C89B3C]/80 font-semibold">
                        {isTimelineAvailable ? "ESPERANDO IA: Datos recibidos." : "DATOS INSUFICIENTES: Timeline es necesario."}
                    </p>
                    <p className="text-[#F0E6D2]/70 mt-2 text-sm">
                        La IA usará el Historial y la Timeline para generar estrategias personalizadas para la próxima partida o análisis post-partida.
                    </p>
                </Card>
            </div>
        </div>
    );
};

export default RiotProfileData;