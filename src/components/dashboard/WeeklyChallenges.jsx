// src/components/dashboard/WeeklyChallenges.jsx
// Este componente muestra una lista de desafíos semanales generados por la IA.
// Estos desafíos están diseñados para ayudar al invocador a mejorar en aspectos
// específicos de su juego.

import React from 'react';

/**
 * @param {object} props - Las propiedades del componente.
 * @param {Array<object>} props.challenges - Un array de objetos de desafío, cada uno con un `title` y una `description`.
 * Ejemplo: [{title: "Mejora tu visión temprana", description: "Compra al menos 2 wards de control antes del minuto 10."}, ...]
 */
const WeeklyChallenges = ({ challenges }) => {
    // Si no hay desafíos o si hay un error en la carga, muestra un mensaje.
    if (!challenges || challenges.error) {
        return (
            <div className="text-gray-400 text-center py-8 text-lg">
                <p className="font-bold mb-2">No se pudieron cargar los desafíos semanales.</p>
                {challenges?.error && <p className="text-sm text-red-400">{challenges.error}</p>}
                <p className="text-sm mt-2">Intenta actualizar la sección o verifica tu conexión.</p>
            </div>
        );
    }

    return (
        <div className="text-lol-light h-full">
            <p className="mb-6 text-lol-light/80 text-lg">
                Aquí tienes una serie de desafíos personalizados por la IA para que te enfoques esta semana en tus partidas. ¡Concéntrate en ellos para mejorar tu juego\!
            </p>
            
            <div className="space-y-5">
                {challenges.map((challenge, i) => (
                    <div key={i} className="p-5 bg-black/30 rounded-lg border border-lol-gold/20 shadow-md transition-all duration-200 hover:scale-[1.01]">
                        <h4 className="font-semibold text-lol-light-blue text-xl mb-2 flex items-center gap-2">
                            <span className="text-lol-gold font-bold text-2xl mr-1">#{i + 1}</span>
                            {challenge.title}
                        </h4>
                        <p className="text-gray-300 text-base leading-relaxed">{challenge.description}</p>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default WeeklyChallenges;