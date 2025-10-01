// src/app/dashboard/page.jsx - COMPLETO CON CHAMP SELECT COACH INTEGRADO
"use client"; 

import React, { useState, useEffect, useCallback } from 'react';
import UserProfile from '@/components/dashboard/UserProfile';
import AIAnalysis from '@/components/dashboard/AIAnalysis';
import RecentMatches from '@/components/dashboard/RecentMatches';
import DashboardTabs from '@/components/DashboardTabs';
import { useLcuData } from '../../hooks/useLcuData';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';

// Importamos el componente del coach
import ChampSelectCoach from '@/components/widgets/ChampSelectCoach'; 

const DashboardPage = () => {
    // Estados para datos del perfil y de la IA
    const [userData, setUserData] = useState(null);
    const [metaData, setMetaData] = useState(null);
    const [weeklyChallenges, setWeeklyChallenges] = useState(null);
    const [analysisResult, setAnalysisResult] = useState(null);
    const [recommendations, setRecommendations] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [isOverlayVisible, setIsOverlayVisible] = useState(false);
    
    // Hook centralizado para todos los datos de Riot y LCU
    const lcuData = useLcuData();

    // Función para el botón de control del Overlay
    const handleToggleOverlay = () => {
        if (window.electronAPI) {
            window.electronAPI.send('toggle-overlay');
            setIsOverlayVisible(!isOverlayVisible); // Actualizamos el estado local
        }
    };

    // Efecto para cargar los datos iniciales del usuario desde la DB
    useEffect(() => {
        const fetchUserData = async () => {
            try {
                if (!window.electronAPI) throw new Error("API de Electron no disponible.");
                
                const user = await window.electronAPI.invoke('get-user-data');
                if (!user) {
                    throw new Error("No se pudo cargar el perfil de usuario. Verifique la conexión a la DB.");
                }
                
                setUserData(user);

                // Preparar payloads para las llamadas iniciales de la IA
                const basePayload = {
                    summonerName: user.summonerName, 
                    zodiacSign: user.zodiacSign, 
                    patchVersion: 'actual',
                    summoner: user,
                    draft: { myTeamPicks: [], theirTeamPicks: [], bans: [] }
                };

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
        
        const riotError = lcuData?.error;
        if (riotError) {
             setAnalysisResult({ error: "No se puede iniciar el análisis de IA sin una clave API de Riot válida.", type });
             return;
        }

        setAnalysisResult({ loading: true, type });
        let result;
        
        const basePayload = {
            summonerData: { summonerName: userData.summonerName, zodiacSign: userData.zodiacSign },
            summoner: userData,
            matchHistory: lcuData?.matchHistory || []
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
    }, [userData, lcuData]);

    if (isLoading) { return <div className="flex justify-center items-center h-full min-h-screen bg-[#0A141A]"><p className="text-xl text-[#0BC6E3] animate-pulse">Cargando MetaMind...</p></div>; }
    if (error) { return <div className="flex justify-center items-center h-full min-h-screen bg-[#0A141A] text-center text-red-400"><div><p className="text-2xl font-bold mb-4">Error Crítico</p><p>{error}</p></div></div>; }

    const gamePhase = lcuData?.gameflow?.phase;
    const riotError = lcuData?.error;

    return ( 
        <div className="p-4 md:p-6 lg:p-8 max-w-screen-2xl mx-auto w-full"> 
            
            <header className="mb-6 text-center border-b border-[#C89B3C]/50 pb-4 relative">
                 <h1 className="text-4xl font-extrabold text-[#C89B3C] tracking-widest">PANEL DE CONTROL METAMIND</h1>
                 <p className="text-[#F0E6D2]/80 mt-1">Bienvenido, {userData?.username || 'Invocador'}.</p>
                 
                 {/* BOTÓN DE OVERLAY */}
                 <div className="absolute top-0 right-0">
                    <button
                        onClick={handleToggleOverlay}
                        className={`flex items-center gap-2 py-2 px-4 rounded-md text-sm font-bold transition-colors duration-200 ${
                            isOverlayVisible 
                                ? 'bg-red-500/80 hover:bg-red-600' 
                                : 'bg-green-500/80 hover:bg-green-600'
                        }`}
                        title={isOverlayVisible ? "Ocultar Overlay (Alt+O)" : "Mostrar Overlay (Alt+O)"}
                    >
                        {isOverlayVisible ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                        {isOverlayVisible ? "Ocultar Overlay" : "Mostrar Overlay"}
                    </button>
                 </div>
            </header>
            
            <main className="grid grid-cols-1 lg:grid-cols-3 gap-6"> 
                <div className="lg:col-span-1 flex flex-col gap-6"> 
                    <UserProfile userData={userData} rankData={lcuData?.summonerRankData} /> 
                    <RecentMatches 
                        matches={lcuData?.matchHistory} 
                        riotError={riotError} 
                    /> 
                </div> 
                <div className="lg:col-span-2 flex flex-col gap-6"> 
                    
                    {/* >>> SECCIÓN DEL COACH DE CHAMP SELECT <<< */}
          
                        <div className="bg-lol-dark-blue p-6 rounded-lg border border-lol-blue-accent/50 shadow-lg">
                            <h3 className="text-2xl font-bold text-lol-blue-accent mb-4 border-b border-lol-blue-accent/30 pb-2">
                                Coach en Selección de Campeón
                            </h3>
                            <ChampSelectCoach 
                                // Pasamos los datos de la selección de campeón desde lcuData
                                champSelectData={lcuData.gameflow} 
                                // En el dashboard, la interacción siempre está activa
                                isInteractive={true} 
                            />
                        </div>
                    
                    
                    <AIAnalysis onAnalysis={handleAnalysisRequest} result={analysisResult} userData={userData} /> 
                    <DashboardTabs userData={userData} metaData={metaData} weeklyChallenges={weeklyChallenges} recommendations={recommendations} onAnalysisRequest={handleAnalysisRequest} /> 
                </div> 
            </main> 
        </div> 
    );
};

export default DashboardPage;