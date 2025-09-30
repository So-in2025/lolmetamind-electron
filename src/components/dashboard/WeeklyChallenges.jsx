// lolmetamind-electron/src/components/dashboard/WeeklyChallenges.jsx
"use client";

import React, { useEffect, useState } from 'react';

export default function WeeklyChallenges() {
    const { mode, summonerName, strategicStats, aiAnalysis, zodiacSign } = useRiotProfileData();
    const [challenges, setChallenges] = useState(aiAnalysis?.challenges || []);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        // Si el modo es 'Loading' o 'NO_DATA', o si ya tenemos desafíos de la IA, no intentamos cargar
        if (mode !== 'Strategic' || aiAnalysis.challenges) {
            // Aseguramos que isLoading se refleje si estamos en modo Loading
            if (mode === 'Loading' && !isLoading) setIsLoading(true);
            if (mode === 'NO_DATA' && isLoading) setIsLoading(false); // Detener carga en error de data
            return;
        }

        // Si summonerName, strategicStats o zodiacSign están vacíos, no podemos generar desafíos.
        if (!summonerName || !zodiacSign || !strategicStats || Object.keys(strategicStats).length === 0) {
            console.warn("[WeeklyChallenges] Faltan datos para generar desafíos (summonerName, zodiacSign o strategicStats). No se llama a la IA.");
            setError('Faltan datos clave (invocador, signo zodiacal o estadísticas) para generar desafíos.');
            setIsLoading(false);
            return;
        }

        const loadChallenges = async () => {
            setIsLoading(true);
            setError(null);
            
            const playerData = {
                summonerName: summonerName, 
                recentMatchesPerformance: strategicStats, 
                zodiacSign: zodiacSign // Aseguramos que zodiacSign se pasa aquí
            };
            
            try {
                const response = await getWeeklyChallenges(playerData);
                setChallenges(response);
            } catch (err) {
                console.error("[WeeklyChallenges] Error al obtener desafíos:", err);
                setError('Fallo al cargar los desafíos semanales.');
            } finally {
                setIsLoading(false);
            }
        };

        loadChallenges();
        
    }, [mode, aiAnalysis.challenges, summonerName, strategicStats, zodiacSign, isLoading]); 

    if (isLoading || mode === 'Loading') {
        return <div className="p-4 text-center text-lol-gold">Cargando desafíos semanales de la IA...</div>;
    }

    if (error || mode === 'NO_DATA') {
        return <div className="p-4 text-center text-red-500">{error || 'No se pudieron cargar los desafíos debido a un error en el perfil o la conexión.'}</div>;
    }
    
    return (
        <div className="p-4 bg-lol-blue-medium rounded-lg">
             <h3 className="text-xl font-display text-lol-gold mb-3">Desafíos Semanales</h3>
             {challenges.length > 0 ? (
                 challenges.map((challenge, index) => (
                    <div key={index} className="mb-2 p-3 bg-lol-dark-blue/80 rounded-md border-l-4 border-lol-blue-accent">
                        <p className="font-semibold text-lol-light">{challenge.title}</p>
                        <p className="text-sm text-lol-grey">{challenge.description}</p>
                        <span className="text-xs font-mono text-lol-gold">Meta: {challenge.goal} {challenge.metric}</span>
                    </div>
                 ))
             ) : (
                 <p className="text-lol-grey">No hay desafíos disponibles por el momento.</p>
             )}
        </div>
    );
}