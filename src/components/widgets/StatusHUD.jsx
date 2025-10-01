// src/components/widgets/StatusHUD.jsx - VERSIÓN FINAL (FIX de Compilación)
'use client';

import React from 'react';

export default function StatusHUD({ lcuData }) {
  const gamePhase = lcuData?.gameflow?.phase;
  let statusText = "Esperando Conexión...";
  // ** CRÍTICO FIX: gamePhase se define solo UNA vez
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

  return (
    <div 
      className="bg-black/80 border border-gray-500 rounded-md shadow-lg backdrop-blur-sm flex items-center gap-4 p-2"
      style={{ minWidth: '350px', display: 'flex', justifyContent: 'space-between' }}
    >
      <div className="px-1 text-gray-500">::</div>
      <p className={`font-bold text-sm ${statusColor}`}>{statusText}</p>
    </div>
  );
}
