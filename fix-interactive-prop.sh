#!/bin/bash
# fix-interactive-prop.sh - Solución final: Corrige la pasada de la prop 'isInteractive' al ControlsHUD.

LOG_PREFIX="[FINAL-V17-PROPS-FIX]"
OVERLAY_PAGE_FILE="src/app/overlay/page.jsx"
APP_NAME="lolmetamind-electron"
NODE_PORT=3001

echo "=========================================================="
echo "$LOG_PREFIX 🚀 CORRIGIENDO ERROR DE REFERENCIA EN OVERLAY/PAGE.JSX"
echo "=========================================================="

# 1. Re-inyección de lógica de montaje con la prop 'isInteractive' correctamente pasada.
echo "$LOG_PREFIX 📝 [PASO 1/3] Reinyeccion de OverlayPage.jsx con la prop 'isInteractive' corregida."

cat << 'EOF_OVERLAY_PAGE' > "$OVERLAY_PAGE_FILE"
// src/app/overlay/page.jsx - VERSIÓN FINAL DE PRODUCCIÓN (MONTAJE FIJO PURO V17.0)
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
            
            {/* 1. Controles Globales (Posición 20, 20) - AHORA CON isInteractive CORRECTAMENTE PASADA */}
            {isWidgetInteractive && (
                <div style={{ position: 'fixed', top: '20px', left: '20px', zIndex: 10000, pointerEvents: 'auto' }}>
                     <Suspense fallback={null}>
                        {/* CRÍTICO: Aquí se pasa correctamente la prop */}
                        <ControlsHUD isInteractive={isWidgetInteractive} />
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
echo "$LOG_PREFIX ✅ Archivo de montaje final aplicado con prop 'isInteractive' corregida."
echo "$LOG_PREFIX ----------------------------------------------------------"

# 2. LIMPIEZA ADICIONAL Y RE-BUILD FUERTE
echo "$LOG_PREFIX 🧹 [PASO 2/3] Eliminando caché de Next.js y Build para garantizar una compilación limpia..."
rm -rf ./.next
rm -rf ./out
npm run build

if [ $? -ne 0 ]; then
    echo "$LOG_PREFIX ❌ ERROR: Fallo al generar el Build. Abortando."
    exit 1
fi

# 3. ARRANQUE
echo "$LOG_PREFIX 🟢 [PASO 3/3] Reiniciando el Sistema de Coaching..."
echo "----------------------------------------------------------"
echo "$LOG_PREFIX ⏳ ÉXITO ESPERADO: NO MÁS 'ReferenceError'. Los HUDs Hextech se verán fijos."
echo "$LOG_PREFIX 💡 UTILIZA CTRL+F1 para activar los HUDs y prueba el botón del COACH IA para escuchar la voz."
echo "----------------------------------------------------------"

exec npm run electron:dev

if [ $? -ne 0 ]; then
    echo "$LOG_PREFIX ❌ ERROR CRÍTICO: El comando 'npm run electron:dev' ha fallado al iniciar la aplicación."
    exit 1
fi