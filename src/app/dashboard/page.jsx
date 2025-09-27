"use client"
import React from 'react';
import { useAppState } from '../../context/AppStateContext'; 
// 🚨 CORRECCIÓN 3: Rutas explícitas para alcanzar la carpeta 'components'
import WeeklyChallenges from '../../components/WeeklyChallenges'; 
import BuildsHUD from '../../components/widgets/BuildsHUD';

export default function DashboardPage() {
    const { profile, isAuthenticated, overlayEnabled, toggleOverlay, logout } = useAppState();

    if (!isAuthenticated) {
        return <p className="text-red-400 p-8">No autenticado. Redirigiendo...</p>;
    }

    // Datos del perfil guardados durante el Onboarding
    const summonerName = profile?.summonerName || 'Invocador Desconocido';
    const tagline = profile?.tagline || 'N/A';
    const zodiacSign = profile?.zodiacSign || 'No Definido';
    const positions = profile?.positions?.join(', ') || 'No Definidas';

    return (
        <div className="min-h-screen p-8" style={{backgroundImage: "url('/img/background.webp')"}}>
            <header className="flex justify-between items-center pb-6 border-b border-[#1E2A38]">
                <h1 className="text-4xl font-bold text-[#C5B58E]">
                    Panel Estratégico | {summonerName}#{tagline}
                </h1>
                <div className="flex items-center space-x-4">
                    {/* Botón de Logout */}
                    <button 
                        onClick={logout}
                        className="text-sm py-2 px-4 bg-red-600 hover:bg-red-700 rounded-lg transition"
                    >
                        Cerrar Sesión
                    </button>
                    
                    {/* Botón de Activación del Overlay */}
                    <button 
                        onClick={() => toggleOverlay(!overlayEnabled)}
                        className={`py-2 px-4 rounded-lg font-semibold transition duration-300 ${
                            overlayEnabled 
                            ? 'bg-green-600 hover:bg-green-700' 
                            : 'bg-indigo-600 hover:bg-indigo-700'
                        }`}
                    >
                        {overlayEnabled ? 'Overlay ACTIVO' : 'Activar Overlay (CTRL+F2 para esconder)'}
                    </button>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-8">
                {/* Columna de Análisis de Perfil (El Core Estratégico) */}
                <div className="md:col-span-2 space-y-8">
                    <section className="bg-black bg-opacity-60 p-6 rounded-xl border border-[#1E2A38]">
                        <h2 className="text-2xl font-semibold text-gray-200 mb-4">Análisis del Perfil Estratégico</h2>
                        <div className="grid grid-cols-2 gap-4 text-gray-400">
                            <p><strong>Signo Zodiacal:</strong> <span className="text-[#C5B58E]">{zodiacSign}</span></p>
                            <p><strong>Posiciones Clave:</strong> <span className="text-white">{positions}</span></p>
                            <p className="col-span-2 pt-2">
                                *La IA está combinando su Signo Zodiacal con el Win Rate de sus 5 mejores campeones para generar un perfil de riesgo estratégico único.*
                            </p>
                        </div>
                    </section>

                    {/* Simulación del Widget de Builds */}
                    <section className="bg-black bg-opacity-60 p-6 rounded-xl border border-[#1E2A38]">
                         <h2 className="text-2xl font-semibold text-gray-200 mb-4">Builds Recomendadas del Parche</h2>
                         <BuildsHUD /> 
                    </section>
                </div>

                {/* Columna de Desafíos Semanales */}
                <div className="md:col-span-1">
                    <section className="bg-black bg-opacity-60 p-6 rounded-xl border border-[#1E2A38] h-full">
                        <h2 className="text-2xl font-semibold text-gray-200 mb-4">Desafíos de la Semana</h2>
                        <WeeklyChallenges /> 
                    </section>
                </div>
            </div>
        </div>
    );
}