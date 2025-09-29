// src/components/dashboard/Recommendations.jsx
"use client";

import React from 'react';

export default function Recommendations({ recommendations, userData }) {
    if (!recommendations || recommendations.error) {
        return (
            <div className="flex items-center justify-center h-full">
                <p className="text-gray-400 text-center">No se pudieron cargar las recomendaciones de la IA.</p>
            </div>
        );
    }

    return (
        <div className="text-lol-light h-full overflow-y-auto custom-scrollbar pr-2">
            <p className="mb-4 text-lol-light/80">
                Basado en tu perfil, la IA te recomienda lo siguiente para mejorar tu juego:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-black/30 rounded-lg border border-lol-gold/20">
                    <h4 className="font-semibold text-lol-light-blue text-lg mb-2">Campeones Sugeridos</h4>
                    <ul className="space-y-3">
                        {recommendations.championRecommendations?.length > 0 ? (
                            recommendations.championRecommendations.map((champ, i) => (
                                <li key={i}>
                                    <p className="font-semibold text-white">{champ.name}</p>
                                    <p className="text-gray-300 text-sm italic">{champ.reason}</p>
                                </li>
                            ))
                        ) : (
                            <li className="text-gray-400 text-sm">No hay recomendaciones de campeones.</li>
                        )}
                    </ul>
                </div>
                <div className="p-4 bg-black/30 rounded-lg border border-lol-gold/20">
                    <h4 className="font-semibold text-lol-light-blue text-lg mb-2">Consejos Estratégicos</h4>
                    <ul className="space-y-2 list-disc list-inside">
                        {recommendations.strategyTips?.length > 0 ? (
                            recommendations.strategyTips.map((tip, i) => (
                                <li key={i} className="text-gray-300 text-sm">{tip}</li>
                            ))
                        ) : (
                            <li className="text-gray-400 text-sm">No hay consejos estratégicos.</li>
                        )}
                    </ul>
                </div>
            </div>
        </div>
    );
};