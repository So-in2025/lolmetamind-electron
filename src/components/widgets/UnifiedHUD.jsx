'use client';
import React, { useState, useEffect } from 'react';
import BuildsHUD from './BuildsHUD';
import RealtimeCoachHUD from './RealtimeCoachHUD';
import StrategicHUD from './StrategicHUD';

const UnifiedHUD = () => {
  const [hudData, setHudData] = useState({
    // Estado inicial que refleja las claves del servidor WS
    realtimeAdvice: "Esperando conexión con el Coach...",
    priorityAction: "STATUS",
    buildRecommendation: { items: [], runes: [] },
    strategicAdvice: "Esperando estrategia...",
  });
  const [error, setError] = useState(null);

  // CRÍTICO: Este hook sustituye COMPLETAMENTE la lógica de WebSocket duplicada.
  useEffect(() => {
    // 1. Verificación del entorno Electron y el puente
    if (typeof window !== 'undefined' && window.electron && window.electron.onLiveCoachUpdate) {
        
        // 2. Función Listener (Escuchamos el canal 'live-coach-update' del main.js)
        const listener = (data) => {
            console.log('IPC Coach Advice Received:', data);
            setError(null); 
            
            // Actualizamos el estado con la data completa del backend (advice, priority, etc.)
            setHudData(prevData => ({
                ...prevData,
                ...data 
            }));
        };

        // 3. Suscribirse al canal IPC
        window.electron.onLiveCoachUpdate(listener);
        
        // No se necesita cleanup aquí ya que la ventana de overlay se cerrará con la app.
        
    } else {
        setError("El Coach no está disponible. Ejecutar en la aplicación de escritorio.");
        console.warn('El puente de Electron/IPC no está disponible.');
    }
  }, []); 

  if (error) {
    return <div className="p-4 rounded-lg bg-red-900/50 text-red-300 text-center">{error}</div>;
  }
  
  // CRÍTICO: Pasamos los datos como props a los componentes hijos
  return (
    <div className="flex flex-col space-y-4">
      <RealtimeCoachHUD 
        message={hudData.realtimeAdvice} 
        priority={hudData.priorityAction}
        // Pasamos el tiempo de juego si lo necesitas para mostrarlo
        gameTime={hudData.gameData?.gameTime} 
      />
      <BuildsHUD build={hudData.buildRecommendation} />
      <StrategicHUD message={hudData.strategicAdvice} />
    </div>
  );
};

export default UnifiedHUD;