// src/components/RiotProfileData.jsx

"use client";

import React from 'react';
import useRiotProfileData from '@/hooks/useRiotProfileData'; 
import { TrophyIcon, StarIcon, ExclamationTriangleIcon, ClockIcon, CheckCircleIcon, WifiIcon, ChartBarSquareIcon, UserIcon, GlobeAltIcon, ServerStackIcon, MapPinIcon, HeartIcon } from '@heroicons/react/24/solid';

// 🔑 SIMULACIÓN DE DATOS GLOBALES (Reemplaza con datos REALES de tu hook/store/DB)
const simulatedSummonerData = {
    summonerName: "Jh0wner",
    userRegion: "LAS",
    lolServiceStatus: "OPERATIONAL", // OPERATIONAL, HIGH_LATENCY, DOWN
    zodiacSign: "Leo", // 🔑 NUEVO: Desde tu DB
};

const simulatedStrategicStats = {
    avgKills: 6.2,
    avgDeaths: 3.5,
    avgAssists: 7.1,
    avgKDA: '3.8:1', 
    avgCS: '7.1 CS/min', 
    avgVisionScore: '35.4',
    avgGoldPerMin: '410 G/min',
    recentWinRate: '58%',
    killParticipation: '55%',
    damagePerMinute: '720 DPM',
    // 🔑 NUEVO: Campeones preferidos (desde tu DB, con URL de imagen)
    favoriteChampions: [
        { name: 'Katarina', winRate: '65%', games: 20, imageUrl: 'https://ddragon.leagueoflegends.com/cdn/13.24.1/img/champion/Katarina.png' },
        { name: 'Ahri', winRate: '51%', games: 35, imageUrl: 'https://ddragon.leagueoflegends.com/cdn/13.24.1/img/champion/Ahri.png' },
        { name: 'Yasuo', winRate: '48%', games: 15, imageUrl: 'https://ddragon.leagueoflegends.com/cdn/13.24.1/img/champion/Yasuo.png' }
    ],
    // 🔑 NUEVO: Roles preferidos (desde tu DB)
    preferredRoles: [
        { name: 'MID', winRate: '60%' },
        { name: 'JUNGLE', winRate: '50%' },
        { name: 'TOP', winRate: '40%' }
    ]
};

// 🔑 NUEVO COMPONENTE: Encabezado con datos críticos (incluyendo Signo Zodiacal)
const ProfileHeader = ({ summonerName, region, status, zodiacSign }) => {
    let statusText, statusColor, statusIcon;

    switch (status) {
        case 'OPERATIONAL':
            statusText = 'Servicio LoL: Operacional';
            statusColor = 'text-green-500';
            statusIcon = CheckCircleIcon;
            break;
        case 'HIGH_LATENCY':
            statusText = 'Servicio LoL: Latencia Alta';
            statusColor = 'text-yellow-500';
            statusIcon = ExclamationTriangleIcon;
            break;
        case 'DOWN':
            statusText = 'Servicio LoL: Caído';
            statusColor = 'text-red-500';
            statusIcon = ServerStackIcon;
            break;
        default:
            statusText = 'Estado Desconocido';
            statusColor = 'text-lol-grey';
            statusIcon = ClockIcon;
            break;
    }

    const StatusIcon = statusIcon;

    return (
        <div className="bg-lol-input-bg/70 p-4 rounded-lg mb-6 border border-lol-gold/30 shadow-lg flex justify-between items-center user-select-none">
            {/* Nombre e Ícono */}
            <div className="flex items-center">
                <UserIcon className="w-8 h-8 text-lol-gold mr-3" />
                <div>
                    <h4 className="text-2xl font-extrabold text-lol-gold-light">{summonerName}</h4>
                    <p className="text-sm text-lol-grey/70 flex items-center">
                        <GlobeAltIcon className="w-4 h-4 mr-1" />
                        Región: <span className="font-semibold text-lol-text ml-1">{region}</span>
                        {zodiacSign && ( // Mostrar signo zodiacal si está disponible
                            <span className="ml-4 flex items-center">
                                <HeartIcon className="w-4 h-4 mr-1 text-red-400" />
                                <span className="font-semibold text-lol-text">{zodiacSign}</span>
                            </span>
                        )}
                    </p>
                </div>
            </div>

            {/* Estado del Servicio */}
            <div className="text-right">
                <p className={`text-xs font-semibold ${statusColor} flex items-center justify-end`}>
                    <StatusIcon className={`w-4 h-4 mr-1 ${statusColor}`} />
                    {statusText}
                </p>
                <p className="text-sm text-lol-text mt-1">Status V4 OK</p>
            </div>
        </div>
    );
};


