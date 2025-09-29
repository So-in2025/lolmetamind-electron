// src/components/dashboard/UserProfile.jsx
// Este componente se encarga de mostrar la información esencial del perfil
// del invocador, incluyendo datos de registro y el ranking actual en Solo/Duo.

import React from 'react';

/**
 * @param {object} props - Las propiedades del componente.
 * @param {object} props.userData - Objeto que contiene los datos de perfil del usuario (username, summonerName, tagline, region, favRole1, etc.).
 * @param {Array<object>} props.rankData - Array de objetos de ranking obtenidos de la API de Riot (ej. ligas para Solo/Duo, Flex).
 */
const UserProfile = ({ userData, rankData }) => {
    // Si userData aún no ha sido cargado, muestra un mensaje de carga.
    if (!userData) {
        return (
            <div className="bg-lol-dark-blue p-6 rounded-lg border border-lol-gold/30 text-center text-lol-light/70">
                <p>Cargando perfil de invocador...</p>
            </div>
        );
    }

    // Busca el ranking de Solo/Duo 5v5 en el array de datos de ranking.
    // Esto asume que `rankData` contendrá objetos con una propiedad `queueType` (ej. "RANKED_SOLO_5x5").
    const soloQueue = rankData?.find(rank => rank.queueType === 'RANKED_SOLO_5x5');

    return (
        <div className="bg-lol-dark-blue p-6 rounded-lg border border-lol-gold/30 shadow-lg">
            <h2 className="text-3xl font-bold text-lol-gold mb-5 border-b border-lol-gold/50 pb-2">Perfil de Invocador</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 text-lol-light text-lg">
                {/* Información básica del usuario / invocador */}
                <p><strong>Usuario:</strong> <span className="text-lol-light-blue">{userData.username}</span></p>
                <p><strong>Invocador:</strong> <span className="text-lol-light-blue">{userData.summonerName}</span><span className="text-gray-400">#{userData.tagline}</span></p>
                <p><strong>Región:</strong> <span className="text-lol-light-blue">{userData.region}</span></p>
                
                {/* Ranking de Solo/Duo */}
                <p>
                    <strong>Clasificatoria (Solo/Duo):</strong> {' '}
                    {soloQueue ? (
                        <span className="text-lol-light-blue font-semibold">{`${soloQueue.tier} ${soloQueue.rank} (${soloQueue.leaguePoints} LP)`}</span>
                    ) : (
                        <span className="text-gray-400">Unranked</span>
                    )}
                </p>
                
                {/* Preferencias de rol y campeón */}
                <p><strong>Rol Principal:</strong> <span className="text-lol-light-blue">{userData.favRole1 || 'No especificado'}</span></p>
                <p><strong>Rol Secundario:</strong> <span className="text-lol-light-blue">{userData.favRole2 || 'No especificado'}</span></p>
                <p><strong>Campeón Principal:</strong> <span className="text-lol-light-blue">{userData.favChamp1 || 'No especificado'}</span></p>
                <p><strong>Campeón Secundario:</strong> <span className="text-lol-light-blue">{userData.favChamp2 || 'No especificado'}</span></p>

                {/* Otros datos de perfil, como el signo zodiacal (si es relevante en tu UX) */}
                <p><strong>Signo Zodiacal:</strong> <span className="text-lol-light-blue">{userData.zodiacSign || 'No especificado'}</span></p>
            </div>
        </div>
    );
};

export default UserProfile;