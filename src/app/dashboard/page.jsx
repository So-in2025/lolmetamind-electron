// src/app/dashboard/page.jsx
"use client"; 

import React, { useState, useEffect, useCallback } from 'react';
import UserProfile from '@/components/dashboard/UserProfile';
import AIAnalysis from '@/components/dashboard/AIAnalysis';
import RecentMatches from '@/components/dashboard/RecentMatches';
import DashboardTabs from '@/components/DashboardTabs';
import { useLcuData } from '../../hooks/useLcuData';

const DashboardPage = () => {
    const [userData, setUserData] = useState(null);
    const [metaData, setMetaData] = useState(null);
    const [weeklyChallenges, setWeeklyChallenges] = useState(null);
    const [analysisResult, setAnalysisResult] = useState(null);
    const [recommendations, setRecommendations] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    
    const lcuData = useLcuData();

    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                if (!window.electronAPI) throw new Error("API de Electron no disponible.");
                const user = await window.electronAPI.invoke('get-user-data');
                if (!user) throw new Error("No se pudo cargar el perfil de usuario.");
                setUserData(user);

                // 🔑 CORRECCIÓN: Ahora enviamos los datos que cada endpoint necesita
                Promise.all([
                    window.electronAPI.invoke('get-meta-analysis', { patchVersion: 'actual' }),
                    window.electronAPI.invoke('get-weekly-challenges', { summonerName: user.summonerName, recentMatchesPerformance: {} }),
                    window.electronAPI.invoke('get-recommendations', { summoner: user, draft: { myTeamPicks: [], theirTeamPicks: [], bans: [] } })
                ]).then(([meta, challenges, recs]) => {
                    if (!meta.error) setMetaData(meta);
                    if (!challenges.error) setWeeklyChallenges(challenges);
                    if (!recs.error) setRecommendations(recs);
                });

            } catch (err) {
                setError(err.message);
            } finally {
                setIsLoading(false);
            }
        };
        fetchInitialData();
    }, []);

    const handleAnalysisRequest = useCallback(async (type) => {
        if (!window.electronAPI || !userData) return;
        setAnalysisResult({ loading: true, type });
        let result;
        try {
            switch (type) {
                case 'performance':
                    result = await window.electronAPI.invoke('analyze-matches', {
                        summonerData: { summonerName: userData.summonerName, zodiacSign: userData.zodiacSign },
                        matchHistory: lcuData?.riotApiData?.matchHistory || []
                    });
                    break;
                case 'tips':
                    result = await window.electronAPI.invoke('get-recommendations', {
                        summoner: { summonerName: userData.summonerName, zodiacSign: userData.zodiacSign },
                        draft: { myTeamPicks: [], theirTeamPicks: [], bans: [] }
                    });
                    setRecommendations(result);
                    break;
                case 'challenges':
                    result = await window.electronAPI.invoke('get-weekly-challenges', {
                        summonerName: userData.summonerName,
                        recentMatchesPerformance: {
                            wins: lcuData?.riotApiData?.matchHistory?.filter(m => m.win).length || 0,
                            losses: lcuData?.riotApiData?.matchHistory?.filter(m => !m.win).length || 0,
                        }
                    });
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

    if (isLoading) { return <div className="flex justify-center items-center h-full min-h-screen bg-lol-app-bg"><p className="text-xl text-lol-light-blue animate-pulse">Cargando MetaMind...</p></div>; }
    if (error) { return <div className="flex justify-center items-center h-full min-h-screen bg-lol-app-bg text-center text-red-400"><div><p className="text-2xl font-bold mb-4">Error Crítico</p><p>{error}</p></div></div>; }

    const gamePhase = lcuData?.lcuState?.gameflow?.phase;

    return ( <div className="p-4 md:p-6 lg:p-8 max-w-screen-2xl mx-auto w-full"> <header> {/* ... tu header ... */} </header> <main className="grid grid-cols-1 lg:grid-cols-3 gap-6"> <div className="lg:col-span-1 flex flex-col gap-6"> <UserProfile userData={userData} rankData={lcuData?.riotApiData?.summonerRankData} /> <RecentMatches matches={lcuData?.riotApiData?.matchHistory} /> </div> <div className="lg:col-span-2 flex flex-col gap-6"> {gamePhase === 'ChampSelect' && ( <div> {/* ... tu coach de champ select ... */} </div> )} <AIAnalysis onAnalysis={handleAnalysisRequest} result={analysisResult} userData={userData} /> <DashboardTabs userData={userData} metaData={metaData} weeklyChallenges={weeklyChallenges} recommendations={recommendations} onAnalysisRequest={handleAnalysisRequest} /> </div> </main> </div> );
};

export default DashboardPage;