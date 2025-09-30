// src/components/widgets/StatusHUD.jsx
'use client';

import React from 'react';
import { useScale } from '@/context/ScaleContext';
import { useInteractiveWidget } from '@/hooks/useInteractiveWidget';

export default function StatusHUD({ gamePhase }) {
  const { scale } = useScale();
  const { position, isLoaded, handleMouseDown } = useInteractiveWidget('widget-status', { x: 500, y: 10 });

  // Mensaje a mostrar basado en la fase del juego
  let statusText = "Esperando Conexión...";
  let statusColor = "text-gray-400";

  switch (gamePhase) {
    case 'Lobby':
    case 'Matchmaking':
    case 'ReadyCheck':
      statusText = `Estado: ${gamePhase}`;
      statusColor = "text-blue-300 animate-pulse";
      break;
    case 'ChampSelect':
      statusText = "FASE: Selección de Campeón";
      statusColor = "text-yellow-300";
      break;
    case 'InProgress':
      statusText = "FASE: Partida en Curso";
      statusColor = "text-green-300";
      break;
    default:
      statusText = "Estado: Desconectado del Cliente LoL";
      statusColor = "text-red-400";
      break;
  }

  if (!isLoaded) return null;

  return (
    <div
      className="absolute origin-top-left"
      style={{
        top: `${position.y}px`,
        left: `${position.x}px`,
        transform: `scale(${scale})`,
      }}
    >
      <div 
        onMouseDown={handleMouseDown}
        className="bg-black/80 border border-gray-500 rounded-md shadow-lg backdrop-blur-sm flex items-center gap-4 p-2 cursor-move"
      >
        <div className="px-1 text-gray-500">::</div>
        <p className={`font-bold text-sm ${statusColor}`}>{statusText}</p>
      </div>
    </div>
  );
}