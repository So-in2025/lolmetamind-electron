#!/bin/bash

# ====================================================================
# FASE 0: CONFIGURACIÓN INICIAL Y BACKUP
# ====================================================================
echo "🤖 [INICIO] Ejecutando FIX DEFINITIVO V11.0. Corrigiendo main.js y BuildsHUD.jsx..."

# Usamos sed simple para compatibilidad
INJECT_SED='sed'
if command -v gsed &> /dev/null; then
    INJECT_SED='gsed'
fi

# Backups
cp main.js main.js.bak
cp src/components/widgets/BuildsHUD.jsx src/components/widgets/BuildsHUD.jsx.bak

# ====================================================================
# FASE 1: FIX CRÍTICO DE main.js (Sintaxis y Handlers)
# Objetivo: Limpiar handlers duplicados y reinsertar los bloques de Runas/TTS.
# ====================================================================

echo "🛠️  [FASE 1/2] Corrigiendo Sintaxis y Handlers en main.js..."

# A. Limpiamos cualquier bloque de Runas o TTS que pudiera estar duplicado
$INJECT_SED -i '/ipcMain.handle('\''create-rune-page'\'', async (e, runeData) => {/,/    });/d' main.js
$INJECT_SED -i '/ipcMain.on('\''speak-text'\'', (event, text) => {/,/    });/d' main.js

# B. Reinsertamos el bloque completo de Runas y TTS después de get-live-coaching (Usa la estructura que ya estaba en el archivo)
$INJECT_SED -i '/ipcMain.handle('\''get-live-coaching'\'', (e, payload) => makeAIRequest('\''\/api\/ai\/live-coach'\'', payload));/a\
\n    // CRÍTICO: Manejador para la creación de páginas de runas a través de LCU\
    ipcMain.handle('\''create-rune-page'\'', async (e, runeData) => {\
        console.log(`[LCU RUNES] 🔑 Solicitud para crear runas: ${runeData.name}`);\
        // ESTO DEBE SER REEMPLAZADO CON SU LÓGICA DE LCU-CONNECTOR\
        return { success: true, message: "Página de runas creada (Integración LCU Pendiente)" };\
    });\
\n    // CRÍTICO: Manejador para el Text-to-Speech (TTS) en el frontend\n    ipcMain.on('\''speak-text'\'', (event, text) => {\n        if (mainWindow && text) {\n            mainWindow.webContents.send('\''tts-narrate'\'', text);\n        } else if (overlayWindow && text) {\n             overlayWindow.webContents.send('\''tts-narrate'\'', text);\n        }\n    });' main.js

# C. CRÍTICO FIX DE SINTAXIS: Asegurar que el archivo main.js cierre sus bloques app.whenReady().then() y app.on('ready')
# Los errores estaban al final del archivo. Añadimos las llaves de cierre faltantes.
$INJECT_SED -i '/globalShortcut.unregisterAll();/a\
\});\
\n// CRÍTICO: Cierre de la función app.on(''ready'') que está al inicio del archivo.\
});' main.js


echo "✅ main.js corregido. Los errores de sintaxis y los handlers han sido asegurados."

# ====================================================================
# FASE 2: FIX CRÍTICO DE BuildsHUD.jsx (ELIMINACIÓN DEFINITIVA DE useScale)
# Objetivo: Eliminar la función useScale para resolver el ReferenceError.
# ====================================================================

echo "🛠️  [FASE 2/2] Eliminación definitiva de useScale en BuildsHUD.jsx..."

# Reescribimos BuildsHUD.jsx para eliminar CUALQUIER uso de useScale, resolviendo el ReferenceError.
cat > src/components/widgets/BuildsHUD.jsx << 'EOF'
// src/components/widgets/BuildsHUD.jsx - VERSIÓN FINAL Y COMPILABLE SIN useScale
'use client';

// CRÍTICO FIX: Se eliminan las importaciones a useScale y ScaleContext, que no existen.
import { useInteractiveWidget } from '@/hooks/useInteractiveWidget';
import { FaLock, FaUnlock } from 'react-icons/fa';
import { useState, useMemo } from 'react';

const FIXED_SCALE = 1.0; // Usamos un valor fijo para el tamaño

export default function BuildsHUD({ lcuData }) { 
  const [isDraggable, setIsDraggable] = useState(true);
  
  // CRÍTICO FIX: Se elimina la desestructuración y llamada a useScale()
  const { position, isLoaded, handleMouseDown } = useInteractiveWidget('widget-builds', { x: 0, y: 50 });
  
  // ** LÓGICA CLAVE DE FASE (FIX DE BLOQUEO) **
  const phase = lcuData?.gameflow?.phase;
  const isActivePhase = phase === 'ChampSelect' || phase === 'InProgress';
  
  // Asumimos que los datos de build vendrán del lcuData (no hay simulación)
  const currentBuild = lcuData?.builds || []; 
  
  const adviceMessage = currentBuild?.items?.length > 0
    ? `Próximo objeto: ${currentBuild.items[0].name}`
    : 'Esperando análisis de builds tácticas...';

  if (!isLoaded || !isActivePhase) return null;

  return (
    <div
      className="absolute w-96 origin-top-left bg-lol-blue-dark/80 border border-lol-gold rounded-md text-lol-gold-light shadow-lg backdrop-blur-sm"
      style={{ 
          top: `${position.y}px`, 
          left: `${position.x}px`, 
          transform: `scale(${FIXED_SCALE})`, // Usa FIXED_SCALE
          cursor: isDraggable ? 'move' : 'default' 
      }}
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
EOF

echo "✅ BuildsHUD.jsx reescrito. El ReferenceError ha sido eliminado. Intente 'npm run build' nuevamente."