const RiotProfileData = () => {
  const { 
    mode, 
    summonerRankData, 
    championMasteries, 
    strategicStats = simulatedStrategicStats,
    summonerName = simulatedSummonerData.summonerName,
    userRegion = simulatedSummonerData.userRegion,
    lolServiceStatus = simulatedSummonerData.lolServiceStatus,
    zodiacSign = simulatedSummonerData.zodiacSign, // 🔑 Nuevo: Obtener de tu hook
  } = useRiotProfileData();

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

  const soloQ = summonerRankData?.find(entry => entry.queueType === 'RANKED_SOLO_5x5');
  const flexQ = summonerRankData?.find(entry => entry.queueType === 'RANKED_FLEX_SR');
  
  const getModeIndicator = () => {
    if (mode === 'Loading') return { text: 'CONECTANDO/CARGANDO...', color: 'text-yellow-400 animate-pulse', icon: ClockIcon };
    if (mode === 'LCU_ACTIVE' || mode === 'Realtime') return { text: 'PARTIDA ACTIVA (Realtime)', color: 'text-red-500 border-red-500 animate-pulse', icon: WifiIcon };
    if (mode === 'Strategic') return { text: 'MODO ESTRATÉGICO (API Ok)', color: 'text-green-500', icon: CheckCircleIcon };
    return { text: 'SIN CONEXIÓN / NO DATA', color: 'text-lol-grey', icon: ExclamationTriangleIcon };
  };
  const ModeIndicator = getModeIndicator();
  const DataBoxClass = "p-4 rounded-lg shadow-inner bg-lol-dark-blue/70 border border-lol-grey-dark";

  // Manejo de estados de carga/error (Mantenido)
  if (mode === 'Loading' || mode === 'LCU_ACTIVE' || mode === 'Realtime' || mode === 'NO_DATA') {
    const StatusIcon = ModeIndicator.icon;
    const StatusText = mode === 'Loading' ? 'CARGANDO DATOS INICIALES...' : ModeIndicator.text;
    
    return (
        <div className="p-6 rounded-lg border-2 border-lol-gold/50 bg-lol-dark-blue/90 shadow-md h-full flex flex-col justify-center items-center">
            <h3 className="text-xl font-bold text-lol-gold mb-4">INICIANDO SISTEMAS</h3>
            <StatusIcon className={`w-10 h-10 mb-3 ${ModeIndicator.color}`} />
            <span className="text-lg font-bold text-lol-text">{StatusText}</span>
        </div>
    );
  }


  return (
    <div className="bg-lol-dark-blue/90 p-6 rounded-lg shadow-2xl border border-lol-gold/30 text-lol-text h-full flex flex-col">
      
      {/* 🔑 ENCABEZADO CON NOMBRE, REGIÓN, ESTADO DEL SERVIDOR Y SIGNO ZODIACAL */}
      <ProfileHeader 
        summonerName={summonerName} 
        region={userRegion} 
        status={lolServiceStatus} 
        zodiacSign={zodiacSign} // 🔑 Pasamos el signo zodiacal
      />
      
      <h3 className="text-xl font-bold text-lol-gold mb-4 border-b border-lol-gold/50 pb-2 flex items-center">
        <TrophyIcon className="w-6 h-6 mr-2" />
        Clasificatorias y Estado
      </h3>

      {/* 1. RANGOS Y ESTATUS DE ADQUISICIÓN */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* Estatus de la IA/API (Compactado) */}
        <div className={`p-4 rounded-lg border-2 ${ModeIndicator.color} bg-lol-dark-blue/90 shadow-md col-span-1`}>
            <h4 className="font-semibold text-lg text-lol-text">API Status (V4/V5)</h4>
            <div className="flex items-center mt-2">
                <ModeIndicator.icon className={`w-5 h-5 mr-2 ${ModeIndicator.color}`} />
                <span className={`text-sm font-bold ${ModeIndicator.color}`}>{ModeIndicator.text}</span>
            </div>
            <p className="text-xs text-lol-grey/70 mt-1">Todos los endpoints (Match/Timeline) OK.</p>
        </div>

        {/* Solo/Duo */}
        <div className={`${DataBoxClass} col-span-1`}>
            <h4 className="text-lg font-semibold text-lol-blue mb-2">Solo/Duo</h4>
            {soloQ ? (
              <div className={`p-2 border-2 rounded-md ${getRankColor(soloQ.tier)} bg-lol-grey/20 text-center`}>
                <span className="font-extrabold text-2xl block">
                  {soloQ.tier} {soloQ.rank}
                </span>
                <span className="text-sm">
                  {soloQ.leaguePoints} LP / {Math.round(soloQ.wins / (soloQ.wins + soloQ.losses) * 100)}% WR
                </span>
              </div>
            ) : (
              <p className="text-sm text-lol-grey/70 text-center py-2">No clasificado.</p>
            )}
        </div>

        {/* Flexible */}
        <div className={`${DataBoxClass} col-span-1`}>
            <h4 className="text-lg font-semibold text-lol-blue mb-2">Flexible</h4>
            {flexQ ? (
              <div className={`p-2 border-2 rounded-md ${getRankColor(flexQ.tier)} bg-lol-grey/20 text-center`}>
                <span className="font-extrabold text-2xl block">
                  {flexQ.tier} {flexQ.rank}
                </span>
                <span className="text-sm">
                  {flexQ.leaguePoints} LP / {Math.round(flexQ.wins / (flexQ.wins + flexQ.losses) * 100)}% WR
                </span>
              </div>
            ) : (
              <p className="text-sm text-lol-grey/70 text-center py-2">No clasificado.</p>
            )}
        </div>
      </div>
      
      {/* 2. MÉTRICAS ESTRATÉGICAS CLAVE (KDA, CS, ORO, WR) */}
      <div className="mb-6">
          <h4 className="text-lg font-semibold text-lol-gold mb-3 border-b border-lol-gold/30 pb-1 flex items-center">
              <ChartBarSquareIcon className="w-5 h-5 mr-2" />
              Métricas Estratégicas Clave (Historial Reciente)
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* KDA Promedio */}
              <div className="p-3 bg-lol-input-bg rounded-md shadow-md border border-lol-gold-accent/20 text-center">
                  <p className="text-2xl font-extrabold text-green-400">{strategicStats.avgKDA}</p>
                  <p className="text-xs text-lol-grey/70 uppercase">KDA Promedio</p>
              </div>
              {/* CS Promedio */}
              <div className="p-3 bg-lol-input-bg rounded-md shadow-md border border-lol-gold-accent/20 text-center">
                  <p className="text-2xl font-extrabold text-lol-text">{strategicStats.avgCS}</p>
                  <p className="text-xs text-lol-grey/70 uppercase">CS Promedio</p>
              </div>
              {/* Oro/Min */}
              <div className="p-3 bg-lol-input-bg rounded-md shadow-md border border-lol-gold-accent/20 text-center">
                  <p className="text-2xl font-extrabold text-yellow-500">{strategicStats.avgGoldPerMin}</p>
                  <p className="text-xs text-lol-grey/70 uppercase">Oro/Min Promedio</p>
              </div>
              {/* Win Rate Reciente */}
              <div className="p-3 bg-lol-input-bg rounded-md shadow-md border border-lol-gold-accent/20 text-center">
                  <p className="text-2xl font-extrabold text-blue-400">{strategicStats.recentWinRate}</p>
                  <p className="text-xs text-lol-grey/70 uppercase">Win Rate Reciente</p>
              </div>
          </div>
          <p className="text-xs text-lol-grey/70 mt-3 italic">
            Estas métricas son calculadas a partir de tus últimos 20 juegos.
          </p>
      </div>

      {/* 🔑 3. RESUMEN DE CAMPEONES Y ROLES (Ahora con datos de tu DB) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-grow">
          {/* Top Campeones */}
          <div className="flex flex-col">
              <h4 className="text-lg font-semibold text-lol-blue mb-2 flex items-center">
                  <StarIcon className="w-5 h-5 mr-2" />
                  Top Campeones Preferidos
              </h4>
              <ul className="space-y-2 flex-grow overflow-y-auto no-scrollbar pr-1">
                  {strategicStats.favoriteChampions && strategicStats.favoriteChampions.map((champ, index) => (
                      <li key={index} className="p-2 bg-lol-input-bg rounded-md flex justify-between items-center text-sm border-l-4 border-lol-gold/70 shadow-md">
                          <div className='flex items-center'>
                              {/* 🔑 Usamos la imageUrl de tu DB */}
                              {champ.imageUrl && <img src={champ.imageUrl} alt={champ.name} className="w-8 h-8 rounded-full mr-2 border-2 border-lol-gold/50" />}
                              <span className='text-lol-light font-semibold'>{champ.name}</span> 
                          </div>
                          <div className='text-right'>
                              <span className="font-bold text-green-400 block">{champ.winRate} WR</span>
                              <span className="text-xs text-lol-grey/70">{champ.games} Partidas</span>
                          </div>
                      </li>
                  ))}
                  {(!strategicStats.favoriteChampions || strategicStats.favoriteChampions.length === 0) && <p className="text-sm text-lol-grey/70">No hay datos de campeones preferidos.</p>}
              </ul>
          </div>
          
          {/* Roles Preferidos */}
          <div className="flex flex-col">
              <h4 className="text-lg font-semibold text-lol-blue mb-2 flex items-center">
                  <MapPinIcon className="w-5 h-5 mr-2" />
                  Roles Preferidos
              </h4>
              <ul className="space-y-2 flex-grow overflow-y-auto no-scrollbar pr-1">
                  {strategicStats.preferredRoles && strategicStats.preferredRoles.map((role, index) => (
                      <li key={index} className="p-2 bg-lol-input-bg rounded-md flex justify-between items-center text-sm border-l-4 border-lol-blue/70 shadow-md">
                          <span className='text-lol-light font-semibold'>{role.name}</span> 
                          <span className="font-bold text-blue-400">{role.winRate} WR</span>
                      </li>
                  ))}
                  {(!strategicStats.preferredRoles || strategicStats.preferredRoles.length === 0) && <p className="text-sm text-lol-grey/70">No hay datos de roles preferidos.</p>}
              </ul>
          </div>
      </div>
    </div>
  );
};

export default RiotProfileData;