// src/app/dashboard/page.jsx - FINAL UNIFICADO Y SIN PLACEHOLDERS
"use client"; 

import React, { useState, useEffect, useCallback } from 'react';
import UserProfile from '@/components/dashboard/UserProfile';
import AIAnalysis from '@/components/dashboard/AIAnalysis';
import RecentMatches from '@/components/dashboard/RecentMatches';
import DashboardTabs from '@/components/DashboardTabs';
import { useLcuData } from '../../hooks/useLcuData';

const DashboardPage = () => {
    // Estado para datos del perfil de la DB (el que llega por IPC al inicio)
    const [userData, setUserData] = useState(null);
    const [metaData, setMetaData] = useState(null);
    const [weeklyChallenges, setWeeklyChallenges] = useState(null);
    const [analysisResult, setAnalysisResult] = useState(null);
    const [recommendations, setRecommendations] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    
    // Hook centralizado para todos los datos de Riot y LCU
    const lcuData = useLcuData();
    
    // Extraer datos de LCU: riotApiData ya no existe, usamos las propiedades directamente si lcuData está presente
    const riotApiData = lcuData || {}; 
    const riotError = riotApiData.error; // Extraemos el error de la Riot API (401)
    
    // Efecto para cargar los datos iniciales del usuario desde la DB a través de Electron
    useEffect(() => {
        const fetchUserData = async () => {
            try {
                if (!window.electronAPI) throw new Error("API de Electron no disponible.");
                
                const user = await window.electronAPI.invoke('get-user-data');
                if (!user) {
                    throw new Error("No se pudo cargar el perfil de usuario. Verifique la conexión a la DB.");
                }
                
                setUserData(user);

                // Preparar payloads para las llamadas iniciales de IA
                const basePayload = {
                    summonerName: user.summonerName, 
                    zodiacSign: user.zodiacSign, 
                    patchVersion: 'actual',
                    summoner: user,
                    draft: { myTeamPicks: [], theirTeamPicks: [], bans: [] }
                };

                // CRÍTICO: Intentar cargar la data de la IA
                Promise.all([
                    window.electronAPI.invoke('get-meta-analysis', basePayload),
                    window.electronAPI.invoke('get-weekly-challenges', basePayload),
                    window.electronAPI.invoke('get-recommendations', basePayload)
                ]).then(([meta, challenges, recs]) => {
                    if (!meta?.error) setMetaData(meta);
                    if (!challenges?.error) setWeeklyChallenges(challenges);
                    if (!recs?.error) setRecommendations(recs);
                });

            } catch (err) {
                setError(err.message);
            } finally {
                setIsLoading(false);
            }
        };
        fetchUserData();
    }, []);

    const handleAnalysisRequest = useCallback(async (type) => {
        if (!window.electronAPI || !userData) return;
        
        // No intentar análisis si la Riot API falló críticamente y no tenemos datos.
        if (riotError) {
             setAnalysisResult({ error: "No se puede iniciar el análisis de IA sin una clave API de Riot válida.", type });
             return;
        }

        setAnalysisResult({ loading: true, type });
        let result;
        
        const basePayload = {
            summonerData: { summonerName: userData.summonerName, zodiacSign: userData.zodiacSign },
            summoner: userData,
            // Utilizamos matchHistory directamente de lcuData
            matchHistory: riotApiData.matchHistory || [] 
        };
        
        try {
            switch (type) {
                case 'performance':
                    result = await window.electronAPI.invoke('analyze-matches', basePayload);
                    break;
                case 'tips':
                    result = await window.electronAPI.invoke('get-recommendations', basePayload);
                    setRecommendations(result);
                    break;
                case 'challenges':
                    result = await window.electronAPI.invoke('get-weekly-challenges', basePayload);
                    setWeeklyChallenges(result);
                    break;
                default: result = { error: 'Tipo de análisis no reconocido.' };
            }
        } catch (err) {
            result = { error: `Error en el análisis: ${err.message}` };
        } finally {
            setAnalysisResult(result);
        }
    }, [userData, riotApiData.matchHistory, riotError]);

    if (isLoading) { return <div className="flex justify-center items-center h-full min-h-screen bg-[#0A141A]"><p className="text-xl text-[#0BC6E3] animate-pulse">Cargando MetaMind...</p></div>; }
    if (error) { return <div className="flex justify-center items-center h-full min-h-screen bg-[#0A141A] text-center text-red-400"><div><p className="text-2xl font-bold mb-4">Error Crítico</p><p>{error}</p></div></div>; }

    const gamePhase = riotApiData.lcuState?.gameflow?.phase;

    return ( 
        <div className="p-4 md:p-6 lg:p-8 max-w-screen-2xl mx-auto w-full"> 
            
            {/* >>> TÍTULO RESTAURADO <<< */}
            <header className="mb-6 text-center border-b border-[#C89B3C]/50 pb-4">
                 <h1 className="text-4xl font-extrabold text-[#C89B3C] tracking-widest">PANEL DE CONTROL METAMIND</h1>
                 <p className="text-[#F0E6D2]/80 mt-1">Bienvenido, {userData?.username || 'Invocador'}.</p>
            </header>
            
            <main className="grid grid-cols-1 lg:grid-cols-3 gap-6"> 
                <div className="lg:col-span-1 flex flex-col gap-6"> 
                    <UserProfile userData={userData} rankData={riotApiData.summonerRankData} /> 
                    {/* Pasamos el error de Riot API al componente de partidas */}
                    <RecentMatches 
                        matches={riotApiData.matchHistory} 
                        riotError={riotError} 
                    /> 
                </div> 
                <div className="lg:col-span-2 flex flex-col gap-6"> 
                    {gamePhase === 'ChampSelect' && ( 
                        <div> {/* Aquí iría tu coach de champ select si lo tienes montado */} </div> 
                    )} 
                    <AIAnalysis onAnalysis={handleAnalysisRequest} result={analysisResult} userData={userData} /> 
                    {/* Pasamos metaData, weeklyChallenges, y recommendations (los estados locales de la IA inicial) */}
                    <DashboardTabs userData={userData} metaData={metaData} weeklyChallenges={weeklyChallenges} recommendations={recommendations} onAnalysisRequest={handleAnalysisRequest} /> 
                </div> 
            </main> 
        </div> 
    );
};

export default DashboardPage;