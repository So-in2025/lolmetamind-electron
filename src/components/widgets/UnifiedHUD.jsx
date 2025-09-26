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

  // CRÍTICO: Este hook sustituye COMPLETAMENTE la lógica de WebSocket.
  useEffect(() => {
    // 1. Verificación del entorno Electron y el puente
    if (typeof window !== 'undefined' && window.electron && window.electron.onLiveCoachUpdate) {
        
        // 2. Función Listener
        const listener = (data) => {
            console.log('IPC Coach Advice Received:', data);
            setError(null); // Limpiamos errores de conexión WS si los había
            setHudData(prevData => ({
                // Mantenemos la data de builds y strategy si no viene en la actualización de realtime
                ...prevData,
                ...data 
            }));
        };

        // 3. Suscribirse al canal IPC
        window.electron.onLiveCoachUpdate(listener);

        // No es necesario limpiar el listener de ipcRenderer en el contexto de Electron, 
        // ya que la ventana se cierra con la app.
        
    } else {
        // Esto indica que el overlay se está ejecutando fuera de Electron (ej. un navegador)
        setError("El Coach no está disponible. Ejecutar en la aplicación de escritorio.");
        console.warn('El puente de Electron/IPC no está disponible.');
    }
  }, []); // El array vacío asegura que solo se ejecute al montar

  if (error) {
    return <div className="p-4 rounded-lg bg-red-900/50 text-red-300 text-center">{error}</div>;
  }
  
  // Usamos las claves de hudData que ahora se actualizan por IPC
  return (
    <div className="flex flex-col space-y-4">
      <RealtimeCoachHUD 
        message={hudData.realtimeAdvice} 
        priority={hudData.priorityAction} // Si RealtimeCoachHUD lo usa
      />
      <BuildsHUD build={hudData.buildRecommendation} />
      <StrategicHUD message={hudData.strategicAdvice} />
    </div>
  );
};

export default UnifiedHUD;