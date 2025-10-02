// src/app/dashboard/page.jsx - COMPLETO CON CHAMP SELECT COACH INTEGRADO
"use client"; 

import React, { useState, useEffect, useCallback } from 'react';
import UserProfile from '@/components/dashboard/UserProfile';
import AIAnalysis from '@/components/dashboard/AIAnalysis';
import RecentMatches from '@/components/dashboard/RecentMatches';
import DashboardTabs from '@/components/DashboardTabs';

const DashboardPage = () => {
    // Estados para datos del perfil y de la IA
    const [userData, setUserData] = useState(null);
    const [metaData, setMetaData] = useState(null);
    const [weeklyChallenges, setWeeklyChallenges] = useState(null);
    const [analysisResult, setAnalysisResult] = useState(null);
    const [recommendations, setRecommendations] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');

    // Efecto para cargar los datos iniciales del usuario desde la DB
    useEffect(() => {
        const fetchUserData = async () => {
            try {
                if (!window.electronAPI) throw new Error("API de Electron no disponible.");
                
                const user = await window.electronAPI.getUserData();
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
                    window.electronAPI.getMetaAnalysis(basePayload),
                    window.electronAPI.getWeeklyChallenges(basePayload),
                    window.electronAPI.getRecommendations(basePayload)
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
        

        setAnalysisResult({ loading: true, type });
        let result;
        
        const basePayload = {
            summonerData: { summonerName: userData.summonerName, zodiacSign: userData.zodiacSign },
            summoner: userData,
            matchHistory: []
        };
        
        try {
            switch (type) {
                case 'performance':
                    result = await window.electronAPI.analyzeMatches(basePayload);
                    break;
                case 'tips':
                    result = await window.electronAPI.getRecommendations(basePayload);
                    setRecommendations(result);
                    break;
                case 'challenges':
                    result = await window.electronAPI.getWeeklyChallenges(basePayload);
                    setWeeklyChallenges(result);
                    break;
                default: result = { error: 'Tipo de análisis no reconocido.' };
            }
        } catch (err) {
            result = { error: `Error en el análisis: ${err.message}` };
        } finally {
            setAnalysisResult(result);
        }
    }, [userData]);

    if (isLoading) { return <div className="flex justify-center items-center h-full min-h-screen bg-[#0A141A]"><p className="text-xl text-[#0BC6E3] animate-pulse">Cargando MetaMind...</p></div>; }
    if (error) { return <div className="flex justify-center items-center h-full min-h-screen bg-[#0A141A] text-center text-red-400"><div><p className="text-2xl font-bold mb-4">Error Crítico</p><p>{error}</p></div></div>; }

    return ( 
        <div className="p-4 md:p-6 lg:p-8 max-w-screen-2xl mx-auto w-full"> 
            
            <header className="mb-6 text-center border-b border-[#C89B3C]/50 pb-4 relative">
                 <h1 className="text-4xl font-extrabold text-[#C89B3C] tracking-widest">PANEL DE CONTROL METAMIND</h1>
                 <p className="text-[#F0E6D2]/80 mt-1">Bienvenido, {userData?.username || 'Invocador'}.</p>
            </header>
            
            <main className="grid grid-cols-1 lg:grid-cols-3 gap-6"> 
                <div className="lg:col-span-1 flex flex-col gap-6"> 
                <UserProfile userData={userData} />
                   <RecentMatches 
                        matches={[]} 
                        riotError={null} 
                    />
                </div> 
                <div className="lg:col-span-2 flex flex-col gap-6">                   
                <AIAnalysis onAnalysis={handleAnalysisRequest} result={analysisResult} userData={userData} /> 
                <DashboardTabs 
                    userData={userData} 
                    metaData={metaData} 
                    weeklyChallenges={weeklyChallenges} 
                    recommendations={recommendations} 
                    onAnalysis={handleAnalysisRequest} 
                /> 
            </div>
            </main> 
        </div> 
    );
};

export default DashboardPage;