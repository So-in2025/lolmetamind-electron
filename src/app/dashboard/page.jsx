// src/app/dashboard/page.jsx
// Este componente principal del dashboard gestiona la carga inicial de datos,
// el estado de la aplicación, y la integración de todos los componentes secundarios
// para ofrecer una experiencia de usuario completa y dinámica.

"use client"; 

import React, { useState, useEffect, useCallback } from 'react';
// Importa los componentes específicos del dashboard (los crearemos a continuación)
import UserProfile from '@/components/dashboard/UserProfile';
import AIAnalysis from '@/components/dashboard/AIAnalysis';
import RecentMatches from '@/components/dashboard/RecentMatches';
import DashboardTabs from '@/components/DashboardTabs'; // Este contendrá las pestañas con Meta, Desafíos, etc.

const DashboardPage = () => {
    // --- Estados de la Aplicación ---
    const [userData, setUserData] = useState(null); // Datos del perfil del usuario (desde electron-store)
    const [riotApiData, setRiotApiData] = useState(null); // Datos de la API de Riot (historial, ligas, etc.)
    const [metaData, setMetaData] = useState(null); // Datos del meta actual (generados por IA)
    const [weeklyChallenges, setWeeklyChallenges] = useState(null); // Desafíos semanales (generados por IA)
    const [analysisResult, setAnalysisResult] = useState(null); // Resultado del análisis de partidas por IA
    const [recommendations, setRecommendations] = useState(null); // Recomendaciones de campeones/estrategias por IA
    
    const [isLoading, setIsLoading] = useState(true); // Controla el estado de carga inicial del dashboard
    const [error, setError] = useState(''); // Almacena mensajes de error críticos

    // --- Efecto para Cargar Datos Iniciales (userData, metaData) ---
    // Se ejecuta una vez al montar el componente.
    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                // Verificar si la API de Electron está disponible
                if (!window.electronAPI) {
                    throw new Error("La API de Electron no está disponible. Asegúrate de que la aplicación se esté ejecutando en Electron.");
                }

                // 1. Cargar datos del perfil del usuario desde electron-store
                const user = await window.electronAPI.getUserData();
                if (!user) {
                    throw new Error("No se pudo cargar el perfil de usuario. Por favor, reinicia la aplicación o inicia sesión de nuevo.");
                }
                setUserData(user);
                console.log('[DASHBOARD] ✅ Perfil de usuario cargado:', user.summonerName);

                // 2. Cargar análisis del meta actual desde el backend de IA
                const meta = await window.electronAPI.getMetaAnalysis();
                if (meta.error) {
                    console.warn('[DASHBOARD] ⚠️ Error al cargar el meta del juego:', meta.error);
                    // No es un error crítico, el dashboard puede seguir funcionando sin el meta
                } else {
                    setMetaData(meta);
                    console.log('[DASHBOARD] ✅ Meta de juego cargado.');
                }

                // 3. Cargar desafíos semanales desde el backend de IA
                const challenges = await window.electronAPI.getWeeklyChallenges();
                if (challenges.error) {
                    console.warn('[DASHBOARD] ⚠️ Error al cargar desafíos semanales:', challenges.error);
                } else {
                    setWeeklyChallenges(challenges);
                    console.log('[DASHBOARD] ✅ Desafíos semanales cargados.');
                }

                // 4. Cargar recomendaciones iniciales (si hay roles/campeones favoritos)
                if (user.favRole1 || user.favChamp1) {
                    const recs = await window.electronAPI.getRecommendations({
                        favRole1: user.favRole1,
                        favRole2: user.favRole2,
                        favChamp1: user.favChamp1,
                        favChamp2: user.favChamp2,
                    });
                    if (recs.error) {
                        console.warn('[DASHBOARD] ⚠️ Error al cargar recomendaciones:', recs.error);
                    } else {
                        setRecommendations(recs);
                        console.log('[DASHBOARD] ✅ Recomendaciones cargadas.');
                    }
                }

            } catch (err) {
                console.error("[DASHBOARD] ❌ Error crítico al cargar el dashboard:", err);
                setError(err.message || 'Error desconocido al cargar el dashboard.');
            } finally {
                setIsLoading(false); // Finalizar el estado de carga
            }
        };

        fetchInitialData();
    }, []); // El array vacío asegura que se ejecute solo una vez al montar

    // --- Efecto para Escuchar Datos en Tiempo Real (Polling de Riot API/LCU) ---
    // Se suscribe a los mensajes enviados por `main.js` sobre datos de Riot API.
    useEffect(() => {
        if (window.electronAPI?.on) {
            // La función `on` de electronAPI devuelve una función de limpieza para desuscribirse
            const unsubscribe = window.electronAPI.on('riot-profile-data', (data) => {
                console.log('[DASHBOARD] 🔄 Datos de Riot API recibidos:', data);
                // Actualiza el estado con los datos más recientes (historial de partidas, ligas, etc.)
                setRiotApiData(data);
            });
            return () => {
                console.log('[DASHBOARD] 🧹 Desuscribiendo de riot-profile-data.');
                unsubscribe(); // Limpieza al desmontar el componente
            };
        }
    }, []); // Se ejecuta solo una vez al montar

    // --- Callback para Manejar Solicitudes de Análisis de la IA ---
    // Utiliza `useCallback` para optimizar el rendimiento y evitar re-crear la función.
    const handleAnalysisRequest = useCallback(async (type) => {
        if (!window.electronAPI || !userData) {
            console.warn('[DASHBOARD] No hay API de Electron o datos de usuario para realizar el análisis.');
            return;
        }

        setAnalysisResult({ loading: true, type: type }); // Establece el estado de carga para el análisis
        let result;

        try {
            switch (type) {
                case 'performance':
                    // Envía datos relevantes del usuario al backend para el análisis de partidas
                    result = await window.electronAPI.analyzeMatches({
                        summonerName: userData.summonerName,
                        tagline: userData.tagline,
                        region: userData.region,
                        puuid: riotApiData?.puuid, // Asegúrate de que el puuid esté disponible en riotApiData
                        matchIds: riotApiData?.matchHistory?.map(m => m.matchId) // Si se necesita el historial directo
                    });
                    break;
                case 'tips':
                     result = await window.electronAPI.getRecommendations({
                        favRole1: userData.favRole1,
                        favRole2: userData.favRole2,
                        favChamp1: userData.favChamp1,
                        favChamp2: userData.favChamp2,
                    });
                    setRecommendations(result); // Actualiza también las recomendaciones generales
                    break;
                case 'challenges':
                    result = await window.electronAPI.getWeeklyChallenges();
                    setWeeklyChallenges(result); // Actualiza también los desafíos generales
                    break;
                default:
                    result = { error: 'Tipo de análisis no reconocido.' };
            }
        } catch (err) {
            console.error(`[DASHBOARD] ❌ Error en el análisis de tipo '${type}':`, err);
            result = { error: `Error al realizar el análisis: ${err.message || 'Error desconocido'}` };
        } finally {
            setAnalysisResult(result); // Actualiza el resultado final del análisis
        }
    }, [userData, riotApiData]); // Dependencias del callback

    // --- Renderizado Condicional: Pantalla de Carga o Error ---
    if (isLoading) {
        return (
            <div className="min-h-screen bg-lol-app-bg text-lol-text p-8 flex justify-center items-center">
                <p className="text-xl text-lol-light-blue animate-pulse">Cargando MetaMind...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-lol-app-bg text-red-400 p-8 flex justify-center items-center text-center">
                <div>
                    <p className="text-2xl font-bold mb-4">Error Crítico al Cargar MetaMind</p>
                    <p>{error}</p>
                    <p className="mt-4 text-lol-light/70">
                        Por favor, verifica la consola de desarrollo (Ctrl+Shift+I) para más detalles.
                        Intenta reiniciar la aplicación o contacta a soporte si el problema persiste.
                    </p>
                </div>
            </div>
        );
    }

    // --- Renderizado del Dashboard Principal ---
    return (
        <div className="min-h-screen bg-lol-app-bg text-lol-text p-8 flex flex-col">
            {/* --- Encabezado --- */}
            <header className="mb-6 pt-2 pb-4 text-center -webkit-app-region-drag user-select-none border-b border-lol-gold/50"> 
                <h1 className="text-4xl font-black text-lol-gold uppercase tracking-widest text-shadow-lg">
                    Panel de Control MetaMind
                </h1>
                {/* Muestra el nombre del invocador si userData está disponible, sino "Invocador" */}
                <p className="text-lol-light/70 mt-2">Bienvenido, {userData?.summonerName || 'Invocador'}.</p>
            </header>
            
            {/* --- Contenido Principal del Dashboard (Diseño en Cuadrícula) --- */}
            <main className="flex-grow grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* --- Columna Izquierda: Perfil y Partidas Recientes --- */}
                <div className="lg:col-span-1 flex flex-col gap-6">
                    {/* Componente para el perfil del usuario, le pasamos los datos */}
                    <UserProfile 
                        userData={userData} 
                        // Pasamos solo la información de ligas a UserProfile
                        rankData={riotApiData?.leagues} 
                    />
                    {/* Componente para las partidas recientes */}
                    <RecentMatches 
                        matches={riotApiData?.matchHistory} 
                    />
                </div>

                {/* --- Columna Derecha: Análisis de IA y Pestañas Detalladas --- */}
                {/* (En un diseño responsive, esto podría apilarse debajo de la columna izquierda) */}
                <div className="lg:col-span-2 flex flex-col gap-6">
                    {/* Componente con los botones de análisis de IA y la visualización del resultado */}
                    <AIAnalysis 
                        onAnalysis={handleAnalysisRequest} 
                        result={analysisResult}
                        userData={userData} // Pasamos userData a AIAnalysis para que pueda usarlo si es necesario
                    />
                    {/* Componente de Pestañas (contiene Meta, Desafíos, Recomendaciones, Configuración) */}
                    <DashboardTabs 
                        userData={userData} // Pasamos userData para que las pestañas puedan usarlo
                        metaData={metaData} // Pasamos el meta cargado
                        weeklyChallenges={weeklyChallenges} // Pasamos los desafíos cargados
                        recommendations={recommendations} // Pasamos las recomendaciones cargadas
                        onAnalysisRequest={handleAnalysisRequest} // Permite a las pestañas iniciar análisis
                    />
                </div>
            </main>
        </div>
    );
};

export default DashboardPage;