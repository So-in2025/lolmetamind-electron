// src/components/dashboard/AIAnalysis.jsx
// Este componente presenta los botones para iniciar diferentes tipos de análisis con IA
// y muestra los resultados de dichos análisis directamente en el dashboard.

import React from 'react';

/**
 * @param {object} props - Las propiedades del componente.
 * @param {function} props.onAnalysis - Callback que se ejecuta cuando el usuario hace clic en un botón de análisis. Recibe el tipo de análisis como argumento.
 * @param {object} props.result - Objeto que contiene el estado y el resultado del análisis actual de la IA (ej. { loading: true, type: 'performance', puntosFuertes: [], puntosAMejorar: [] }).
 */
const AIAnalysis = ({ onAnalysis, result }) => {
    return (
        <div className="bg-lol-dark-blue p-6 rounded-lg border border-lol-gold/30 shadow-lg flex flex-col h-full">
            <h2 className="text-3xl font-bold text-lol-gold mb-5 border-b border-lol-gold/50 pb-2">Análisis con IA</h2>
            
            <div className="flex flex-wrap justify-around gap-4 mb-6">
                {/* Botón para evaluar el rendimiento de las últimas partidas */}
                <button 
                    onClick={() => onAnalysis('performance')} 
                    className="flex-1 min-w-[150px] bg-lol-gold text-white font-bold py-3 px-6 rounded-lg hover:bg-lol-gold/80 transition-colors duration-200 text-lg"
                    disabled={result?.loading && result.type === 'performance'} // Deshabilita si ya está cargando este tipo de análisis
                >
                    {result?.loading && result.type === 'performance' ? 'Evaluando...' : 'Evaluar Rendimiento'}
                </button>

                {/* Botón para obtener consejos personalizados */}
                <button 
                    onClick={() => onAnalysis('tips')} 
                    className="flex-1 min-w-[150px] bg-lol-gold text-white font-bold py-3 px-6 rounded-lg hover:bg-lol-gold/80 transition-colors duration-200 text-lg"
                    disabled={result?.loading && result.type === 'tips'}
                >
                    {result?.loading && result.type === 'tips' ? 'Obteniendo...' : 'Obtener Consejos'}
                </button>
                
                {/* Botón para generar desafíos semanales */}
                <button 
                    onClick={() => onAnalysis('challenges')} 
                    className="flex-1 min-w-[150px] bg-lol-gold text-white font-bold py-3 px-6 rounded-lg hover:bg-lol-gold/80 transition-colors duration-200 text-lg"
                    disabled={result?.loading && result.type === 'challenges'}
                >
                    {result?.loading && result.type === 'challenges' ? 'Generando...' : 'Generar Desafíos'}
                </button>
            </div>

            {/* --- Área de Visualización de Resultados del Análisis --- */}
            <div className="flex-grow mt-4 p-5 bg-black/30 rounded-lg min-h-[150px] flex items-center justify-center">
                {/* Mensaje de carga */}
                {result?.loading ? (
                    <p className="text-xl text-lol-light-blue animate-pulse">
                        La IA está trabajando... <span className="block text-sm text-gray-400 mt-2">Esto puede tomar unos segundos.</span>
                    </p>
                ) : // Mensaje de error
                result?.error ? (
                    <div className="text-center text-red-400 text-lg">
                        <p className="font-bold mb-2">Error en el análisis:</p>
                        <p className="text-base">{result.error}</p>
                        <p className="text-sm text-gray-500 mt-2">Verifica tu conexión y tu clave API de Riot.</p>
                    </div>
                ) : // Visualización de resultados (ej. para 'performance')
                result?.type === 'performance' && result.puntosFuertes && result.puntosAMejorar ? (
                    <div className="text-lol-light space-y-4 w-full">
                        <h3 className="font-bold text-lol-gold text-xl border-b border-lol-gold/30 pb-1">Reporte de Rendimiento:</h3>
                        
                        <div>
                            <h4 className="font-semibold text-lol-light-blue text-lg mb-2">Puntos Fuertes: 💪</h4>
                            <ul className="list-disc list-inside ml-4 space-y-1">
                                {result.puntosFuertes.length > 0 ? (
                                    result.puntosFuertes.map((point, i) => <li key={i} className="text-base">{point}</li>)
                                ) : (
                                    <li className="text-gray-400">No se encontraron puntos fuertes destacados en el análisis.</li>
                                )}
                            </ul>
                        </div>
                        
                        <div>
                            <h4 className="font-semibold text-lol-light-blue text-lg mb-2 mt-4">Puntos a Mejorar: 📈</h4>
                            <ul className="list-disc list-inside ml-4 space-y-1">
                                {result.puntosAMejorar.length > 0 ? (
                                    result.puntosAMejorar.map((point, i) => <li key={i} className="text-base">{point}</li>)
                                ) : (
                                    <li className="text-gray-400">¡Sigue así! No se detectaron áreas críticas de mejora en este análisis.</li>
                                )}
                            </ul>
                        </div>
                    </div>
                ) : (
                    // Mensaje inicial o cuando no hay un resultado específico para mostrar aquí
                    <p className="text-lol-light/70 text-lg">
                        Haz clic en un botón para obtener un análisis de la IA.
                    </p>
                )}
            </div>
        </div>
    );
};

export default AIAnalysis;