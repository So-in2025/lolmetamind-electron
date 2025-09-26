'use client';
import { useState, useEffect, useRef } from 'react'; // FIX: Añadimos useRef
import BuildsHUD from './BuildsHUD';
import StrategicHUD from './StrategicHUD';
import RealtimeCoachHUD from './RealtimeCoachHUD';
import ControlsHUD from './ControlsHUD';

export default function UnifiedHUD() {
  const [isEditMode, setIsEditMode] = useState(true);
  
  // FIX: Se añade el estado para los datos del HUD (incluyendo Builds y Estrategia inicial)
  const [hudData, setHudData] = useState({
    realtimeAdvice: "Conectando al coach...",
    buildRecommendation: { items: [], runes: [] }, // Estado inicial
    strategicAdvice: "Esperando la estrategia inicial...", // Estado inicial
    priorityAction: 'STATUS'
  });
  const [error, setError] = useState(null);
  const ws = useRef(null);

  // Lógica de conexión WebSocket para recibir consejos
  useEffect(() => {
    // FIX CRÍTICO: La conexión es directa y no usa token
    const token = 'mock-token-bypass'; // Valor mockeado para cumplir el formato del URL
    // Usamos el dominio de Render unificado
    const wsUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'wss://lolmetamind-dmxt.onrender.com';
    
    function connect() {
      if (ws.current && ws.current.readyState === WebSocket.OPEN) return;
      
      // La conexión se establece al servidor unificado
      const socket = new WebSocket(`${wsUrl}?token=${token}`); 

      socket.onopen = () => {
          console.log('🔗 Conectado al servidor WebSocket.');
          setError(null);
      };
      
      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // FIX CLAVE: Fusionamos el nuevo mensaje con el estado para preservar Builds y Estrategia
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
    
    // Cleanup
    return () => {
      if (ws.current) ws.current.close();
    };
  }, []);
  
  // Lógica original de isEditMode (para los atajos)
  useEffect(() => {
    const handleSetEditMode = (value) => {
      setIsEditMode(value);
    };

    if (window.electronAPI) {
      window.electronAPI.on('set-edit-mode', handleSetEditMode);
    }

    return () => {
      if (window.electronAPI && typeof window.electronAPI.removeAllListeners === 'function') {
        window.electronAPI.removeAllListeners('set-edit-mode');
      }
    };
  }, []);


  if (error) {
    return <div className="fixed top-0 left-0 p-2 rounded-lg bg-red-900/80 text-red-300 text-center z-50">Error: {error}</div>;
  }
  
  return (
    // Se pasan los datos del estado a los componentes
    <>
      {isEditMode && <ControlsHUD />}
      
      <BuildsHUD build={hudData.buildRecommendation} />
      <StrategicHUD message={hudData.strategicAdvice} />
      <RealtimeCoachHUD 
        message={hudData.realtimeAdvice} 
        priorityAction={hudData.priorityAction} 
      />
    </>
  );
}