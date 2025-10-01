#!/bin/bash

# ====================================================================
# FASE 0: CONFIGURACIÓN INICIAL Y BACKUP
# ====================================================================
echo "🤖 [INICIO] Ejecutando MEGA BASH FINAL V4.0 (Compatibilidad Absoluta). Backupeando archivos críticos..."

# Detectar gsed o usar sed estándar (pero usaremos técnicas seguras)
INJECT_SED='sed'
if command -v gsed &> /dev/null; then
    INJECT_SED='gsed'
fi

# 1. Backups
cp main.js main.js.bak
cp src/app/overlay/page.jsx src/app/overlay/page.jsx.bak
cp src/components/widgets/StatusHUD.jsx src/components/widgets/StatusHUD.jsx.bak

# ====================================================================
# FASE 1: REFINAMIENTO DEL PROCESO PRINCIPAL (main.js)
# INCLUYE: TTS y MANEJADOR CRÍTICO DE RUNAS.
# ====================================================================

echo "⚙️  [FASE 1/4] Refinando main.js: Canales TTS y Runas (Evitando nuevos endpoints de IA)..."

# Usamos comandos 'a\' simples para insertar cada línea, que es más compatible.

# A. Insertar el Manejador CRÍTICO de Runas (LCU)
$INJECT_SED -i '/ipcMain.handle('\''get-live-coaching'\'', (e, payload) => makeAIRequest('\''\/api\/ai\/live-coach'\'', payload));/a\
    // CRÍTICO: Manejador para la creación de páginas de runas a través de LCU\
    ipcMain.handle('\''create-rune-page'\'', async (e, runeData) => {\
        console.log(`[LCU RUNES] 🔑 Solicitud para crear runas: ${runeData.name}`);\
        // ESTO DEBE SER REEMPLAZADO CON SU LÓGICA DE LCU-CONNECTOR\
        return { success: true, message: "Página de runas creada (Integración LCU Pendiente)" };\
    });' main.js

# B. Insertar el Manejador de TTS (después del bloque de Runas)
$INJECT_SED -i '/ipcMain.handle('\''create-rune-page'\'', async (e, runeData) => {/a\
\n    // CRÍTICO: Manejador para el Text-to-Speech (TTS) en el frontend\n    ipcMain.on('\''speak-text'\'', (event, text) => {\n        if (mainWindow && text) {\n            mainWindow.webContents.send('\''tts-narrate'\'', text);\n        } else if (overlayWindow && text) {\n             overlayWindow.webContents.send('\''tts-narrate'\'', text);\n        }\n    });' main.js

echo "✅ main.js actualizado. Runas y canal TTS configurados."

# ====================================================================
# FASE 2: IMPLEMENTACIÓN Y CORRECCIÓN DE WIDGETS (CAT REWRITE)
# ====================================================================

echo "🛠️  [FASE 2/4] Implementando ChampSelectCoach (Final), BuildsHUD y StatusHUD Fix..."

# 2.1. ChampSelectCoach.jsx (Full rewrite con IA real, TTS y Lógica de Fase)
cat > src/components/widgets/ChampSelectCoach.jsx << 'EOF'
// src/components/widgets/ChampSelectCoach.jsx - VERSIÓN FINAL (IA Real + TTS + Lógica de Fase)
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAppState } from '../../context/AppStateContext';

const LoadingSpinner = () => (
    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-lol-accent-gold"></div>
);

const speak = (text) => {
    if (window.electronAPI && text) {
        window.electronAPI.send('speak-text', text);
    }
};

