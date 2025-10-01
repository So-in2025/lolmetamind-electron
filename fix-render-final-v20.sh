#!/bin/bash
# fix-render-final-v16.sh - Solución final: Re-inyección de estructura pura y limpieza de cache.

LOG_PREFIX="[FINAL-V16-PURITY]"
OVERLAY_PAGE_FILE="src/app/overlay/page.jsx"
APP_NAME="lolmetamind-electron"
NODE_PORT=3001

echo "=========================================================="
echo "$LOG_PREFIX 🚀 PURGA COMPLETA Y REINYECCIÓN DE VISIBILIDAD"
echo "=========================================================="

# 1. PURGA DE CACHÉ Y ARCHIVOS DE COMPLEJIDAD
echo "$LOG_PREFIX 🧹 [PASO 1/4] Eliminando caché de Next.js y archivos de complejidad (Drag/Scale)..."
rm -rf ./.next
rm -rf ./out
rm -f src/components/widgets/DragAndScaleWidget.jsx
rm -f src/context/ScaleContext.jsx

# 2. REINYECCIÓN DE LÓGICA DE MONTAJE SIMPLE
echo "$LOG_PREFIX 📝 [PASO 2/4] Reinyeccion de OverlayPage.jsx con montaje FIJO puro (V16.0)."

cat << 'EOF_OVERLAY_PAGE' > "$OVERLAY_PAGE_FILE"
// src/app/overlay/page.jsx - VERSIÓN FINAL DE PRODUCCIÓN (MONTAJE FIJO PURO V16.0)
"use client"

import React, { useEffect, useState, Suspense } from 'react';
import { useInteractiveWidget } from '../../hooks/useInteractiveWidget'; 
import { useLcuData } from '../../hooks/useLcuData';
import { useAppState } from '@/context/AppStateContext';

// Importamos los widgets 
const ControlsHUD = React.lazy(() => import('../../components/widgets/ControlsHUD'));
const ChampSelectCoach = React.lazy(() => import('../../components/widgets/ChampSelectCoach'));
const InGameCoach = React.lazy(() => import('../../components/widgets/InGameCoach'));
const StatusHUD = React.lazy(() => import('../../components/widgets/StatusHUD'));

// Función TTS (Solo para Coach AI)
const speak = (text, priority = 'normal') => { return; }; 

function OverlayContent() {
    console.log("[OverlayPage] 🟢 Montando componente.");
    
    const { isWidgetInteractive } = useInteractiveWidget('global-overlay'); 
    const lcuData = useLcuData();
    const { userData } = useAppState();
    
    let gamePhase = lcuData?.gameflow?.phase; 
    
    // Si la fase no es activa, no renderizamos nada.
    if (gamePhase === 'EndOfGame' || gamePhase === 'None' || !gamePhase) {
        gamePhase = null;
    }
    
    const WidgetFallback = ({ name }) => (
        <div className="text-red-500 bg-black/80 p-2 rounded-md border border-red-500">
            Error al cargar el widget: {name}
        </div>
    );

    return (
        // Contenedor Final: Sin texto de prueba.
        <div className={`h-full w-full bg-transparent ${isWidgetInteractive ? 'pointer-events-auto' : 'pointer-events-none'}`}>
            
            {/* 1. Controles Globales (Posición 20, 20) - Nivel del botón funcional */}
            {isWidgetInteractive && (
                <div style={{ position: 'fixed', top: '20px', left: '20px', zIndex: 10000, pointerEvents: 'auto' }}>
                     <Suspense fallback={null}>
                        <ControlsHUD isInteractive={isInteractive} />
                    </Suspense>
                </div>
            )}
            
            {/* 2. Status HUD (Fixed, Posición 100, 100) */}
            {gamePhase && (
                 <div style={{ position: 'fixed', top: '100px', left: '100px', zIndex: 9000, pointerEvents: isWidgetInteractive ? 'auto' : 'none' }}>
                    <Suspense fallback={WidgetFallback({name: "StatusHUD"})}>
                        <StatusHUD gamePhase={gamePhase} />
                    </Suspense>
                </div>
            )}
            

            {/* 3. Coach de Selección de Campeones (Fixed, Posición 200, 500) */}
            {gamePhase === 'ChampSelect' && (
                <div style={{ position: 'fixed', top: '200px', left: '500px', zIndex: 9000, pointerEvents: isWidgetInteractive ? 'auto' : 'none' }}>
                    <Suspense fallback={WidgetFallback({name: "ChampSelectCoach"})}>
                        <ChampSelectCoach 
                            champSelectData={lcuData?.gameflow}
                            isInteractive={isWidgetInteractive} 
                        />
                    </Suspense>
                </div>
            )}

            {/* 4. Coach En Partida (Fixed, Posición 700, 100) */}
            {gamePhase === 'InProgress' && (
                <div style={{ position: 'fixed', top: '700px', left: '100px', zIndex: 9000, pointerEvents: isWidgetInteractive ? 'auto' : 'none' }}>
                    <Suspense fallback={WidgetFallback({name: "InGameCoach"})}>
                        <InGameCoach 
                            liveData={lcuData?.liveData}
                            userData={userData}
                            isInteractive={isWidgetInteractive}
                        />
                    </Suspense>
                </div>
            )}
        </div>
    );
}

// Exportación FINAL
export default function OverlayPage() {
    return (
       <OverlayContent />
    );
}
EOF_OVERLAY_PAGE

if [ $? -ne 0 ]; then
    echo "$LOG_PREFIX ❌ ERROR: Fallo al sobrescribir archivos. Abortando."
    exit 1
fi
echo "$LOG_PREFIX ✅ Archivo de montaje final aplicado. Limpieza de pruebas garantizada."
echo "$LOG_PREFIX ----------------------------------------------------------"

# 3. RE-BUILD FUERTE
echo "$LOG_PREFIX 🛠️ [PASO 3/4] Generando el Build de Next.js (Con caché limpia)..."
npm run build

if [ $? -ne 0 ]; then
    echo "$LOG_PREFIX ❌ ERROR: Fallo al generar el Build. Abortando."
    exit 1
fi

# 4. ARRANQUE
echo "$LOG_PREFIX 🟢 [PASO 4/4] Reiniciando el Sistema de Coaching..."
echo "----------------------------------------------------------"
echo "$LOG_PREFIX ⏳ ÉXITO ESPERADO: NO HABRÁ MÁS TEXTO DE PRUEBA. Los HUDs Hextech se verán fijos."
echo "$LOG_PREFIX 💡 UTILIZA CTRL+F1 para que los HUDs sean clickeables y prueba el botón del COACH IA para escuchar la voz."
echo "----------------------------------------------------------"

exec npm run electron:dev

if [ $? -ne 0 ]; then
    echo "$LOG_PREFIX ❌ ERROR CRÍTICO: El comando 'npm run electron:dev' ha fallado al iniciar la aplicación."
    exit 1
fi