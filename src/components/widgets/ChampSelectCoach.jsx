// src/components/widgets/ChampSelectCoach.jsx
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAppState } from '../../context/AppStateContext';

const LoadingSpinner = () => (
    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-lol-accent-gold"></div>
);

export default function ChampSelectCoach({ champSelectData, isInteractive }) {
    const { userData } = useAppState();
    const [recommendations, setRecommendations] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const draftData = useMemo(() => {
        if (!champSelectData) return null;
        const getChampionIds = (team) => team.map(p => p.championId).filter(id => id !== 0);
        return {
            myTeamPicks: getChampionIds(champSelectData.myTeam),
            theirTeamPicks: getChampionIds(champSelectData.theirTeam),
            bans: champSelectData.bans?.myTeamBans.concat(champSelectData.bans.theirTeamBans).map(b => b.championId).filter(id => id !== 0),
        };
    }, [champSelectData]);

    const getAIRecommendations = useCallback(async () => {
        if (!draftData || !window.electronAPI) return;
        setIsLoading(true);
        setError('');
        try {
            console.log('[IA Coach] Enviando datos del draft para análisis:', draftData);
            // SIMULACIÓN: Aquí se llamaría a la IA.
            // const result = await window.electronAPI.invoke('get-recommendations', { draft: draftData, summoner: userData });
            await new Promise(resolve => setTimeout(resolve, 1500)); // Simular retraso de red
            const result = {
                strategy: "La composición enemiga es débil contra el pokeo a distancia. Prioriza campeones de largo alcance.",
                earlyGame: "El jungla enemigo probablemente empezará en su bufo rojo. Avisa a tu bot lane que juegue con cuidado.",
                firstItems: "Comienza con Espada de Doran para presionar la línea o Escudo de Doran si esperas mucho hostigamiento.",
                runes: {
                    name: "MetaMind: Poke [Mage]",
                    primaryStyleId: 8200, subStyleId: 8100,
                    selectedPerkIds: [8214, 8226, 8210, 8237, 8126, 8135, 5008, 5002, 5003],
                    current: true
                }
            };
            if (result.error) throw new Error(result.error);
            setRecommendations(result);
        } catch (err) {
            setError('La IA no pudo generar recomendaciones.');
        } finally {
            setIsLoading(false);
        }
    }, [draftData, userData]);

    useEffect(() => {
        getAIRecommendations();
    }, [getAIRecommendations]);

    const handleCreateRunes = async () => {
        if (!isInteractive || !recommendations?.runes || !window.electronAPI) return;
        try {
            const result = await window.electronAPI.invoke('create-rune-page', recommendations.runes);
            if (result.success) {
                console.log('✅ ¡Página de runas creada con éxito!');
                // Aquí podrías mostrar una notificación visual de éxito
            } else {
                throw new Error(result.error);
            }
        } catch (err) {
            console.error('🚨 Fallo al crear la página de runas:', err);
        }
    };

    if (!champSelectData) return null;

    return (
        <div className="fixed top-4 left-4 w-[450px] bg-black/80 backdrop-blur-md border-2 border-lol-gold/50 rounded-lg shadow-2xl text-white p-4 animate-fade-in user-select-none">
            <div className="flex justify-between items-center pb-2 mb-2 border-b border-lol-gold/30">
                <h2 className="text-lg font-bold text-lol-highlight uppercase tracking-wider">Análisis de MetaMind</h2>
                {isLoading && <LoadingSpinner />}
            </div>

            {error && <p className="text-sm text-red-400 my-2">{error}</p>}

            {recommendations && !isLoading && (
                <div className="space-y-3">
                    <div>
                        <h3 className="font-bold text-sm uppercase text-lol-accent-gold">Estrategia General</h3>
                        <p className="text-xs text-lol-light">{recommendations.strategy}</p>
                    </div>
                    <div>
                        <h3 className="font-bold text-sm uppercase text-lol-accent-gold">Consejos de Early Game</h3>
                        <p className="text-xs text-lol-light">{recommendations.earlyGame}</p>
                    </div>
                    <div>
                        <h3 className="font-bold text-sm uppercase text-lol-accent-gold">Primeros Items</h3>
                        <p className="text-xs text-lol-light">{recommendations.firstItems}</p>
                    </div>
                    {recommendations.runes && (
                        <button 
                            onClick={handleCreateRunes}
                            disabled={!isInteractive}
                            className="w-full py-2 mt-2 text-center font-bold uppercase tracking-wider lol-button-gold disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Crear Runas: {recommendations.runes.name}
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}