"use client"
import React from 'react';

const challenges = [
    { id: 1, title: 'Control de Visión Avanzado', description: 'Coloca al menos 4 Guardianes de Control por partida.', progress: 50, color: 'bg-yellow-500' },
    { id: 2, title: 'Ataque de 15 Minutos', description: 'Finaliza el 70% de tus partidas con una ventaja de 5k de oro al minuto 15.', progress: 85, color: 'bg-red-500' },
    { id: 3, title: 'Gestión de Oleadas', description: 'Consigue 8 minions por minuto durante al menos 15 minutos en el 30% de tus partidas.', progress: 100, color: 'bg-green-500' },
    { id: 4, title: 'Iniciación Segura', description: 'Logra un ratio KDA de 3.0 o superior como iniciador.', progress: 20, color: 'bg-blue-500' },
];

export default function WeeklyChallenges() {
    return (
        <div className="space-y-4">
            <p className="text-sm text-gray-400">Estos desafíos se actualizan con la lógica estratégica de tu IA.</p>
            {challenges.map(challenge => (
                <div key={challenge.id} className="p-3 bg-black bg-opacity-40 rounded-lg border border-[#1E2A38]">
                    <div className="flex justify-between items-center mb-1">
                        <h3 className="text-base font-semibold text-white">{challenge.title}</h3>
                        <span className="text-sm font-bold text-gray-300">{challenge.progress}%</span>
                    </div>
                    <p className="text-xs text-gray-400 mb-2">{challenge.description}</p>
                    <div className="w-full bg-gray-600 rounded-full h-1.5">
                        <div className={`h-1.5 rounded-full ${challenge.color}`} style={{ width: `${challenge.progress}%` }}></div>
                    </div>
                </div>
            ))}
        </div>
    );
}