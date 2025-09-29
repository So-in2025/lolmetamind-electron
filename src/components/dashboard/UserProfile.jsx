// src/components/dashboard/UserProfile.jsx
"use client";

import React from 'react';

export default function UserProfile({ userData, rankData }) {
    if (!userData) {
        return (
            <div className="bg-lol-dark-blue p-6 rounded-lg border border-lol-gold/30 text-center text-lol-light/70">
                Cargando perfil...
            </div>
        );
    }

    const soloQueue = rankData?.find(rank => rank.queueType === 'RANKED_SOLO_5x5');

    return (
        <div className="bg-lol-dark-blue p-6 rounded-lg border border-lol-gold/30 shadow-lg">
            <h2 className="text-2xl font-bold text-lol-gold mb-5 border-b border-lol-gold/50 pb-2">Perfil de Invocador</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 text-lol-light text-base">
                <p><strong>Usuario:</strong> <span className="text-lol-light-blue">{userData.username}</span></p>
                <p><strong>Invocador:</strong> <span className="text-lol-light-blue">{userData.summonerName}#{userData.tagline}</span></p>
                <p><strong>Región:</strong> <span className="text-lol-light-blue">{userData.region}</span></p>
                <p>
                    <strong>Clasificatoria:</strong> {' '}
                    {soloQueue ? (
                        <span className="font-semibold text-lol-highlight">{`${soloQueue.tier} ${soloQueue.rank} - ${soloQueue.leaguePoints} LP`}</span>
                    ) : (
                        <span className="text-gray-400">Unranked</span>
                    )}
                </p>
                <p><strong>Rol Principal:</strong> <span className="text-lol-light-blue">{userData.favRole1 || 'N/A'}</span></p>
                <p><strong>Rol Secundario:</strong> <span className="text-lol-light-blue">{userData.favRole2 || 'N/A'}</span></p>
                <p><strong>Campeón Principal:</strong> <span className="text-lol-light-blue">{userData.favChamp1 || 'N/A'}</span></p>
                <p><strong>Campeón Secundario:</strong> <span className="text-lol-light-blue">{userData.favChamp2 || 'N/A'}</span></p>
            </div>
        </div>
    );
};