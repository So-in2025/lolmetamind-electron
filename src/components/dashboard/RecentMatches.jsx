// src/components/dashboard/RecentMatches.jsx
"use client";

import React from 'react';

const formatDuration = (seconds) => {
    if (!seconds || typeof seconds !== 'number') return '00:00';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
};

export default function RecentMatches({ matches }) {
    return (
        <div className="bg-lol-dark-blue p-6 rounded-lg border border-lol-gold/30 shadow-lg flex flex-col h-full">
            <h2 className="text-2xl font-bold text-lol-gold mb-5 border-b border-lol-gold/50 pb-2">Partidas Recientes</h2>
            
            <div className="flex-grow overflow-y-auto custom-scrollbar pr-2">
                {(!matches || matches.length === 0) ? (
                    <div className="flex items-center justify-center h-full">
                        <p className="text-gray-400 text-center">No se encontraron partidas recientes.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {matches.map((match, index) => (
                            <div 
                                key={match.matchId || index} 
                                className={`flex items-center justify-between p-3 rounded-md transition-all duration-200 ${match.win ? 'bg-blue-900/40 border-l-4 border-blue-500' : 'bg-red-900/40 border-l-4 border-red-500'}`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 bg-black rounded-full border-2 border-lol-gold/50">
                                        {/* <img src={...} /> */}
                                    </div>
                                    <div>
                                        <p className="font-bold text-lol-light-blue">{match.championName || 'N/A'}</p>
                                        <p className="text-xs text-gray-400">{match.queueName || 'Custom'}</p>
                                    </div>
                                </div>
                                <div className="text-center">
                                    <p className="font-mono font-bold text-white">{`${match.kills}/${match.deaths}/${match.assists}`}</p>
                                    <p className={`text-sm font-bold ${match.win ? 'text-green-400' : 'text-red-400'}`}>
                                        {match.win ? 'Victoria' : 'Derrota'}
                                    </p>
                                </div>
                                <div className="text-right text-sm text-gray-400">
                                    <p>{formatDuration(match.gameDuration)}</p>
                                    <p>{new Date(match.gameCreation).toLocaleDateString()}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};