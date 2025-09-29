// src/app/dashboard/page.jsx
"use client"; 

import React, { useState, useEffect, useCallback } from 'react';
import UserProfile from '@/components/dashboard/UserProfile';
import AIAnalysis from '@/components/dashboard/AIAnalysis';
import RecentMatches from '@/components/dashboard/RecentMatches';
import DashboardTabs from '@/components/DashboardTabs';
import { useLcuData } from '../../hooks/useLcuData'; // <-- IMPORTA EL NUEVO HOOK

const DashboardPage = () => {
    // --- ESTADOS (MANTENEMOS TODOS TUS ESTADOS ORIGINALES) ---
    const [userData, setUserData] = useState(null);
    const [metaData, setMetaData] = useState(null);
    const [weeklyChallenges, setWeeklyChallenges] = useState(null);
    const [analysisResult, setAnalysisResult] = useState(null);
    const [recommendations, setRecommendations] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    
    // --- NUEVO HOOK PARA DATOS EN TIEMPO REAL ---
    const lcuData = useLcuData();

    // --- EFECTO PARA CARGA INICIAL (TU LÓGICA ORIGINAL RESTAURADA Y MEJORADA) ---
    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                if (!window.electronAPI) throw new Error("API de Electron no disponible.");

                const user = await window.electronAPI.invoke('get-user-data');
                if (!user) throw new Error("No se pudo cargar el perfil de usuario.");
                setUserData(user);
                console.log('[DASHBOARD] ✅ Perfil de usuario cargado:', user.summonerName);

                // Cargar datos de IA en paralelo para acelerar
                Promise.all([
                    window.electronAPI.invoke('get-meta-analysis'),
                    window.electronAPI.invoke('get-weekly-challenges'),
                    window.electronAPI.invoke('get-recommendations', { 
                        favRole1: user.favRole1, 
                        favChamp1: user.favChamp1,
                        favRole2: user.favRole2,
                        favChamp2: user.favChamp2
                    })
                ]).then(([meta, challenges, recs]) => {
                    if (!meta.error) setMetaData(meta);
                    if (!challenges.error) setWeeklyChallenges(challenges);
                    if (!recs.error) setRecommendations(recs);
                    console.log('[DASHBOARD] ✅ Datos iniciales de IA cargados.');
                });

            } catch (err) {
                setError(err.message);
            } finally {
                setIsLoading(false);
            }
        };

        fetchInitialData();
    }, []); // El array vacío asegura que se ejecute solo una vez

    // --- CALLBACK PARA ANÁLISIS IA (TU LÓGICA ORIGINAL RESTAURADA Y MEJORADA) ---
    const handleAnalysisRequest = useCallback(async (type) => {
        if (!window.electronAPI || !userData) {
            console.warn('[DASHBOARD] Sin API de Electron o datos de usuario para análisis.');
            return;
        }

        setAnalysisResult({ loading: true, type });
        let result;

        try {
            switch (type) {
                case 'performance':
                    result = await window.electronAPI.invoke('analyze-matches', {
                        puuid: lcuData?.riotApiData?.puuid,
                        // Puedes añadir más datos aquí si tu backend los necesita
                    });
                    break;
                case 'tips':
                    result = await window.electronAPI.invoke('get-recommendations', {
                        favRole1: userData.favRole1,
                        favRole2: userData.favRole2,
                        favChamp1: userData.favChamp1,
                        favChamp2: userData.favChamp2,
                    });
                    setRecommendations(result); // Actualiza también las recomendaciones generales
                    break;
                case 'challenges':
                    result = await window.electronAPI.invoke('get-weekly-challenges');
                    setWeeklyChallenges(result); // Actualiza también los desafíos generales
                    break;
                default:
                    result = { error: 'Tipo de análisis no reconocido.' };
            }
        } catch (err) {
            result = { error: `Error en el análisis: ${err.message}` };
        } finally {
            setAnalysisResult(result);
        }
    }, [userData, lcuData]); // Dependencias del callback

    // --- RENDERIZADO CONDICIONAL (TU LÓGICA ORIGINAL) ---
    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-full">
                <p className="text-xl text-lol-light-blue animate-pulse">Cargando MetaMind...</p>
            </div>
        );
    }
    if (error) {
        return (
            <div className="flex justify-center items-center h-full text-center text-red-400">
                <div>
                    <p className="text-2xl font-bold mb-4">Error Crítico al Cargar MetaMind</p>
                    <p>{error}</p>
                </div>
            </div>
        );
    }

    const gamePhase = lcuData?.lcuState?.gameflow?.phase;

    // --- RENDERIZADO DEL DASHBOARD (TU ESTRUCTURA ORIGINAL + MEJORAS RESPONSIVE) ---
    return (
        <div className="p-4 md:p-6 lg:p-8 max-w-screen-2xl mx-auto w-full">
            
            <header className="mb-6 text-center -webkit-app-region-drag user-select-none"> 
                <h1 className="text-3xl md:text-4xl font-black text-lol-gold uppercase tracking-widest text-shadow-lg">
                    Panel de Control MetaMind
                </h1>
                <p className="text-lol-light/70 mt-1 md:mt-2">Bienvenido, {userData?.summonerName || 'Invocador'}.</p>
            </header>
            
            <main className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                <div className="lg:col-span-1 flex flex-col gap-6">
                    <UserProfile 
                        userData={userData} 
                        rankData={lcuData?.riotApiData?.summonerRankData} 
                    />
                    <RecentMatches 
                        matches={lcuData?.riotApiData?.matchHistory} 
                    />
                </div>

                <div className="lg:col-span-2 flex flex-col gap-6">
                    {/* Componente de Análisis de Champ Select (SOLO APARECE CUANDO ES NECESARIO) */}
                    {gamePhase === 'ChampSelect' && (
                        <div className="p-4 bg-lol-dark-blue border border-lol-accent-gold rounded-lg shadow-lg animate-fade-in">
                            <h2 className="text-xl text-lol-highlight font-bold mb-2">Análisis de Selección de Campeón</h2>
                            {/* Aquí es donde mostrarías los datos de lcuData.lcuState.champSelect */}
                            <pre className="text-xs text-gray-300">{JSON.stringify(lcuData.lcuState.champSelect, null, 2)}</pre>
                        </div>
                    )}

                    <AIAnalysis 
                        onAnalysis={handleAnalysisRequest} 
                        result={analysisResult}
                        userData={userData}
                    />
                    <DashboardTabs 
                        userData={userData}
                        metaData={metaData}
                        weeklyChallenges={weeklyChallenges}
                        recommendations={recommendations}
                        onAnalysisRequest={handleAnalysisRequest}
                    />
                </div>
            </main>
        </div>
    );
};

export default DashboardPage;