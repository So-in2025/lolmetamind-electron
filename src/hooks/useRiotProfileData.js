// src/hooks/useRiotProfileData.js

"use client";

import { useState, useEffect } from 'react';

const initialData = {
    mode: 'Loading',
    summonerRankData: [],
    championMasteries: [],
};

const useRiotProfileData = () => {
    const [riotData, setRiotData] = useState(initialData);

    useEffect(() => {
        const handleRiotData = (event, data) => {
            // Solo actualizamos si es un modo que queremos mostrar en el Dashboard
            if (data.mode === 'Strategic_API_Profile' || data.mode === 'Strategic_API') {
                 setRiotData({
                     mode: data.mode,
                     summonerRankData: data.summonerRankData || [],
                     championMasteries: data.championMasteries || [],
                 });
            } else if (data.mode === 'Realtime') {
                 setRiotData(prev => ({ ...prev, mode: 'LCU_ACTIVE' })); 
            } else {
                 setRiotData(prev => ({ ...prev, mode: 'NO_DATA' })); 
            }
        };

        if (typeof window !== 'undefined' && window.electronAPI && window.electronAPI.receive) {
            // Escuchar el canal 'riot-profile-data'
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