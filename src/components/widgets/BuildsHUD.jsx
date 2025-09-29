// src/components/widgets/BuildsHUD.jsx
'use client';

import { useScale } from '@/context/ScaleContext';
import { useInteractiveWidget } from '@/hooks/useInteractiveWidget';
import { FaLock, FaUnlock } from 'react-icons/fa';
import { useState } from 'react';

export default function BuildsHUD({ build }) {
  const [isDraggable, setIsDraggable] = useState(true);
  const { scale } = useScale();
  const { position, isLoaded, handleMouseDown } = useInteractiveWidget('widget-builds', { x: 0, y: 50 });
  
  const adviceMessage = build?.items?.length > 0
    ? `Próximo objeto: ${build.items[0].name}`
    : 'Analizando builds...';

  if (!isLoaded) return null;

  return (
    <div
      className="absolute w-96 origin-top-left bg-lol-blue-dark/80 border border-lol-gold rounded-md text-lol-gold-light shadow-lg backdrop-blur-sm"
      style={{ top: `${position.y}px`, left: `${position.x}px`, transform: `scale(${scale})`, cursor: isDraggable ? 'move' : 'default' }}
    >
      <div className="bg-lol-blue-dark p-2 flex justify-between items-center" onMouseDown={isDraggable ? handleMouseDown : undefined}>
        <h3 className="font-bold">Consejos de Build</h3>
        <button onClick={() => setIsDraggable(!isDraggable)} className="text-lol-gold hover:text-white cursor-pointer">
          {isDraggable ? <FaUnlock /> : <FaLock />}
        </button>
      </div>
      <div className="p-4"><p className="font-bold">{adviceMessage}</p></div>
    </div>
  );
}