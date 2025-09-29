// src/components/dashboard/AIAnalysis.jsx
"use client";

import React from 'react';

const LoadingSpinner = () => (
    <div className="flex justify-center items-center gap-2">
        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
        Cargando...
    </div>
);

export default function AIAnalysis({ onAnalysis, result }) {
    return (
        <div className="bg-lol-dark-blue p-6 rounded-lg border border-lol-gold/30 shadow-lg flex flex-col h-full">
            <h2 className="text-2xl font-bold text-lol-gold mb-5 border-b border-lol-gold/50 pb-2">Análisis con IA</h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <button 
                    onClick={() => onAnalysis('performance')} 
                    className="bg-lol-gold text-white font-bold py-3 px-4 rounded-lg hover:bg-lol-gold/80 transition-colors duration-200 text-base disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={result?.loading && result.type === 'performance'}
                >
                    {result?.loading && result.type === 'performance' ? <LoadingSpinner /> : 'Evaluar Rendimiento'}
                </button>

                <button 
                    onClick={() => onAnalysis('tips')} 
                    className="bg-lol-gold text-white font-bold py-3 px-4 rounded-lg hover:bg-lol-gold/80 transition-colors duration-200 text-base disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={result?.loading && result.type === 'tips'}
                >
                    {result?.loading && result.type === 'tips' ? <LoadingSpinner /> : 'Obtener Consejos'}
                </button>
                
                <button 
                    onClick={() => onAnalysis('challenges')} 
                    className="bg-lol-gold text-white font-bold py-3 px-4 rounded-lg hover:bg-lol-gold/80 transition-colors duration-200 text-base disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={result?.loading && result.type === 'challenges'}
                >
                    {result?.loading && result.type === 'challenges' ? <LoadingSpinner /> : 'Generar Desafíos'}
                </button>
            </div>

            <div className="flex-grow mt-4 p-5 bg-black/30 rounded-lg min-h-[200px] flex items-center justify-center">
                {result?.loading ? (
                    <p className="text-lg text-lol-light-blue animate-pulse">La IA está trabajando...</p>
                ) : result?.error ? (
                    <div className="text-center text-red-400">
                        <p className="font-bold mb-2">Error en el análisis</p>
                        <p className="text-sm">{result.error}</p>
                    </div>
                ) : result?.type === 'performance' && result.puntosFuertes ? (
                    <div className="text-lol-light space-y-3 w-full animate-fade-in">
                        <h3 className="font-bold text-lol-gold text-lg border-b border-lol-gold/30 pb-1">Reporte de Rendimiento</h3>
                        <div>
                            <h4 className="font-semibold text-green-400">Puntos Fuertes:</h4>
                            <ul className="list-disc list-inside ml-4 text-sm">
                                {result.puntosFuertes.map((point, i) => <li key={i}>{point}</li>)}
                            </ul>
                        </div>
                        <div>
                            <h4 className="font-semibold text-yellow-400">Puntos a Mejorar:</h4>
                            <ul className="list-disc list-inside ml-4 text-sm">
                                {result.puntosAMejorar.map((point, i) => <li key={i}>{point}</li>)}
                            </ul>
                        </div>
                    </div>
                ) : (
                    <p className="text-lol-light/70 text-center">Haz clic en un botón para obtener un análisis de la IA.</p>
                )}
            </div>
        </div>
    );
};