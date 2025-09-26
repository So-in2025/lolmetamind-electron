'use client';
import React, { useState, useEffect, useRef } from 'react';
import { FaLock, FaUnlock } from 'react-icons/fa';
// Asumo que estos imports son correctos en tu proyecto
import { useScale } from '@/context/ScaleContext';
import { useInteractiveWidget } from '@/hooks/useInteractiveWidget';

// Función de narración (implementación correcta)
const speak = (text) => {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window && text) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'es-ES';
    utterance.rate = 1.1;
    window.speechSynthesis.speak(utterance);
  }
};

// CRÍTICO: El componente ahora acepta PROPS de UnifiedHUD
export default function RealtimeCoachHUD({ message, priority }) {
  const [isDraggable, setIsDraggable] = useState(true);
  const { scale } = useScale();
  const { position, isLoaded, handleMouseDown } = useInteractiveWidget('widget-coach', { x: 0, y: 500 });
  
  // Usamos useRef para rastrear el último mensaje importante narrado
  const lastNarratedMessage = useRef('');

  // 🟢 LÓGICA DE NARRACIÓN Y DINAMISMO (se ejecuta al recibir nuevas props)
  useEffect(() => {
    // Solo narramos si la prioridad es ANALYSIS (consejo importante) y el mensaje es nuevo.
    if (message && priority === 'ANALYSIS' && message !== lastNarratedMessage.current) {
      speak(message);
      lastNarratedMessage.current = message;
    }
    // Si la prioridad es STATUS, cancelamos narraciones pendientes (por si la partida termina)
    if (priority === 'STATUS' && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }, [message, priority]);
  
  // --- LÓGICA DE ESTILOS DINÁMICOS ---
  let containerClasses = "p-3 rounded-lg transition-all duration-300 shadow-lg absolute w-96 origin-top-left";
  let titleClasses = "font-bold text-shadow-md";
  let adviceClasses = "font-bold text-lg";

  switch (priority) {
    case 'ANALYSIS':
      // Partida ACTIVA y Análisis
      containerClasses += " bg-blue-800/80 border-2 border-yellow-500 text-white backdrop-blur-sm";
      adviceClasses += " text-yellow-300";
      titleClasses += " text-yellow-500";
      break;
    case 'STATUS':
      // Cliente LoL cerrado o esperando partida (Comportamiento actual)
      containerClasses += " bg-gray-700/50 border border-gray-500/50 text-gray-300 backdrop-blur-md animate-pulse";
      adviceClasses += " text-gray-300 text-sm";
      titleClasses += " text-white/50";
      break;
    case 'ERROR':
      // Error crítico
      containerClasses += " bg-red-900/80 border-2 border-red-600 text-red-300 backdrop-blur-sm";
      adviceClasses += " text-red-300";
      titleClasses += " text-red-600";
      break;
    default:
      // Estado por defecto
      containerClasses += " bg-gray-600/50 border border-gray-500/50 text-white";
      adviceClasses += " text-white";
      break;
  }

  if (!isLoaded) return null;

  return (
    <div
      className={containerClasses} 
      style={{
        top: `${position.y}px`,
        left: `${position.x}px`,
        transform: `scale(${scale})`,
        cursor: isDraggable ? 'move' : 'default', // cursor de arrastre
      }}
    >
      <div
        className={`bg-lol-blue-dark/50 p-2 flex justify-between items-center ${isDraggable ? '' : 'cursor-default'}`}
        onMouseDown={isDraggable ? handleMouseDown : undefined} // CRÍTICO: Solo arrastrable si isDraggable es true
      >
        <h3 className={titleClasses}>Coach en Tiempo Real</h3>
        <button onClick={() => setIsDraggable(!isDraggable)} className="text-lol-gold hover:text-white cursor-pointer">
          {isDraggable ? <FaUnlock /> : <FaLock />}
        </button>
      </div>
      <div className="p-4 relative min-h-[5rem]">
        <p className={adviceClasses}>▶ {message || 'Error: Mensaje nulo'}</p>
      </div>
    </div>
  );
}