// src/components/dashboard/WeeklyChallenges.jsx
"use client";

import React from 'react';

export default function WeeklyChallenges({ challenges }) {
    if (!challenges || challenges.error) {
        return (
            <div className="flex items-center justify-center h-full">
                <p className="text-gray-400 text-center">No se pudieron cargar los desafíos semanales.</p>
            </div>
        );
    }

    return (
        <div className="text-lol-light h-full overflow-y-auto custom-scrollbar pr-2">
            <p className="mb-4 text-lol-light/80">
                Concéntrate en estos desafíos personalizados por la IA para mejorar esta semana.
            </p>
            <div className="space-y-4">
                {challenges.map((challenge, i) => (
                    <div key={i} className="p-4 bg-black/30 rounded-lg border border-lol-gold/20 transition-transform hover:scale-[1.02]">
                        <h4 className="font-semibold text-lol-light-blue text-lg mb-1">
                            <span className="text-lol-gold font-bold mr-2">#{i + 1}</span>
                            {challenge.title}
                        </h4>
                        <p className="text-gray-300 text-sm">{challenge.description}</p>
                    </div>
                ))}
            </div>
        </div>
    );
};