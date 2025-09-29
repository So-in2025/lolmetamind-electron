// src/hooks/useRiotProfileData.js

"use client";

import { useState, useEffect } from 'react';

// Nuevo estado inicial ampliado para la batería de pruebas (10 pasos)
const initialData = {
    mode: 'Loading',
    puuid: null,
    summonerRankData: [],
    championMasteries: [],
    matchHistory: [],
    matchTimeline: null,
    serviceStatus: null,
    activeGame: null,
    tftLeagueData: [],
    challengesPlayerInfo: null,
    // Nota: El backend envía todos estos campos, incluso si están vacíos o nulos
};

const useRiotProfileData = () => {
    const [riotData, setRiotData] = useState(initialData);

    useEffect(() => {
        const handleRiotData = (event, data) => {
            
            if (data.mode === 'Strategic_API_Profile') {
                 setRiotData({
                     mode: data.mode,
                     puuid: data.puuid, 
                     summonerRankData: data.summonerRankData || [],
                     championMasteries: data.championMasteries || [],
                     matchHistory: data.matchHistory || [],
                     matchTimeline: data.matchTimeline,
                     serviceStatus: data.serviceStatus,
                     activeGame: data.activeGame,
                     tftLeagueData: data.tftLeagueData || [],
                     challengesPlayerInfo: data.challengesPlayerInfo,
                 });
            } else if (data.mode === 'Realtime') {
                 // Si hay datos en tiempo real (LCU), actualizamos solo el modo y la data de juego en vivo
                 setRiotData(prev => ({ 
                     ...prev, 
                     mode: 'LCU_ACTIVE', 
                     activeGame: data.liveData || null,
                     // Si el LCU está activo, la información estratégica se mantiene estática.
                 })); 
            } else {
                 setRiotData(prev => ({ ...prev, mode: 'NO_DATA' })); 
            }
        };

        if (typeof window !== 'undefined' && window.electronAPI && window.electronAPI.receive) {
            window.electronAPI.receive('riot-profile-data', handleRiotData);
        }

        return () => {
             // Limpieza
             if (typeof window !== 'undefined' && window.electronAPI && window.electronAPI.removeListener) {
                 window.electronAPI.removeListener('riot-profile-data', handleRiotData);
             }
        };
    }, []);

    return riotData;
};

export default useRiotProfileData;