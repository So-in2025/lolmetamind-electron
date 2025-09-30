// lolmetamind-electron/src/components/dashboard/RiotProfileData.jsx
"use client";

import React, { useEffect } from 'react';
import Image from 'next/image';
import useRiotProfileData from '@/hooks/useRiotProfileData'; // Asegúrate de que el path sea correcto

// Sub-componentes para mejorar la legibilidad
const ProfileHeader = ({ summonerName, tagline, region }) => (
    <div className="flex flex-col mb-4">
        <h2 className="text-xl font-display text-lol-gold mb-1">
            {summonerName}#{tagline}
        </h2>
        <p className="text-sm text-lol-light-grey">Región: {region}</p>
    </div>
);

const ProfileDetail = ({ label, value }) => (
    <div className="flex justify-between items-center py-1 border-b border-lol-dark-blue/50 last:border-b-0">
        <span className="text-lol-grey text-sm">{label}:</span>
        <span className="text-lol-light text-sm font-semibold">{value}</span>
    </div>
);

const MatchHistoryDisplay = ({ matches }) => (
    <div className="flex flex-col">
        <h3 className="text-lg font-display text-lol-gold mb-2">Partidas Recientes</h3>
        {matches && matches.length > 0 ? (
            <div className="space-y-2">
                {matches.map((match, index) => (
                    <div key={index} className="bg-lol-dark-blue/70 p-2 rounded-md flex justify-between items-center">
                        <span className="text-lol-light text-sm">Match {match.matchId}</span>
                        <span className="text-lol-gold text-sm">KDA: {match.kills}/{match.deaths}/{match.assists}</span>
                    </div>
                ))}
            </div>
        ) : (
            <p className="text-lol-grey text-sm">No se encontraron partidas recientes o la API de Riot no está disponible.</p>
        )}
    </div>
);

export default function RiotProfileData() {
    const { 
        mode, 
        summonerName, 
        userRegion, 
        zodiacSign, 
        strategicStats, 
        championMasteries, 
        matchHistory,
        lolServiceStatus,
        userProfile // Acceso al objeto completo para tagline
    } = useRiotProfileData();

    // Extraemos tagline del userProfile que viene del AppStateContext
    const tagline = userProfile?.tagline; 

    // console.log para depuración
    useEffect(() => {
        console.log("[RiotProfileData] Hook mode:", mode);
        console.log("[RiotProfileData] Profile Data:", { summonerName, userRegion, zodiacSign, strategicStats, championMasteries });
        console.log("[RiotProfileData] lolServiceStatus:", lolServiceStatus);
    }, [mode, summonerName, userRegion, zodiacSign, strategicStats, championMasteries, lolServiceStatus]);

    if (mode === 'Loading') {
        return (
            <div className="flex flex-col items-center justify-center p-6 bg-lol-blue-medium rounded-lg text-lol-gold">
                <p>Cargando perfil de invocador...</p>
                {/* Puedes añadir un spinner aquí */}
            </div>
        );
    }

    if (mode === 'NO_DATA') {
        return (
            <div className="flex flex-col items-center justify-center p-6 bg-red-900/40 rounded-lg text-red-400">
                <p>Error al cargar el perfil. {lolServiceStatus}</p>
                <p className="text-sm mt-2">Por favor, asegúrate de que tu nombre de invocador y la clave de API de Riot estén configurados correctamente.</p>
            </div>
        );
    }

    // Modo 'Strategic' (o Realtime, si lo implementas)
    return (
        <div className="p-6 bg-lol-blue-medium rounded-lg shadow-lg grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Perfil de Invocador */}
            <div className="col-span-1 md:col-span-1 bg-lol-blue-dark p-4 rounded-lg">
                <h3 className="text-lg font-display text-lol-gold mb-3">Perfil de Invocador</h3>
                <ProfileHeader summonerName={summonerName} tagline={tagline} region={userRegion} />

                <div className="space-y-2">
                    {/* ELIMINADO: Clasificatoria */}
                    <ProfileDetail label="Rol Principal" value={strategicStats.preferredRoles[0]?.name || 'No especificado'} />
                    <ProfileDetail label="Rol Secundario" value={strategicStats.preferredRoles[1]?.name || 'No especificado'} />
                    <ProfileDetail label="Campeón Principal" value={strategicStats.favoriteChampions[0]?.name || 'No especificado'} />
                    <ProfileDetail label="Campeón Secundario" value={strategicStats.favoriteChampions[1]?.name || 'No especificado'} />
                    <ProfileDetail label="Signo Zodiacal" value={zodiacSign || 'No especificado'} />
                </div>
            </div>

            {/* Análisis con IA (Este componente probablemente debería ser un wrapper que maneje los hijos AI) */}
            <div className="col-span-1 md:col-span-2 bg-lol-blue-dark p-4 rounded-lg">
                <h3 className="text-lg font-display text-lol-gold mb-3">Análisis con IA</h3>
                {/* Aquí irían los componentes de IA, envueltos en su propia lógica de espera si es necesario */}
                <div className="flex space-x-4 mb-4 border-b border-lol-dark-blue">
                    <button className="text-lol-gold hover:text-white pb-2 border-b-2 border-lol-gold">Evaluar Rendimiento</button>
                    <button className="text-lol-grey hover:text-white pb-2">Obtener Consejos</button>
                    <button className="text-lol-grey hover:text-white pb-2">Generar Desafíos</button>
                </div>
                {/* Puedes poner aquí el componente que muestra los errores de IA */}
                <div className="text-red-400 text-sm mt-2">
                    Error en el análisis: Error al contactar el backend para la IA. Request failed with status code 400 <br/>
                    Verifica tu conexión y tu clave API de Riot.
                </div>
            </div>

            {/* Partidas Recientes */}
            <div className="col-span-1 md:col-span-3 bg-lol-blue-dark p-4 rounded-lg">
                <MatchHistoryDisplay matches={matchHistory} />
            </div>
        </div>
    );
}