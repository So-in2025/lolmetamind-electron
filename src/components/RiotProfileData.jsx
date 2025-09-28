// src/components/RiotProfileData.jsx

"use client";

import React from 'react';
import useRiotProfileData from '@/hooks/useRiotProfileData'; 
import { TrophyIcon, StarIcon, ExclamationTriangleIcon, ClockIcon } from '@heroicons/react/24/solid';

const RiotProfileData = () => {
  const { mode, summonerRankData, championMasteries } = useRiotProfileData();

  const getRankColor = (tier) => {
    switch (tier) {
      case 'CHALLENGER': return 'text-red-500 border-red-500';
      case 'GRANDMASTER': return 'text-purple-500 border-purple-500';
      case 'MASTER': return 'text-purple-400 border-purple-400';
      case 'DIAMOND': return 'text-blue-500 border-blue-500';
      case 'PLATINUM': return 'text-blue-400 border-blue-400';
      case 'GOLD': return 'text-lol-gold border-lol-gold';
      case 'SILVER': return 'text-lol-grey border-lol-grey';
      case 'BRONZE': return 'text-amber-700 border-amber-700';
      default: return 'text-lol-grey/70 border-lol-grey/70';
    }
  };

  const soloQ = summonerRankData.find(entry => entry.queueType === 'RANKED_SOLO_5x5');
  const flexQ = summonerRankData.find(entry => entry.queueType === 'RANKED_FLEX_SR');

  if (mode === 'Loading') {
    return (
      <div className="text-center p-6 bg-lol-gray/30 rounded-lg text-lol-text flex items-center justify-center">
        <ClockIcon className="w-5 h-5 mr-2 animate-spin" /> Esperando el primer ciclo de sondeo...
      </div>
    );
  }

  if (mode === 'LCU_ACTIVE' || mode === 'Realtime') {
    return (
      <div className="text-center p-6 bg-lol-blue/20 border-2 border-lol-blue rounded-lg text-lol-light font-bold shadow-xl">
        <ExclamationTriangleIcon className="w-6 h-6 inline mr-2 text-lol-blue-light" />
        LCU detectado en Partida Activa. La IA te está analizando en tiempo real.
      </div>
    );
  }
  
  if (mode === 'NO_DATA') {
      return (
        <div className="text-center p-6 bg-lol-gray/30 border-2 border-dashed border-lol-grey rounded-lg text-lol-text/70">
            <ExclamationTriangleIcon className="w-6 h-6 inline mr-2 text-lol-grey" />
            No se pudo conectar al LCU ni a la API de Riot. Por favor, verifica tu clave.
        </div>
      );
  }

  return (
    <div className="bg-lol-dark-blue p-6 rounded-lg shadow-2xl border border-lol-gold/30 text-lol-text">
      <h3 className="text-xl font-bold text-lol-gold mb-4 border-b border-lol-gold/50 pb-2 flex items-center">
        <TrophyIcon className="w-6 h-6 mr-2" />
        Datos de Perfil RIOT (Modo Estratégico)
      </h3>

      {/* RENDERIZADO DE LIGAS */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          { name: 'Solo/Duo', data: soloQ },
          { name: 'Flexible', data: flexQ }
        ].map((queue, index) => (
          <div key={index}>
            <h4 className="text-lg font-semibold text-lol-blue mb-2">{queue.name}</h4>
            {queue.data ? (
              <div className={`p-3 border-2 rounded-md ${getRankColor(queue.data.tier)} bg-lol-gray/20`}>
                <span className="font-extrabold text-2xl block">
                  {queue.data.tier} {queue.data.rank}
                </span>
                <span className="text-sm">
                  {queue.data.leaguePoints} LP / {queue.data.wins} V ({Math.round(queue.data.wins / (queue.data.wins + queue.data.losses) * 100)}% WR)
                </span>
              </div>
            ) : (
              <p className="text-sm text-lol-grey">No clasificado.</p>
            )}
          </div>
        ))}
      </div>

      {/* RENDERIZADO DE MAESTRÍAS */}
      <div>
        <h4 className="text-lg font-semibold text-lol-blue mb-2 flex items-center">
          <StarIcon className="w-5 h-5 mr-2" />
          Maestrías de Campeón (Top 5)
        </h4>
        <ul className="space-y-2">
          {championMasteries.map((mastery, index) => (
            <li key={index} className="p-2 bg-lol-input-bg rounded-md flex justify-between items-center text-sm border-l-4 border-lol-gold/70">
              <span className='text-lol-light'>ID Campeón: {mastery.championId}</span> 
              <span className="font-bold text-lol-gold">Nivel {mastery.championLevel} ({mastery.championPoints} pts)</span>
            </li>
          ))}
          {championMasteries.length === 0 && <p className="text-sm text-lol-grey">No se obtuvieron datos de maestría.</p>}
        </ul>
      </div>
    </div>
  );
};

export default RiotProfileData;