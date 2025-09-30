#!/bin/bash
# final-hextech-fix.sh - Script de Corrección Final para StatusHUD.jsx
# CORRIGE: Importaciones de hooks obsoletos (useScale) en StatusHUD.jsx.

LOG_PREFIX="[FINAL-FIX]"
NODE_PORT=3001
APP_NAME="lolmetamind-electron"
STATUS_HUD_FILE="src/components/widgets/StatusHUD.jsx"

echo "=========================================================="
echo "$LOG_PREFIX 🚀 Aplicando Corrección Final de Importaciones en StatusHUD"
echo "=========================================================="

# --- 1. APLICAR CORRECCIÓN EN StatusHUD.jsx ---
echo "$LOG_PREFIX 📝 Corrigiendo $STATUS_HUD_FILE para el modo Hextech Modular."
echo "$LOG_PREFIX (Eliminando hooks de escala y posición obsoletos)."

# Inyecta la versión corregida de StatusHUD.jsx
cat << EOF_STATUS_HUD > "$STATUS_HUD_FILE"
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
      statusText = \`Estado: \${gamePhase}\`;
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
      <p className={\`font-bold text-sm \${statusColor}\`}>{statusText}</p>
    </div>
  );
}
EOF_STATUS_HUD

if [ $? -eq 0 ]; then
    echo "$LOG_PREFIX ✅ Corrección de StatusHUD.jsx aplicada con éxito."
else
    echo "$LOG_PREFIX ❌ ERROR: Fallo al aplicar la corrección. Abortando."
    exit 1
fi

# --- 2. PROCESO DE ARRANQUE ROBUSTO ---

echo "$LOG_PREFIX 🧹 [PASO 1/3] Limpiando procesos antiguos..."
if command -v lsof &> /dev/null && command -v awk &> /dev/null; then
    PIDS_TO_KILL=$(lsof -i tcp:$NODE_PORT | awk 'NR!=1 {print $2}')
    if [ ! -z "$PIDS_TO_KILL" ]; then
        echo "$LOG_PREFIX Procesos de Node a terminar: $PIDS_TO_KILL"
        kill -9 $PIDS_TO_KILL 2>/dev/null || true
    fi
fi
if command -v pkill &> /dev/null; then
    pkill -f "$APP_NAME" 2>/dev/null || true
fi

sleep 1 

echo "$LOG_PREFIX 🛠️ [PASO 2/3] Generando el Build de Next.js (Validando la corrección)..."
npm run build

if [ $? -ne 0 ]; then
    echo "$LOG_PREFIX ❌ ERROR: Fallo al generar el Build de Next.js. El error no se corrigió."
    exit 1
fi

echo "$LOG_PREFIX 🟢 [PASO 3/3] Iniciando el Sistema de Coaching en tiempo real..."
echo "----------------------------------------------------------"
echo "$LOG_PREFIX ⏳ ¡ÉXITO! La aplicación iniciará con todos los errores corregidos."
echo "----------------------------------------------------------"

# Ejecuta el script principal de desarrollo concurrente
exec npm run electron:dev

if [ $? -ne 0 ]; then
    echo "$LOG_PREFIX ❌ ERROR CRÍTICO: El comando 'npm run electron:dev' ha fallado al iniciar la aplicación."
    exit 1
fi

exit 0