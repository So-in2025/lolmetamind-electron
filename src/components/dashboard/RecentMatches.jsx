// src/components/dashboard/RecentMatches.jsx - MOSTRAR ERRORES DE RIOT API
"use client";

import React from 'react';

const formatDuration = (seconds) => {
    if (!seconds || typeof seconds !== 'number' || seconds < 0) return '00:00';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
};

// CRÍTICO: Aceptamos la prop 'riotError' para mostrar el mensaje de fallo 401
export default function RecentMatches({ matches, riotError }) { 
    
    // Si hay un error reportado por el hook LCU, lo mostramos
    if (riotError) {
        return (
            <div className="bg-lol-dark-blue p-6 rounded-lg border border-red-500/30 shadow-lg flex flex-col h-full min-h-[300px]">
                <h2 className="text-2xl font-bold text-red-500 mb-5 border-b border-red-500/50 pb-2">Error de Autenticación (Riot API)</h2>
                <div className="flex items-center justify-center h-full text-center">
                    <p className="text-red-400 font-bold">
                        {riotError}
                        <br/>
                        <span className="text-sm font-normal block mt-2">Por favor, navega a la pestaña **Configuración** e ingresa una nueva clave de desarrollo.</span>
                    </p>
                </div>
            </div>
        );
    }
    
    return (
        <div className="bg-lol-dark-blue p-6 rounded-lg border border-lol-gold/30 shadow-lg flex flex-col h-full min-h-[300px]">
            <h2 className="text-2xl font-bold text-lol-gold mb-5 border-b border-lol-gold/50 pb-2">Partidas Recientes</h2>
            
            <div className="flex-grow overflow-y-auto custom-scrollbar pr-2">
                {/* Si no hay error pero los datos son nulos, mostramos la carga */}
                {matches === null || matches === undefined ? (
                    <div className="flex items-center justify-center h-full">
                        <p className="text-gray-400 text-center animate-pulse">Esperando datos de la API de Riot...</p>
                    </div>
                ) : matches.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                        <p className="text-gray-400 text-center">No se encontraron partidas recientes.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {matches.map((matchId, index) => (
                            <div 
                                key={matchId || index} 
                                className="flex items-center justify-between p-3 rounded-md bg-gray-800/40 border-l-4 border-gray-500"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 bg-black rounded-full border-2 border-lol-gold/50 flex items-center justify-center">
                                        <span className="text-lol-gold font-bold">?</span>
                                    </div>
                                    <div>
                                        <p className="font-bold text-lol-light-blue">Partida Desconocida</p>
                                        <p className="text-xs text-gray-400 truncate max-w-[200px]">ID: {matchId}</p>
                                    </div>
                                </div>
                                <div className="text-right text-sm text-gray-400">
                                    <p>Detalles no disponibles</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};