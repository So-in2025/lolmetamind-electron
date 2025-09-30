// src/components/dashboard/RecentMatches.jsx - VERSIÓN FINAL
"use client";

import React from 'react';

// Función para formatear la duración de la partida
const formatDuration = (seconds) => {
    if (!seconds || typeof seconds !== 'number' || seconds < 0) return '00:00';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
};

export default function RecentMatches({ matches }) {
    return (
        <div className="bg-lol-dark-blue p-6 rounded-lg border border-lol-gold/30 shadow-lg flex flex-col h-full min-h-[300px]">
            <h2 className="text-2xl font-bold text-lol-gold mb-5 border-b border-lol-gold/50 pb-2">Partidas Recientes</h2>
            
            <div className="flex-grow overflow-y-auto custom-scrollbar pr-2">
                {/* Condición mejorada para manejar el estado de carga implícito (matches es null) */}
                {matches === null || matches === undefined ? (
                    <div className="flex items-center justify-center h-full">
                        <p className="text-gray-400 text-center animate-pulse">Esperando datos de la API de Riot...</p>
                    </div>
                ) : matches.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                        <p className="text-gray-400 text-center">No se encontraron partidas recientes o la API de Riot no está disponible.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {matches.map((matchId, index) => (
                            // La API de Riot devuelve solo los IDs, así que mostramos eso por ahora
                            // En una versión futura, deberías hacer un fetch de los detalles de cada partida
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