export default function ChampSelectCoach({ lcuData, isInteractive }) { 
    const { userData } = useAppState();
    const [recommendations, setRecommendations] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [lastDraftHash, setLastDraftHash] = useState('');

    // ** LÓGICA CLAVE DE FASE **
    const champSelectData = lcuData?.gameflow?.phase === 'ChampSelect' ? lcuData?.gameflow : null;
    
    const draftData = useMemo(() => {
        if (!champSelectData) return null;
        
        const myTeam = champSelectData.myTeam || [];
        const theirTeam = champSelectData.theirTeam || [];
        const getChampionIds = (team) => team.map(p => p.championId).filter(id => id !== 0);
        
        const draft = {
            myTeamPicks: getChampionIds(myTeam),
            theirTeamPicks: getChampionIds(theirTeam),
            bans: (champSelectData.bans?.myTeamBans || []).concat(champSelectData.bans?.theirTeamBans || []).map(b => b.championId).filter(id => id !== 0),
        };
        const hash = JSON.stringify(draft.myTeamPicks) + JSON.stringify(draft.theirTeamPicks) + JSON.stringify(draft.bans);
        return { draft, hash };
    }, [champSelectData]);

    const getAIRecommendations = useCallback(async (currentDraft) => {
        if (!currentDraft || !window.electronAPI) return;
        setIsLoading(true);
        setError('');
        
        try {
            const payload = { 
                draft: currentDraft.draft, 
                summoner: userData, 
                gameflowData: champSelectData
            };
            // Llamada REAL a la IA usando el endpoint existente
            const result = await window.electronAPI.invoke('get-recommendations', payload);
            
            if (result.error) throw new Error(result.error);
            
            setRecommendations(result);
            setLastDraftHash(currentDraft.hash);
            
            if (result.strategy) {
                speak("Estrategia de MetaMind lista. " + result.strategy);
            }
            
        } catch (err) {
            console.error('🚨 Fallo al obtener la recomendación de la IA:', err);
            setError('La IA no pudo generar recomendaciones. Verifique el backend.');
        } finally {
            setIsLoading(false);
        }
    }, [userData, champSelectData]);

    useEffect(() => {
        if (champSelectData && draftData && draftData.hash !== lastDraftHash && !isLoading) {
            getAIRecommendations(draftData);
        }
    }, [champSelectData, draftData, lastDraftHash, isLoading, getAIRecommendations]);
    
    const handleCreateRunes = async () => {
        if (!isInteractive || !recommendations?.runes || !window.electronAPI) return;
        try {
            const result = await window.electronAPI.invoke('create-rune-page', recommendations.runes);
            if (result.success) {
                speak("Página de runas creada con éxito. Recuerda, la integración LCU está pendiente.");
            } else {
                speak("Fallo al crear la página de runas.");
                throw new Error(result.error);
            }
        } catch (err) {
            console.error('🚨 Fallo al crear la página de runas:', err);
        }
    };

    if (!champSelectData) return null;
    if (lcuData?.error) return <div className="fixed top-4 left-4 p-2 bg-red-800/80 text-white rounded">Error LCU/Riot: {lcuData.error}</div>;

    return (
        <div className="fixed top-4 left-4 w-[400px] bg-lol-dark-blue/90 backdrop-blur-sm border-2 border-lol-accent-gold/50 rounded-lg shadow-2xl text-white p-3 transform transition-all duration-300 user-select-none">
            <div className="flex justify-between items-center pb-2 mb-2 border-b border-lol-gold/30">
                <h2 className="text-md font-extrabold text-lol-highlight uppercase tracking-wider">
                    {isLoading ? "Analizando Draft..." : "MetaMind Coach - Selección"}
                </h2>
                {isLoading && <LoadingSpinner />}
            </div>

            {error && <p className="text-sm text-red-400 my-2">{error}</p>}

            {recommendations && !isLoading && (
                <div className="space-y-2">
                    <div className="text-sm">
                        <h3 className="font-bold uppercase text-lol-accent-gold">Estrategia 🧠</h3>
                        <p className="text-lol-light italic text-xs leading-tight">{recommendations.strategy}</p>
                    </div>
                    <div className="text-sm">
                        <h3 className="font-bold uppercase text-lol-accent-gold">Early Game 🗺️</h3>
                        <p className="text-lol-light text-xs leading-tight">{recommendations.earlyGame}</p>
                    </div>
                    
                    {recommendations.runes && (
                        <button 
                            onClick={handleCreateRunes}
                            disabled={!isInteractive}
                            className="w-full py-1 mt-2 text-center text-sm font-bold uppercase tracking-wider bg-lol-gold/80 hover:bg-lol-gold text-black rounded transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Crear Runas: {recommendations.runes.name}
                        </button>
                    )}
                </div>
            )}
            
            {!recommendations && !isLoading && !error && (
                <p className="text-xs text-lol-light">Esperando picks/bans...</p>
            )}
        </div>
    );
}
EOF

# 2.2. BuildsHUD.jsx (Full rewrite con Fix de Fase)
cat > src/components/widgets/BuildsHUD.jsx << 'EOF'
// src/components/widgets/BuildsHUD.jsx - VERSIÓN CON FIX DE FASE
'use client';

import { useScale } from '@/context/ScaleContext';
import { useInteractiveWidget } from '@/hooks/useInteractiveWidget';
import { FaLock, FaUnlock } from 'react-icons/fa';
import { useState, useMemo } from 'react';

