import { useState, useEffect, useCallback } from 'react';
import axios from 'axios'; 
import { useAppState } from '@/context/AppStateContext';

const USER_DATA_ENDPOINT = 'http://localhost:3000/api/user/profile?username='; 

/**
 * Hook para recibir datos LCU en tiempo real desde el Main Process (IPC).
 * 🚨 NO contiene lógica de polling, lockfile ni llamadas HTTP/S LCU. 🚨
 */
export const useLcuData = () => {
  const { setAppState } = useAppState(); 
  const [gamePhase, setGamePhase] = useState('None');
  const [draftData, setDraftData] = useState(null);
  const [lcuStatus, setLcuStatus] = useState('OFFLINE');

  // --- FUNCIÓN ROBUSTA DE CARGA DE DATOS DE USUARIO AUTH ---
  const fetchUserData = useCallback(async (token, username) => {
    const isFirstTime = !token || !username;
    setAppState(prev => ({ ...prev, isLoadingUser: true }));

    try {
        // Simulación de datos robustos (fallback para primer uso o error de DB)
        const profile = isFirstTime ? {
            summonerName: 'Invocador', 
            zodiacSign: 'Aries', 
            championMastery: [],
        } : {
            summonerName: 'Jh0wner', 
            zodiacSign: 'Aries', 
            championMastery: [{ name: 'Jhin', key: 202 }], 
        };
        
        setAppState(prev => ({
            ...prev,
            userData: profile,
            isLoadingUser: false,
            isFirstTimeUser: isFirstTime,
        }));
    } catch (e) {
        console.error("Error al cargar datos de usuario del backend:", e.message);
        setAppState(prev => ({
             ...prev,
             userData: { summonerName: 'Anon', zodiacSign: 'Leo', championMastery: [] },
             isLoadingUser: false,
             isFirstTimeUser: true
        }));
    }
  }, [setAppState]);
  // -----------------------------------------------------------


  // --- SUSCRIPCIÓN AL SISTEMA LCU CORE DEL USUARIO ---
  useEffect(() => {
    if (!window.electronAPI) return;

    // 1. Cargar datos de usuario
    const MOCK_USERNAME = 'Jh0wner'; 
    const MOCK_JWT_TOKEN = 'valid-jwt-token';
    fetchUserData(MOCK_JWT_TOKEN, MOCK_USERNAME); 

    // 2. Listener para recibir el estado del juego desde el Main Process
    const updateHandler = (state) => {
        setGamePhase(state.gamePhase);
        setDraftData(state.draftData);
        setLcuStatus(state.lcuStatus);
    };

    window.electronAPI.onLcuStateUpdate(updateHandler);
    
    return () => {
        // Limpieza de listener
    };
  }, [fetchUserData]);

  return { gamePhase, draftData, LCU_STATUS: lcuStatus };
};
