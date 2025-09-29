// src/components/dashboard/Recommendations.jsx
// Este componente muestra recomendaciones de campeones y estrategias
// personalizadas por la IA, basadas en el perfil del usuario (roles/campeones favoritos).

import React from 'react';

/**
 * @param {object} props - Las propiedades del componente.
 * @param {object} props.recommendations - Objeto que contiene las recomendaciones de la IA.
 * Ejemplo: {
 * "championRecommendations": [{name: "Ryze", reason: "Si te gusta el control de zonas y el escalado tardío..."}],
 * "strategyTips": ["En early game, enfócate en...", "Considera rotar a mid al minuto..."]
 * }
 * @param {object} props.userData - Datos del perfil del usuario, usados para mostrar contexto.
 */
const Recommendations = ({ recommendations, userData }) => {
    // Si no hay recomendaciones o si hay un error en ellas, muestra un mensaje.
    if (!recommendations || recommendations.error) {
        return (
            <div className="text-gray-400 text-center py-8 text-lg">
                <p className="font-bold mb-2">No se pudieron cargar las recomendaciones de la IA.</p>
                {recommendations?.error && <p className="text-sm text-red-400">{recommendations.error}</p>}
                <p className="text-sm mt-2">
                    Asegúrate de haber configurado tus roles y campeones favoritos en tu perfil para obtener sugerencias.
                </p>
            </div>
        );
    }

    return (
        <div className="text-lol-light h-full">
            <p className="mb-6 text-lol-light/80 text-lg">
                Aquí tienes recomendaciones de campeones y estrategias personalizadas, pensadas para ti en base a tu estilo de juego preferido (rol/campeones favoritos).
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Sección de Recomendaciones de Campeones */}
                <div className="p-6 bg-black/30 rounded-lg border border-lol-gold/20 shadow-md">
                    <h4 className="font-semibold text-lol-light-blue text-2xl mb-4 border-b border-lol-gold/30 pb-2">
                        Campeones Sugeridos 
                        <span className="text-lol-gold text-lg ml-2">{userData?.favRole1 ? `(${userData.favRole1})` : ''}</span>
                    </h4>
                    <ul className="space-y-4">
                        {(recommendations.championRecommendations && recommendations.championRecommendations.length > 0) ? (
                            recommendations.championRecommendations.map((champ, i) => (
                                <li key={i} className="flex items-start gap-3">
                                    {/* Placeholder para la imagen del campeón */}
                                    <div className="w-10 h-10 flex-shrink-0 bg-gray-700 rounded-full flex items-center justify-center text-sm text-white overflow-hidden">
                                        <span className="font-bold">⭐</span>
                                    </div>
                                    <div>
                                        <p className="font-semibold text-white text-xl">{champ.name}</p>
                                        <p className="text-gray-300 text-base italic">{champ.reason}</p>
                                    </div>
                                </li>
                            ))
                        ) : (
                            <li className="text-gray-400">No hay recomendaciones de campeones en este momento.</li>
                        )}
                    </ul>
                </div>

                {/* Sección de Consejos Estratégicos */}
                <div className="p-6 bg-black/30 rounded-lg border border-lol-gold/20 shadow-md">
                    <h4 className="font-semibold text-lol-light-blue text-2xl mb-4 border-b border-lol-gold/30 pb-2">
                        Consejos Estratégicos
                        <span className="text-lol-gold text-lg ml-2">{userData?.favRole1 ? `(${userData.favRole1})` : ''}</span>
                    </h4>
                    <ul className="space-y-4 list-disc list-inside ml-4">
                        {(recommendations.strategyTips && recommendations.strategyTips.length > 0) ? (
                            recommendations.strategyTips.map((tip, i) => (
                                <li key={i} className="text-gray-300 text-base leading-relaxed">
                                    {tip}
                                </li>
                            ))
                        ) : (
                            <li className="text-gray-400">No hay consejos estratégicos específicos en este momento.</li>
                        )}
                    </ul>
                </div>
            </div>
        </div>
    );
};

export default Recommendations;