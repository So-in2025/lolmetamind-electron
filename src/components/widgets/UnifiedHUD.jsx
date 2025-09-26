'use client';
import React, { useState, useEffect, useRef } from 'react';
import BuildsHUD from './BuildsHUD';
import RealtimeCoachHUD from './RealtimeCoachHUD';
import StrategicHUD from './StrategicHUD';

const UnifiedHUD = () => {
  const [hudData, setHudData] = useState({
    realtimeAdvice: "Esperando consejos del coach...",
    buildRecommendation: { items: [], runes: [] },
    strategicAdvice: "Esperando estrategia...",
  });
  const [error, setError] = useState(null);
  const ws = useRef(null);

  useEffect(() => {
    // --- FIX: IGNORAR TOKEN PARA PRUEBAS (Hardcodeado) ---
    // Usamos un mock token, y el WS Server ya no lo verifica.
    const token = 'mock-token-bypass'; 
    // --- FIN FIX ---
    
    const wsUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'wss://lolmetamind-websocket.onrender.com';

    // No hay verificación if (!token) para evitar el error.
    
    function connect() {
      if (ws.current && ws.current.readyState === WebSocket.OPEN) return;
      
      const socket = new WebSocket(`${wsUrl}?token=${token}`); 

      socket.onopen = () => {
          console.log('🔗 Conectado al servidor WebSocket.');
          setError(null);
      };
      
      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // FIX CRÍTICO: Se fusiona el nuevo mensaje (data) con el estado actual (prevData).
          setHudData(prevData => ({ 
              ...prevData, 
              ...data, 
          })); 
          
        } catch (e) {
          console.error("Error al parsear el mensaje JSON:", e);
          setError("Error en el formato de datos del servidor.");
        }
      };
      socket.onclose = () => {
        console.log('💔 Desconectado. Reintentando en 5 segundos...');
        setTimeout(connect, 5000);
      };
      socket.onerror = (err) => {
        console.error('❌ Error en WebSocket:', err);
        setError("Error en la conexión con el servidor.");
        socket.close();
      };
      ws.current = socket;
    }

    connect();
    return () => {
      if (ws.current) ws.current.close();
    };
  }, []);

  if (error) {
    return <div className="p-4 rounded-lg bg-red-900/50 text-red-300 text-center">{error}</div>;
  }

  return (
    <div className="flex flex-col space-y-4">
      <RealtimeCoachHUD message={hudData.realtimeAdvice} />
      <BuildsHUD build={hudData.buildRecommendation} />
      <StrategicHUD message={hudData.strategicAdvice} />
    </div>
  );
};

export default UnifiedHUD;