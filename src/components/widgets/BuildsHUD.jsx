// src/components/widgets/BuildsHUD.jsx - VERSIÓN FINAL Y COMPILABLE SIN SIMULACIÓN
'use client';

import { useScale } from '@/context/ScaleContext'; // <-- RUTA CORREGIDA y ESTABLE
import { useInteractiveWidget } from '@/hooks/useInteractiveWidget';
import { FaLock, FaUnlock } from 'react-icons/fa';
import { useState, useMemo } from 'react';

// BuildsHUD asume que recibe la recomendación de Build directamente en lcuData.
export default function BuildsHUD({ lcuData }) { 
  const [isDraggable, setIsDraggable] = useState(true);
  const { scale } = useScale();
  const { position, isLoaded, handleMouseDown } = useInteractiveWidget('widget-builds', { x: 0, y: 50 });
  
  // ** LÓGICA CLAVE DE FASE (FIX DE BLOQUEO) **
  const phase = lcuData?.gameflow?.phase;
  const isActivePhase = phase === 'ChampSelect' || phase === 'InProgress';
  
  // 🔑 Eliminación de Simulación: Ahora depende de un campo real (lcuData.builds)
  const currentBuild = lcuData?.builds || []; // Asume que el lcuData tiene un campo 'builds'
  
  const adviceMessage = currentBuild?.items?.length > 0
    ? `Próximo objeto: ${currentBuild.items[0].name}`
    : 'Esperando análisis de builds tácticas...';

  if (!isLoaded || !isActivePhase) return null;

  return (
    <div
      className="absolute w-96 origin-top-left bg-lol-blue-dark/80 border border-lol-gold rounded-md text-lol-gold-light shadow-lg backdrop-blur-sm"
      style={{ top: `${position.y}px`, left: `${position.x}px`, transform: `scale(${scale})`, cursor: isDraggable ? 'move' : 'default' }}
    >
      <div className="bg-lol-blue-dark p-2 flex justify-between items-center" onMouseDown={isDraggable ? handleMouseDown : undefined}>
        <h3 className="font-bold">Consejos de Build (Fase: {phase})</h3>
        <button onClick={() => setIsDraggable(!isDraggable)} className="text-lol-gold hover:text-white cursor-pointer">
          {isDraggable ? <FaUnlock /> : <FaLock />}
        </button>
      </div>
      <div className="p-4"><p className="font-bold">{adviceMessage}</p></div>
    </div>
  );
}
