// src/components/widgets/StatusHUD.jsx - VERSIÓN CORREGIDA (Hextech Modular Compliant)
'use client';

import React from 'react';
// NOTA: Se eliminan las importaciones de useScale y useInteractiveWidget,
// ya que el DragAndScaleWidget ahora maneja la posición y la escala.

export default function StatusHUD({ gamePhase }) {
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

  // Retorna solo el contenido, el wrapper DragAndScaleWidget se encarga de
  // posición, escala y arrastre.
  return (
    <div 
      className="bg-black/80 border border-gray-500 rounded-md shadow-lg backdrop-blur-sm flex items-center gap-4 p-2"
    >
      <div className="px-1 text-gray-500">::</div>
      <p className={`font-bold text-sm ${statusColor}`}>{statusText}</p>
    </div>
  );
}