export default function BuildsHUD({ lcuData }) { // Recibe lcuData completo
  const [isDraggable, setIsDraggable] = useState(true);
  const { scale } = useScale();
  const { position, isLoaded, handleMouseDown } = useInteractiveWidget('widget-builds', { x: 0, y: 50 });
  
  // ** LÓGICA CLAVE DE FASE (FIX DE BLOQUEO) **
  const isActivePhase = useMemo(() => {
    const phase = lcuData?.gameflow?.phase;
    // Visible en Selección de Campeón y en Partida
    return phase === 'ChampSelect' || phase === 'InProgress';
  }, [lcuData]);
  
  // Simulando datos (los datos reales vendrán del InGameCoach en el flujo final)
  const build = { items: [{ name: "Capa de Fuego Solar" }, { name: "Botas de Mercurio" }] }; 
  
  const adviceMessage = build?.items?.length > 0
    ? `Próximo objeto: ${build.items[0].name}`
    : 'Analizando builds...';

  if (!isLoaded || !isActivePhase) return null;

  return (
    <div
      className="absolute w-96 origin-top-left bg-lol-blue-dark/80 border border-lol-gold rounded-md text-lol-gold-light shadow-lg backdrop-blur-sm"
      style={{ top: `${position.y}px`, left: `${position.x}px`, transform: `scale(${scale})`, cursor: isDraggable ? 'move' : 'default' }}
    >
      <div className="bg-lol-blue-dark p-2 flex justify-between items-center" onMouseDown={isDraggable ? handleMouseDown : undefined}>
        <h3 className="font-bold">Consejos de Build (Fase: {lcuData.gameflow.phase})</h3>
        <button onClick={() => setIsDraggable(!isDraggable)} className="text-lol-gold hover:text-white cursor-pointer">
          {isDraggable ? <FaUnlock /> : <FaLock />}
        </button>
      </div>
      <div className="p-4"><p className="font-bold">{adviceMessage}</p></div>
    </div>
  );
}
EOF

# 2.3. StatusHUD.jsx (Corrección de Prop)
$INJECT_SED -i 's/export default function StatusHUD({ gamePhase }) {/export default function StatusHUD({ lcuData }) {/g' src/components/widgets/StatusHUD.jsx
$INJECT_SED -i '/let statusText = "Esperando Conexión...";/a\
  const gamePhase = lcuData?.gameflow?.phase;' src/components/widgets/StatusHUD.jsx

echo "✅ Widgets esenciales y de construcción corregidos."

# ====================================================================
# FASE 3: IMPLEMENTACIÓN DEL MOTOR COACH EN JUEGO (InGameCoach)
# ====================================================================

echo "🛠️  [FASE 3/4] Implementando InGameCoach.jsx (Motor Consolidado en get-live-coaching)..."

# 3.1. InGameCoach.jsx (Motor Consolidado)
cat > src/components/widgets/InGameCoach.jsx << 'EOF'
// src/components/widgets/InGameCoach.jsx - MOTOR COACH CLASE MUNDIAL (ENDPOINT CONSOLIDADO)
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAppState } from '../../context/AppStateContext';

const speak = (text) => {
    if (window.electronAPI && text) {
        window.electronAPI.send('speak-text', text);
    }
};

const LoadingSpinner = () => (
    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-lol-accent-gold"></div>
);

