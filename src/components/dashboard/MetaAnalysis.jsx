// src/components/dashboard/MetaAnalysis.jsx
// Este componente se encarga de mostrar la información del "meta" actual del juego,
// es decir, los campeones más fuertes en cada rol según el análisis de la IA.

import React from 'react';

/**
 * @param {object} props - Las propiedades del componente.
 * @param {object} props.metaData - Objeto que contiene los datos del meta, estructurado por rol.
 * Ejemplo: {
 * "TOP": [{name: "Aatrox", reason: "Fuerte en duelos y sustain"}, ...],
 * "JUNGLE": [...],
 * ...
 * }
 */
const MetaAnalysis = ({ metaData }) => {
    // Si no hay datos del meta o si hay un error en ellos, muestra un mensaje.
    if (!metaData || metaData.error) {
        return (
            <div className="text-gray-400 text-center py-8 text-lg">
                <p className="font-bold mb-2">No se pudo cargar la información del Meta actual.</p>
                {metaData?.error && <p className="text-sm text-red-400">{metaData.error}</p>}
                <p className="text-sm mt-2">Intenta actualizar la sección o verifica tu conexión.</p>
            </div>
        );
    }

    // Define el orden de los roles para una visualización consistente.
    const rolesOrder = ["TOP", "JUNGLE", "MID", "ADC", "SUPPORT"];

    return (
        <div className="text-lol-light h-full">
            <p className="mb-6 text-lol-light/80 text-lg">
                Explora los campeones más fuertes en el meta actual, según el análisis de nuestra IA.
            </p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
                {/* Itera sobre los roles en el orden definido */}
                {rolesOrder.map((role) => {
                    const champions = metaData[role];
                    if (!champions || champions.length === 0) {
                        return (
                            <div key={role} className="bg-black/30 p-4 rounded-lg border border-lol-gold/20">
                                <h4 className="font-bold text-lol-light-blue uppercase border-b border-lol-gold/30 pb-2 mb-3 text-xl">
                                    {role}
                                </h4>
                                <p className="text-gray-500 text-sm">No hay datos de campeones meta para este rol.</p>
                            </div>
                        );
                    }
                    return (
                        <div key={role} className="bg-black/30 p-4 rounded-lg border border-lol-gold/20 shadow-md">
                            <h4 className="font-bold text-lol-light-blue uppercase border-b border-lol-gold/30 pb-2 mb-3 text-xl">
                                {role}
                            </h4>
                            <ul className="space-y-3">
                                {champions.map((champ, index) => (
                                    <li key={index} className="flex items-start gap-3">
                                        {/* Placeholder para la imagen del campeón */}
                                        <div className="w-8 h-8 flex-shrink-0 bg-gray-700 rounded-full flex items-center justify-center text-xs text-white overflow-hidden">
                                            {/* Aquí iría la imagen del campeón si tuvieras las URLs */}
                                            {/* <img src={`http://ddragon.leagueoflegends.com/cdn/14.10.1/img/champion/${champ.name}.png`} alt={champ.name} className="w-full h-full object-cover" /> */}
                                            <span className="font-bold">✨</span>
                                        </div>
                                        <div>
                                            <p className="font-semibold text-white text-lg">{champ.name}</p>
                                            <p className="text-gray-300 text-sm italic">{champ.reason}</p>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default MetaAnalysis;