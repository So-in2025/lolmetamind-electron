// src/components/dashboard/RecentMatches.jsx
// Este componente se encarga de mostrar un resumen de las partidas recientes
// del invocador, incluyendo campeón, KDA, resultado y duración.

import React from 'react';

/**
 * Función auxiliar para formatear la duración del juego de segundos a "MM:SS".
 * @param {number} seconds - Duración del juego en segundos.
 * @returns {string} Duración formateada.
 */
const formatDuration = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
};

/**
 * @param {object} props - Las propiedades del componente.
 * @param {Array<object>} props.matches - Un array de objetos, donde cada objeto representa una partida reciente.
 * Cada objeto de partida debería tener al menos:
 * - `matchId`: ID único de la partida.
 * - `championName`: Nombre del campeón jugado.
 * - `kills`, `deaths`, `assists`: Estadísticas de KDA.
 * - `win`: Booleano indicando si fue una victoria.
 * - `gameDuration`: Duración de la partida en segundos.
 * - `gameCreation`: Timestamp de creación de la partida.
 * - `queueName`: Nombre de la cola (ej. "Ranked Solo/Duo").
 */
const RecentMatches = ({ matches }) => {
    return (
        <div className="bg-lol-dark-blue p-6 rounded-lg border border-lol-gold/30 shadow-lg flex flex-col h-full">
            <h2 className="text-3xl font-bold text-lol-gold mb-5 border-b border-lol-gold/50 pb-2">Partidas Recientes</h2>
            
            <div className="flex-grow overflow-y-auto custom-scrollbar"> {/* Contenedor con scroll para muchas partidas */}
                {/* Mensaje si no hay partidas o están cargando */}
                {(!matches || matches.length === 0) ? (
                    <p className="text-gray-400 text-center py-8 text-lg">
                        No se encontraron partidas recientes o la API de Riot no está disponible.
                    </p>
                ) : (
                    <div className="space-y-4">
                        {matches.map((match) => (
                            <div 
                                key={match.matchId} 
                                className={`flex items-center justify-between p-4 rounded-lg 
                                            ${match.win ? 'bg-blue-900/30 border-l-4 border-blue-500' : 'bg-red-900/30 border-l-4 border-red-500'}
                                            hover:bg-opacity-40 transition-all duration-200`}
                            >
                                {/* Sección del Campeón */}
                                <div className="flex items-center gap-4 min-w-[150px]">
                                    {/* Placeholder para el ícono del campeón.
                                        En una implementación real, aquí se usaría un <img> con la URL del ícono
                                        de la API de Data Dragon, ej: `http://ddragon.leagueoflegends.com/cdn/{version}/img/champion/${match.championName}.png`
                                    */}
                                    <div className="w-12 h-12 bg-gray-700 rounded-full flex items-center justify-center text-xs text-white">
                                        {/* <img src={`/images/champions/${match.championName}.png`} alt={match.championName} className="w-full h-full rounded-full" /> */}
                                        <span className="font-bold hidden sm:block">ICON</span> {/* Visible si no hay imagen */}
                                    </div>
                                    <div>
                                        <p className="font-bold text-lol-light-blue text-lg">{match.championName}</p>
                                        <p className="text-xs text-gray-400">{match.queueName}</p>
                                    </div>
                                </div>

                                {/* Sección del KDA y Resultado */}
                                <div className="text-center min-w-[100px]">
                                    <p className="font-mono text-xl font-bold text-white">
                                        {`${match.kills}/${match.deaths}/${match.assists}`}
                                    </p>
                                    <p className={`text-md font-bold ${match.win ? 'text-green-400' : 'text-red-400'} mt-1`}>
                                        {match.win ? 'Victoria' : 'Derrota'}
                                    </p>
                                </div>

                                {/* Sección de Duración y Fecha */}
                                <div className="text-right text-sm text-gray-400 min-w-[100px]">
                                    <p className="text-white text-base">{formatDuration(match.gameDuration)}</p>
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

export default RecentMatches;