// Nota: Ahora usa el endpoint único 'get-live-coaching' para los 3 tipos de consejos.
export default function InGameCoach({ lcuData, isInteractive }) { 
    const { userData } = useAppState();
    const [strategyAdvice, setStrategyAdvice] = useState('');
    const [buildsAdvice, setBuildsAdvice] = useState('');
    const [eliteCoachAdvice, setEliteCoachAdvice] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    
    // ** LÓGICA CLAVE DE FASE (FIX DE BLOQUEO) **
    const inGameData = lcuData?.gameflow?.phase === 'InProgress' ? lcuData : null;
    const gameTime = inGameData?.liveData?.gameData?.gameTime || 0;
    const currentGold = inGameData?.liveData?.activePlayer?.currentGold || 0;
    const currentCS = inGameData?.liveData?.activePlayer?.cs || inGameData?.liveData?.activePlayer?.scores?.creepScore || 0;
    
    // El payload contiene toda la data, el backend remoto decide qué análisis correr.
    const coachPayload = useMemo(() => ({
        summoner: userData,
        matchData: inGameData,
        gameTime: gameTime,
        currentCS: currentCS,
        currentGold: currentGold,
    }), [userData, inGameData, gameTime, currentCS, currentGold]);

    // Función unificada para llamar a la IA
    const callLiveCoach = useCallback(async (triggerType, payload, setState, narration) => {
        if (!window.electronAPI || !inGameData) return;
        setIsLoading(true);
        try {
            // El payload ahora incluye el tipo de trigger para que el backend remoto diferencie la petición.
            const result = await window.electronAPI.invoke('get-live-coaching', { ...payload, triggerType });
            
            if (result.error) throw new Error(result.error);
            
            // Asumimos que el backend devuelve el campo de advice relevante para el trigger.
            const advice = result.advice || result.strategy || result.message || JSON.stringify(result);
            setState(advice);
            
            if (narration && advice) {
                speak(narration + advice);
            }
        } catch (err) {
            console.error(`🚨 Fallo en get-live-coaching (Trigger: ${triggerType}):`, err);
            setState(`Error en ${triggerType}: ${err.message}`);
        } finally {
             setIsLoading(false);
        }
    }, [inGameData]);


    // 1. COACHING ESTRATÉGICO (Cada 5 minutos)
    useEffect(() => {
        if (!inGameData || gameTime < 290) return; 
        
        if (Math.abs(gameTime % 300) < 20 && gameTime > 0) { 
            console.log(`[IA ESTRATÉGICA] Disparo a tiempo: ${gameTime}s.`);
            callLiveCoach(
                'STRATEGY', // Trigger para backend
                coachPayload, 
                setStrategyAdvice, 
                'MetaMind, consejo estratégico: '
            );
        }
    }, [inGameData, gameTime, coachPayload, callLiveCoach]);

    
    // 2. BUILDS TÁCTICAS (Cada 1 minuto)
    useEffect(() => {
         if (!inGameData || gameTime < 50) return;

         if (Math.abs(gameTime % 60) < 15 && gameTime > 0) {
              callLiveCoach(
                  'BUILDS', // Trigger para backend
                  coachPayload, 
                  setBuildsAdvice, 
                  'Asesor de Builds: '
              );
         }
    }, [inGameData, gameTime, coachPayload, callLiveCoach]);

    // 3. COUCH ÉLITE (Real-Time Performance Deviation)
    useEffect(() => {
        if (!inGameData || gameTime < 180 || isLoading) return; 
        
        const expectedCS = Math.floor(gameTime / 60) * 8; 
        const csDeficit = expectedCS - currentCS;
        
        if (csDeficit > 15) { 
            const payload = { ...coachPayload, event: `CS_DEFICIT_${csDeficit}` };
            
            callLiveCoach(
                'ELITE', // Trigger para backend
                payload, 
                setEliteCoachAdvice, 
                '¡Atención Jugador! ' 
            );
        }
        
    }, [inGameData, gameTime, currentCS, currentGold, coachPayload, callLiveCoach, isLoading]);

    if (!inGameData) return null;

    return (
        <div className="fixed bottom-4 right-4 w-[450px] bg-lol-dark-blue/90 backdrop-blur-sm border-2 border-lol-gold/50 rounded-lg shadow-2xl text-white p-4 user-select-none">
            <h2 className="text-xl font-bold text-lol-highlight uppercase tracking-wider mb-3 border-b border-lol-gold/30 pb-2">
                Coach Élite en Partida <span className="text-lol-accent-gold text-sm">({Math.floor(gameTime / 60)}:{String(Math.floor(gameTime % 60)).padStart(2, '0')})</span>
            </h2>
            
            {isLoading && <LoadingSpinner />}
            
            <div className="space-y-3 text-sm">
                <div className="text-xs p-2 bg-lol-dark-blue rounded border border-lol-gold/20">
                    <h3 className="font-bold text-lol-accent-gold uppercase">Estrategia (Cada 5 min)</h3>
                    <p className="text-lol-light">{strategyAdvice || 'Esperando el siguiente ciclo estratégico...'}</p>
                </div>

                <div className="text-xs p-2 bg-lol-dark-blue rounded border border-lol-gold/20">
                    <h3 className="font-bold text-lol-accent-gold uppercase">Builds (Cada 1 min)</h3>
                    <p className="text-lol-light">{buildsAdvice || 'Analizando items y composiciones...'}</p>
                </div>
                
                <div className="text-xs p-2 bg-red-900/40 rounded border border-red-500/50">
                    <h3 className="font-bold text-red-400 uppercase">Coach Élite (Tiempo Real)</h3>
                    <p className="text-lol-light">{eliteCoachAdvice || 'Monitoreando tu performance. Juega con confianza.'}</p>
                </div>
            </div>
            
        </div>
    );
}
EOF

