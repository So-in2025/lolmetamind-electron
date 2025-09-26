'use client';
import { useState, useEffect } from 'react';
import { FaLock, FaUnlock } from 'react-icons/fa';
import { useScale } from '@/context/ScaleContext';
import { useInteractiveWidget } from '@/hooks/useInteractiveWidget';

// CRÍTICO: El componente ahora acepta la prop 'build' de UnifiedHUD.jsx
export default function BuildsHUD({ build }) {
  const [isDraggable, setIsDraggable] = useState(true);
  const { scale } = useScale();
  // El position y isLoaded deben ser parte del hook
  const { position, isLoaded, handleMouseDown } = useInteractiveWidget('widget-builds', { x: 0, y: 50 });
  
  // No necesitamos useEffect para escuchar IPC. Solo para renderizar la prop.
  
  // Lógica simple para mostrar el consejo basado en la prop 'build'
  let adviceMessage = 'Inicia una partida para recibir consejos.';
  if (build && build.items && build.items.length > 0) {
    adviceMessage = `Próximo objeto recomendado: ${build.items[0].name || 'Desconocido'} (${build.items.length} objetos en total)`;
  } else if (build && build.runes && build.runes.length > 0) {
     adviceMessage = 'Analizando runas y objetos...';
  }


  if (!isLoaded) return null;

  return (
    <div
      className="absolute w-96 origin-top-left bg-lol-blue-dark/10 border-2 border-lol-gold rounded-md text-lol-gold-light shadow-lg backdrop-blur-sm"
      style={{
        top: `${position.y}px`,
        left: `${position.x}px`,
        transform: `scale(${scale})`,
        cursor: isDraggable ? 'move' : 'default',
      }}
    >
      <div
        className="bg-lol-blue-dark p-2 flex justify-between items-center"
        onMouseDown={isDraggable ? handleMouseDown : undefined}
      >
        <h3 className="font-bold text-shadow-md">Consejos de Build</h3>
        <button onClick={() => setIsDraggable(!isDraggable)} className="text-lol-gold hover:text-white cursor-pointer">
          {isDraggable ? <FaUnlock /> : <FaLock />}
        </button>
      </div>
      <div className="p-4 relative min-h-[3rem]">
        <p className="font-bold text-lg">{adviceMessage}</p>
      </div>
    </div>
  );
}