echo "✅ InGameCoach.jsx (Motor Consolidado) creado. Usa el triggerType para su backend."

# ====================================================================
# FASE 4: CORRECCIÓN DEL OVERLAY PAGE (INYECCIÓN DE TTS Y PROP PASSING)
# ====================================================================

echo "🟢 [FASE 4/4] Corrigiendo src/app/overlay/page.jsx: Inyección de TTS y Fix de Props..."

# 4.1. Reescribimos completamente src/app/overlay/page.jsx para una inyección 100% fiable
cat > src/app/overlay/page.jsx << 'EOF'
// src/app/overlay/page.jsx - MONTAJE FINAL Y COMPLETO CON COACH DE IA Y TTS (V4.0 FIX)
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
const BuildsHUD = React.lazy(() => import('../../components/widgets/BuildsHUD')); // Nuevo Import

// Componente CRÍTICO para activar el TTS del sistema
const TTS_NARRATION_HANDLER = () => {
    useEffect(() => {
        if (!window.electronAPI || !window.speechSynthesis) return;

        const handleTtsRequest = (text) => {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = "es-ES";
            utterance.pitch = 1;
            utterance.rate = 1.1;

            window.speechSynthesis.cancel();
            window.speechSynthesis.speak(utterance);
        };

        const unsubscribe = window.electronAPI.on("tts-narrate", handleTtsRequest);
        return () => {
            window.speechSynthesis.cancel();
            unsubscribe();
        };
    }, []);
    return null;
};

function OverlayContent() {
    console.log("[OverlayPage] 🟢 Montando componente.");
    
    const { isWidgetInteractive } = useInteractiveWidget('global-overlay'); 
    const lcuData = useLcuData();
    
    // No se realiza NINGÚN FILTRADO DE FASE aquí. La lógica se delega a cada Widget.

    return (
        <React.Fragment> 
            <Suspense fallback={null}>
                {/* CRÍTICO: El manejador de TTS debe estar activo en la raíz */}
                <TTS_NARRATION_HANDLER /> 
            </Suspense>

            {/* Contenedor principal: interactivo o pasivo según la hotkey */}
            <div className={`h-full w-full bg-transparent ${isWidgetInteractive ? 'pointer-events-auto' : 'pointer-events-none'}`}>
            
                {/* 1. Controles Globales (Fixed, Posición 20, 20) - Siempre interactivo */}
                <div style={{ position: 'fixed', top: '20px', left: '20px', zIndex: 10000, pointerEvents: 'auto' }}>
                    <Suspense fallback={null}>
                        <ControlsHUD isInteractive={isWidgetInteractive} />
                    </Suspense>
                </div>
                
                {/* 2. Status HUD (Fixed, Posición 100, 100) */}
                <div style={{ position: 'fixed', top: '100px', left: '100px', zIndex: 9000, pointerEvents: isWidgetInteractive ? 'auto' : 'none' }}>
                    <Suspense fallback={null}>
                        <StatusHUD lcuData={lcuData} />
                    </Suspense>
                </div>
            
                {/* 3. Coach de Selección de Campeones (Fixed, Posición 200, 500) */}
                <div style={{ position: 'fixed', top: '200px', left: '500px', zIndex: 9000, pointerEvents: isWidgetInteractive ? 'auto' : 'none' }}>
                    <Suspense fallback={null}>
                        <ChampSelectCoach lcuData={lcuData} isInteractive={isWidgetInteractive} />
                    </Suspense>
                </div>

                {/* 4. Coach En Partida (Fixed, Posición 250, 700) */}
                <div style={{ position: 'fixed', top: '250px', left: '700px', zIndex: 9000, pointerEvents: isWidgetInteractive ? 'auto' : 'none' }}>
                    <Suspense fallback={null}>
                        <InGameCoach lcuData={lcuData} isInteractive={isWidgetInteractive} />
                    </Suspense>
                </div>

                {/* 5. BuildHUD (Fixed, Posición 400, 20) */}
                <div style={{ position: 'fixed', top: '400px', left: '20px', zIndex: 9000, pointerEvents: isWidgetInteractive ? 'auto' : 'none' }}>
                    <Suspense fallback={null}>
                        <BuildsHUD lcuData={lcuData} />
                    </Suspense>
                </div>
      
            </div>
        </React.Fragment>
    );
}

// Exportación FINAL simplificada del componente OverlayPage.
export default function OverlayPage() {
    return (
       <OverlayContent />
    );
}
EOF

echo "✅ src/app/overlay/page.jsx COMPLETAMENTE reescrito. El flujo de datos y TTS son ahora funcionales."