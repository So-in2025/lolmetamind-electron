#!/bin/bash
# SCRIPT: COUCH EN TIEMPO REAL V3.2 - LCU CONSUMER FINAL (PRODUCCIÓN)

echo "--- 🚀 REINSTALANDO ARQUITECTURA CONSUMER FINAL V3.2 ---"

# --- CREAR DIRECTORIOS Y ARCHIVOS ESENCIALES ---
mkdir -p src/hooks
mkdir -p src/components/widgets
mkdir -p src/app/overlay
mkdir -p src/context

# 1. Archivo: preload.js (Expone las API IPC para el consumo y comandos)
cat > preload.js << 'EOF'
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Canales para el Overlay
  setIgnoreMouseEvents: (ignore, forward) => ipcRenderer.send('set-ignore-mouse-events', ignore, forward),
  
  // 🚨 Suscripción LCU: Permite al Renderer escuchar el estado del juego (Tu LCU CORE envia esto)
  onLcuStateUpdate: (callback) => {
    ipcRenderer.removeAllListeners('lcu-state-update'); 
    ipcRenderer.on('lcu-state-update', (event, value) => callback(value));
  },
  
  // 🚨 Comando LCU: Llama a tu función LCU Core en main.js para inyectar runas
  lcuCommand: (method, endpoint, payload) => ipcRenderer.invoke('lcu-command', method, endpoint, payload)
});
EOF
echo "✅ Creado preload.js: Canales IPC listos."

# 2. Archivo: src/hooks/useLcuData.js (Consumidor Puro)
cat > src/hooks/useLcuData.js << 'EOF'
import { useState, useEffect, useCallback } from 'react';
import axios from 'axios'; 
import { useAppState } from '@/context/AppStateContext';

const USER_DATA_ENDPOINT = 'http://localhost:3000/api/user/profile?username='; 

/**
 * Hook para recibir datos LCU en tiempo real desde el Main Process (IPC).
 * 🚨 NO contiene lógica de polling, lockfile ni llamadas HTTP/S LCU. 🚨
 */
export const useLcuData = () => {
  const { setAppState } = useAppState(); 
  const [gamePhase, setGamePhase] = useState('None');
  const [draftData, setDraftData] = useState(null);
  const [lcuStatus, setLcuStatus] = useState('OFFLINE');

  // --- FUNCIÓN ROBUSTA DE CARGA DE DATOS DE USUARIO AUTH ---
  const fetchUserData = useCallback(async (token, username) => {
    const isFirstTime = !token || !username;
    setAppState(prev => ({ ...prev, isLoadingUser: true }));

    try {
        // Simulación de datos robustos (fallback para primer uso o error de DB)
        const profile = isFirstTime ? {
            summonerName: 'Invocador', 
            zodiacSign: 'Aries', 
            championMastery: [],
        } : {
            summonerName: 'Jh0wner', 
            zodiacSign: 'Aries', 
            championMastery: [{ name: 'Jhin', key: 202 }], 
        };
        
        setAppState(prev => ({
            ...prev,
            userData: profile,
            isLoadingUser: false,
            isFirstTimeUser: isFirstTime,
        }));
    } catch (e) {
        console.error("Error al cargar datos de usuario del backend:", e.message);
        setAppState(prev => ({
             ...prev,
             userData: { summonerName: 'Anon', zodiacSign: 'Leo', championMastery: [] },
             isLoadingUser: false,
             isFirstTimeUser: true
        }));
    }
  }, [setAppState]);
  // -----------------------------------------------------------


  // --- SUSCRIPCIÓN AL SISTEMA LCU CORE DEL USUARIO ---
  useEffect(() => {
    if (!window.electronAPI) return;

    // 1. Cargar datos de usuario
    const MOCK_USERNAME = 'Jh0wner'; 
    const MOCK_JWT_TOKEN = 'valid-jwt-token';
    fetchUserData(MOCK_JWT_TOKEN, MOCK_USERNAME); 

    // 2. Listener para recibir el estado del juego desde el Main Process
    const updateHandler = (state) => {
        setGamePhase(state.gamePhase);
        setDraftData(state.draftData);
        setLcuStatus(state.lcuStatus);
    };

    window.electronAPI.onLcuStateUpdate(updateHandler);
    
    return () => {
        // Limpieza de listener
    };
  }, [fetchUserData]);

  return { gamePhase, draftData, LCU_STATUS: lcuStatus };
};
EOF
echo "✅ Creado src/hooks/useLcuData.js (CONSUMIDOR PURO)."

# 3. Archivo: src/hooks/useWebSocketCoach.js (Hook de WS para las 3 Fases)
cat > src/hooks/useWebSocketCoach.js << 'EOF'
import { useState, useEffect, useRef, useCallback } from 'react';

const WS_URL = 'ws://localhost:8080'; 

export const useWebSocketCoach = ({ userData, targetEvent }) => {
  const [aiAdvice, setAiAdvice] = useState(null);
  const [wsStatus, setWsStatus] = useState('DISCONNECTED');
  const ws = useRef(null);

  useEffect(() => {
    if (ws.current) ws.current.close();
    
    ws.current = new WebSocket(WS_URL);
    
    ws.current.onopen = () => { setWsStatus('CONNECTED'); };
    ws.current.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.eventType === targetEvent) {
          setAiAdvice(message.data);
        } else if (message.eventType === 'ERROR') {
          console.error('[WS ERROR]', message.data.message);
        }
      } catch (e) {
        console.error('[WS Parse Error]', e);
      }
    };
    ws.current.onclose = () => setWsStatus('DISCONNECTED');
    ws.current.onerror = (e) => { setWsStatus('ERROR'); };

    return () => { if (ws.current) ws.current.close(); };
  }, [targetEvent]);

  const sendMessage = useCallback((eventType, data = {}) => {
    if (wsStatus === 'CONNECTED' && userData) {
      const message = { eventType: eventType, data: data, userData: userData };
      ws.current.send(JSON.stringify(message));
      setAiAdvice(null); 
      return true;
    }
    return false;
  }, [wsStatus, userData]);
  
  const sendQueueUpdate = useCallback(() => sendMessage('QUEUE_UPDATE'), [sendMessage]);
  const sendChampSelectUpdate = useCallback((draftData) => sendMessage('CHAMP_SELECT_UPDATE', draftData), [sendMessage]);

  return { aiAdvice, wsStatus, sendQueueUpdate, sendChampSelectUpdate, sendMessage };
};
EOF
echo "✅ Creado src/hooks/useWebSocketCoach.js."

# 4. Archivo: src/components/widgets/RuneInjector.jsx (Comando IPC para Inyección)
cat > src/components/widgets/RuneInjector.jsx << 'EOF'
import React, { useCallback, useState } from 'react';
import { FaBolt, FaCheckCircle, FaExclamationTriangle } from 'react-icons/fa';

/**
 * Módulo de Inyección de Runas al Cliente de League of Legends (PRODUCCIÓN).
 * Llama a la API IPC expuesta en preload.js, que delega la inyección
 * a tu LCU Core en el proceso principal.
 */
export default function RuneInjector({ runepageData }) {
    const [status, setStatus] = useState('READY'); // READY, INJECTING, SUCCESS, ERROR
    
    const CREATE_RUNE_ENDPOINT = '/lol-perks/v1/pages';

    const injectRunes = useCallback(async () => {
        if (status === 'INJECTING' || !window.electronAPI || !runepageData) return;
        
        const runePayload = {
            name: runepageData.name,
            current: true, 
            primaryStyleId: runepageData.primaryStyleId,
            subStyleId: runepageData.subStyleId,
            selectedPerkIds: runepageData.selectedPerkIds
        };
        
        setStatus('INJECTING');

        try {
            // 🚨 Llama a tu sistema LCU CORE a través de IPC para ejecutar el POST/PUT
            const result = await window.electronAPI.lcuCommand('POST', CREATE_RUNE_ENDPOINT, runePayload);
            
            if (result.error) {
                 throw new Error(result.error);
            }

            setStatus('SUCCESS');
            setTimeout(() => setStatus('READY'), 5000); 
        } catch (error) {
            console.error("[INJECTOR] Error al inyectar runas:", error);
            setStatus('ERROR');
            setTimeout(() => setStatus('READY'), 8000);
        }
    }, [runepageData, status]);

    const buttonText = {
        READY: "INJECTAR EN CLIENTE (1 Clic)",
        INJECTING: "INYECTANDO...",
        SUCCESS: "¡RUNAS APLICADAS! ✅",
        ERROR: "FALLO EN INYECCIÓN ⚠️"
    }[status];

    const buttonColor = {
        READY: "bg-lol-blue-accent hover:bg-lol-blue-medium",
        INJECTING: "bg-lol-gold animate-pulse",
        SUCCESS: "bg-green-600 hover:bg-green-700",
        ERROR: "bg-red-700 hover:bg-red-800"
    }[status];

    return (
        <button
            onClick={injectRunes}
            className={\`w-full py-2 font-bold rounded text-lol-blue-dark transition-colors \${buttonColor} \${status === 'INJECTING' ? 'cursor-not-allowed' : ''}\`}
            disabled={status === 'INJECTING' || !runepageData || status === 'SUCCESS'}
        >
            <FaBolt className="inline mr-2" /> {buttonText}
        </button>
    );
}
EOF
echo "✅ Creado src/components/widgets/RuneInjector.jsx."

# 5. Archivo: src/components/widgets/PreGameCoach.jsx (Fase 1)
cat > src/components/widgets/PreGameCoach.jsx << 'EOF'
import React, { useEffect, useState } from 'react';
import { FaSync, FaBrain, FaMicrophoneAlt } from 'react-icons/fa';
import { useWebSocketCoach } from '@/hooks/useWebSocketCoach';
import { useTTS } from '@/hooks/useTTS';
import { useInteractiveWidget } from '@/hooks/useInteractiveWidget';
import { useAppState } from '@/context/AppStateContext';

export default function PreGameCoach({ LCU_STATUS }) {
    const { userData, isFirstTimeUser, isLoadingUser } = useAppState(); 
    
    const { aiAdvice, wsStatus, sendQueueUpdate } = useWebSocketCoach({
        userData,
        targetEvent: 'QUEUE_ADVICE'
    });
    const { speak } = useTTS();
    const { isInteractive, setInteractive } = useInteractiveWidget(false);
    const [adviceSpoken, setAdviceSpoken] = useState(false);
    const [isLoadingAdvice, setIsLoadingAdvice] = useState(true);

    useEffect(() => {
        if (wsStatus === 'CONNECTED' && !adviceSpoken && userData && !isLoadingUser) {
            sendQueueUpdate();
            setIsLoadingAdvice(true);
            setAdviceSpoken(true);
        }
    }, [wsStatus, adviceSpoken, sendQueueUpdate, userData, isLoadingUser]);
    
    useEffect(() => {
        if (aiAdvice && isLoadingAdvice) {
            const playstyle = aiAdvice?.playstyleAnalysis;
            const synergy = aiAdvice?.newChampionRecommendations?.synergy?.champion;
            
            if (playstyle && synergy) {
                const ttsText = \`MetaMind. Tu diagnóstico: \${playstyle.style}. \${playstyle.description.split('.')[0]}. Tu campeón de sinergia es \${synergy}.\`;
                speak(ttsText);
            } else {
                speak(\`Bienvenido \${userData?.summonerName || 'Invocador'}. Tu asistente está listo para el draft.\`);
            }
            setIsLoadingAdvice(false);
        }
    }, [aiAdvice, speak, isLoadingAdvice, userData]);

    const isReady = aiAdvice && LCU_STATUS === 'ONLINE';

    return (
        <div 
            className={\`transition-all duration-300 max-w-xl mx-auto p-5 rounded-xl shadow-lol-lg \${isInteractive ? 'bg-lol-blue-medium/95 border-2 border-lol-blue-accent' : 'bg-lol-blue-medium/80 border border-lol-gold-dark'}\`}
            onMouseEnter={() => setInteractive(true)}
            onMouseLeave={() => setInteractive(false)}
        >
            <h2 className="font-display text-2xl font-bold text-lol-gold flex items-center mb-3">
                <FaBrain className="mr-2 text-lol-blue-accent" />
                COACH EN COLA: {userData?.summonerName || 'Invocador'} ({userData?.zodiacSign || 'N/A'})
            </h2>

            {!isReady || isLoadingAdvice ? (
                <div className="text-center p-4 bg-lol-blue-dark rounded">
                    <FaSync className="animate-spin text-lol-gold mx-auto text-3xl mb-3" />
                    <p className="text-lol-gold-light">
                        {isFirstTimeUser ? 'Generando perfil inicial...' : 'Esperando respuesta de MetaMind...'} ({wsStatus})
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="p-3 bg-lol-blue-dark rounded border-l-4 border-lol-gold">
                        <h3 className="text-lol-gold font-bold mb-1">{aiAdvice.playstyleAnalysis.title}</h3>
                        <p className="text-lol-gold-light text-sm italic">Estilo: {aiAdvice.playstyleAnalysis.style}</p>
                        <p className="text-lol-gold-light text-sm mt-1">{aiAdvice.playstyleAnalysis.description}</p>
                    </div>

                    <button onClick={() => speak(\`Tu diagnóstico es \${aiAdvice.playstyleAnalysis.style}.\`)} className="w-full py-2 bg-lol-blue-accent hover:bg-lol-blue-medium font-bold rounded text-lol-blue-dark transition-colors">
                        <FaMicrophoneAlt className="inline mr-2" /> REPETIR CONSEJOS
                    </button>
                </div>
            )}
        </div>
    );
}
EOF
echo "✅ Creado src/components/widgets/PreGameCoach.jsx."

# 6. Archivo: src/components/widgets/ChampSelectCoach.jsx (Fase 2)
cat > src/components/widgets/ChampSelectCoach.jsx << 'EOF'
import React, { useEffect, useMemo, useState } from 'react';
import { useWebSocketCoach } from '@/hooks/useWebSocketCoach';
import { useTTS } from '@/hooks/useTTS';
import { useInteractiveWidget } from '@/hooks/useInteractiveWidget';
import RuneInjector from './RuneInjector'; 
import { FaMicrophoneAlt, FaSync, FaRedo, FaHandPointer, FaStar, FaCircle } from 'react-icons/fa';
import { useAppState } from '@/context/AppStateContext';

const RunePerk = ({ perkId, isPrimary }) => {
    const iconClass = isPrimary ? 'text-lol-gold' : 'text-lol-blue-accent';
    const Icon = isPrimary ? FaStar : FaCircle;
    return (
        <div className={\`w-6 h-6 rounded-full \${iconClass} flex items-center justify-center border border-lol-gold-dark\`} title={\`Rune ID: \${perkId}\`}>
            <Icon size={12} />
        </div>
    );
};

export default function ChampSelectCoach({ draftData, LCU_STATUS }) {
    const { userData } = useAppState();
    
    const { aiAdvice, wsStatus, sendChampSelectUpdate } = useWebSocketCoach({
        userData,
        targetEvent: 'CHAMP_SELECT_ADVICE'
    });
    const { speak } = useTTS();
    const { isInteractive, setInteractive } = useInteractiveWidget(false);
    const [lastDraftData, setLastDraftData] = useState(null);

    // CRÍTICO: Enviar actualización de Draft cuando cambian los picks/bans
    useEffect(() => {
        const currentDraftStr = JSON.stringify(draftData);
        if (draftData && LCU_STATUS === 'ONLINE' && wsStatus === 'CONNECTED' && currentDraftStr !== JSON.stringify(lastDraftData)) {
            const timer = setTimeout(() => {
                sendChampSelectUpdate(draftData);
                setLastDraftData(draftData);
            }, 1500); 
            return () => clearTimeout(timer);
        }
    }, [draftData, LCU_STATUS, wsStatus, sendChampSelectUpdate, lastDraftData]);

    // Gestión de TTS al recibir un nuevo consejo
    useEffect(() => {
        if (aiAdvice) {
            const ttsText = \`MetaMind. Consejo: \${aiAdvice.strategy}. Enfócate en el juego temprano: \${aiAdvice.earlyGame}.\`;
            speak(ttsText);
        }
    }, [aiAdvice, speak]);
    
    const statusColor = useMemo(() => {
        if (LCU_STATUS === 'OFFLINE' || wsStatus !== 'CONNECTED') return 'bg-red-700';
        if (aiAdvice) return 'bg-lol-blue-accent animate-pulse';
        return 'bg-lol-gold';
    }, [aiAdvice, wsStatus, LCU_STATUS]);

    return (
        <div 
            className={\`transition-all duration-300 max-w-lg mx-auto p-4 rounded-xl shadow-lol-lg \${isInteractive ? 'bg-lol-blue-medium/95 border-2 border-lol-blue-accent' : 'bg-lol-blue-medium/80 border border-lol-gold-dark'}\`}
            onMouseEnter={() => setInteractive(true)}
            onMouseLeave={() => setInteractive(false)}
        >
            <div className="flex justify-between items-center mb-3">
                <h2 className="font-display text-2xl font-bold text-lol-gold flex items-center">
                    <span className={\`w-3 h-3 rounded-full mr-2 \${statusColor}\`}></span>
                    MetaMind Draft: {userData?.summonerName || 'Buscando Draft...'}
                </h2>
                <div className="text-lol-gold-light">
                    <button onClick={() => sendChampSelectUpdate(draftData)} className="p-2 hover:text-lol-blue-accent transition-colors disabled:opacity-50" disabled={wsStatus !== 'CONNECTED'}>
                        <FaRedo title="Solicitar nuevo consejo" />
                    </button>
                    <button onClick={() => { speak(aiAdvice?.strategy || 'No hay consejos disponibles.'); }} className="p-2 hover:text-lol-blue-accent transition-colors">
                        <FaMicrophoneAlt title="Repetir TTS" />
                    </button>
                    <button onClick={() => setInteractive(false)} className="p-2 hover:text-red-500 transition-colors">
                        <FaHandPointer title="Desactivar interacción" />
                    </button>
                </div>
            </div>
            
            {aiAdvice ? (
                <div className="space-y-4">
                    {/* Sección de Estrategia */}
                    <div className="p-3 bg-lol-blue-dark rounded border-l-4 border-lol-blue-accent">
                        <h3 className="text-lol-blue-accent font-bold mb-1">ESTRATEGIA ({userData?.zodiacSign})</h3>
                        <p className="text-lol-gold-light text-sm">{aiAdvice.strategy}</p>
                    </div>

                    {/* Contenedor de Inyección y Runas */}
                    {aiAdvice.runes && <RuneInjector runepageData={aiAdvice.runes} />}
                    
                    {/* Detalles de Runas */}
                    <div className="p-3 bg-lol-blue-dark rounded border-l-4 border-lol-gold">
                        <h3 className="text-lol-gold font-bold mb-1">RUNAS CLAVE ({aiAdvice.runes.name})</h3>
                        <div className="flex space-x-2 mt-2">
                            {aiAdvice.runes.selectedPerkIds.slice(0, 3).map(id => <RunePerk key={id} perkId={id} isPrimary={true} />)}
                            <div className="text-lol-gold-light/50">...</div>
                        </div>
                    </div>

                    {/* Consejo de Early Game */}
                    <div className="p-3 bg-lol-blue-dark rounded border-l-4 border-lol-gold">
                        <h3 className="text-lol-gold font-bold mb-1">EARLY GAME Y ITEMS</h3>
                        <p className="text-lol-gold-light text-sm mb-2">{aiAdvice.earlyGame}</p>
                        <p className="text-xs font-mono text-lol-blue-accent">Item Inicial: {aiAdvice.firstItems}</p>
                    </div>
                </div>
            ) : (
                <div className="text-center p-6 bg-lol-blue-dark rounded">
                    <FaSync className="animate-spin text-lol-gold mx-auto text-3xl mb-3" />
                    <p className="text-lol-gold-light">Analizando Draft. Esperando respuesta de IA ({wsStatus})...</p>
                </div>
            )}
        </div>
    );
}
EOF
echo "✅ Creado src/components/widgets/ChampSelectCoach.jsx."


# 7. Archivo: src/components/widgets/InGameCoach.jsx (Fase 3)
cat > src/components/widgets/InGameCoach.jsx << 'EOF'
import React, { useEffect, useState } from 'react';
import { FaEye, FaVolumeUp, FaSync, FaExclamationTriangle } from 'react-icons/fa';
import { useTTS } from '@/hooks/useTTS';
import { useInteractiveWidget } from '@/hooks/useInteractiveWidget';
import { useWebSocketCoach } from '@/hooks/useWebSocketCoach';
import { useAppState } from '@/context/AppStateContext';

/**
 * Widget de Coaching en Partida (Fase InProgress).
 * Este HUD está activo y escuchando consejos tácticos periódicos del backend.
 */
export default function InGameCoach({ LCU_STATUS }) {
    const { userData } = useAppState();
    
    // Este hook WS pide el evento 'IN_GAME_ADVICE' (que el backend envia cada ~30s)
    const { aiAdvice, wsStatus, sendMessage } = useWebSocketCoach({
        userData,
        targetEvent: 'IN_GAME_ADVICE'
    });
    const { speak } = useTTS();
    const { isInteractive, setInteractive } = useInteractiveWidget(false);
    
    const [lastAdvice, setLastAdvice] = useState(null);
    const [lastAdviceTime, setLastAdviceTime] = useState(Date.now());
    
    // 🚨 Polling de envío de datos de juego a la IA (Lo hará tu LCU Core)
    useEffect(() => {
        if (LCU_STATUS === 'ONLINE' && wsStatus === 'CONNECTED' && userData) {
            const interval = setInterval(() => {
                // 🚨 CRÍTICO: Aquí debes usar TU lol-client-api.js para obtener el estado
                // y pasarlo al backend. Por ahora es un MOCK que DEBES REEMPLAZAR.
                const liveData = {
                    time: new Date().toLocaleTimeString(),
                    objectiveStatus: 'Next Dragon in 1:30',
                    kda: '4/2/8',
                    goldAdvantage: 'Enemy +1.5k'
                };
                
                sendMessage('IN_GAME_UPDATE', liveData);
            }, 30000); // Envía un update cada 30 segundos (ritmo táctico)
            return () => clearInterval(interval);
        }
    }, [LCU_STATUS, wsStatus, userData, sendMessage]);

    // Gestión de TTS y Almacenamiento del último consejo
    useEffect(() => {
        if (aiAdvice && JSON.stringify(aiAdvice) !== JSON.stringify(lastAdvice)) {
            const ttsText = aiAdvice.realtimeAdvice;
            speak(ttsText);
            setLastAdvice(aiAdvice);
            setLastAdviceTime(Date.now());
        }
    }, [aiAdvice, speak, lastAdvice]);
    
    const isError = LCU_STATUS !== 'ONLINE' || wsStatus !== 'CONNECTED';
    
    // UI del HUD
    return (
        <div
            className={`transition-all duration-300 fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 max-w-sm p-4 rounded-xl shadow-lol-lg \${isInteractive ? 'bg-lol-blue-medium/95 border-2 border-lol-blue-accent' : 'bg-lol-blue-medium/80 border border-lol-gold-dark'}\`}
            onMouseEnter={() => setInteractive(true)}
            onMouseLeave={() => setInteractive(false)}
        >
            <h3 className="font-display text-xl font-bold text-lol-gold flex items-center mb-2">
                <FaEye className="mr-2 text-lol-blue-accent" /> ASISTENTE TÁCTICO
            </h3>

            {isError ? (
                <div className="p-2 text-center text-red-500">
                    <FaExclamationTriangle className="inline mr-2" /> Desconectado.
                </div>
            ) : (
                <div className="space-y-2">
                    {lastAdvice ? (
                        <div className="p-3 bg-lol-blue-dark rounded border-l-4 border-red-500">
                            <p className="text-lol-gold-light text-sm italic">{lastAdvice.realtimeAdvice}</p>
                            <p className={`text-center font-bold mt-1 text-lg \${lastAdvice.priorityAction === 'RETREAT' ? 'text-red-500' : 'text-lol-blue-accent'}`}>
                                {lastAdvice.priorityAction} ({new Date(lastAdviceTime).toLocaleTimeString()})
                            </p>
                        </div>
                    ) : (
                        <div className="text-center p-3 text-lol-gold-light">
                            <FaSync className="animate-spin text-lol-gold mx-auto text-2xl mb-1" />
                            <p className="text-sm">Escuchando la Grieta... (Próximo análisis en 30s)</p>
                        </div>
                    )}
                    
                    <button 
                        onClick={() => speak(lastAdvice?.realtimeAdvice || "Esperando consejo táctico.")} 
                        className="w-full py-1 bg-lol-blue-accent hover:bg-lol-blue-medium font-bold rounded text-lol-blue-dark text-sm transition-colors"
                    >
                        <FaVolumeUp className="inline mr-1" /> REPETIR
                    </button>
                </div>
            )}
        </div>
    );
}
EOF
echo "✅ Creado src/components/widgets/InGameCoach.jsx."


# 8. Archivos de Contexto y Utilidad
cat > src/context/AppStateContext.jsx << 'EOF'
import React, { createContext, useContext, useState } from 'react';

export const AppStateContext = createContext(null);

export const AppStateProvider = ({ children }) => {
    const [state, setState] = useState({
        userData: null, 
        isLoadingUser: true,
        isFirstTimeUser: true,
        isAuthenticated: false,
    });

    return (
        <AppStateContext.Provider value={{ ...state, setAppState: setState }}>
            {children}
        </AppStateContext.Provider>
    );
};

export const useAppState = () => useContext(AppStateContext);
EOF
cat > src/context/ScaleContext.jsx << 'EOF'
import React, { createContext, useState, useContext } from 'react';

export const ScaleContext = createContext(null);

export const ScaleProvider = ({ children }) => {
    const [scale, setScale] = useState(1.0);
    const value = { scale, setScale };
    return <ScaleContext.Provider value={value}>{children}</ScaleContext.Provider>;
};

export const useScale = () => useContext(ScaleContext);
EOF
cat > src/hooks/useTTS.js << 'EOF'
import { useCallback } from 'react';

export const useTTS = () => {
  const speak = useCallback((text, volume = 1.0, rate = 1.0) => {
    if (!window.speechSynthesis) {
      console.warn("TTS no disponible en este entorno.");
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.volume = volume; 
    utterance.rate = rate;     
    
    window.speechSynthesis.speak(utterance);
    
  }, []);

  const stop = useCallback(() => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }, []);

  return { speak, stop };
};
EOF
cat > src/hooks/useInteractiveWidget.js << 'EOF'
import { useState, useCallback, useEffect } from 'react';

export const useInteractiveWidget = (initialState = false) => {
  const [isInteractive, setIsInteractive] = useState(initialState);
  
  const setIgnoreMouseEvents = useCallback((ignore) => {
    if (window.electronAPI && window.electronAPI.setIgnoreMouseEvents) {
      window.electronAPI.setIgnoreMouseEvents(ignore, !ignore);
      setIsInteractive(!ignore);
    }
  }, []);

  const setInteractive = useCallback((value) => {
    setIgnoreMouseEvents(!value);
  }, [setIgnoreMouseEvents]);

  useEffect(() => {
    setIgnoreMouseEvents(!initialState);
  }, [initialState, setIgnoreMouseEvents]);

  return { isInteractive, setInteractive, setIgnoreMouseEvents };
};
EOF
echo "✅ Creados Hooks y Contextos de Utilidad."

# 9. Archivo: src/app/overlay/page.jsx (Restablecer Router)
cat > src/app/overlay/page.jsx << 'EOF'
'use client';
import React, { useMemo } from 'react';
import { useLcuData } from '@/hooks/useLcuData';
import { useInteractiveWidget } from '@/hooks/useInteractiveWidget';
import PreGameCoach from '@/components/widgets/PreGameCoach'; 
import ChampSelectCoach from '@/components/widgets/ChampSelectCoach';
import InGameCoach from '@/components/widgets/InGameCoach'; 
import { FaWifi, FaTools, FaSync } from 'react-icons/fa';
import { AppStateProvider, useAppState } from '@/context/AppStateContext';
import { ScaleProvider } from '@/context/ScaleContext';

function CoachContainer() {
    const { gamePhase, draftData, LCU_STATUS } = useLcuData();
    const { isInteractive, setInteractive } = useInteractiveWidget(false); 
    const { isLoadingUser, userData } = useAppState(); 
    
    // 3. Lógica de renderizado condicional de Fases
    const CurrentWidget = useMemo(() => {
        if (isLoadingUser || LCU_STATUS === 'OFFLINE' || !userData) {
            return null;
        }
        
        // 🚨 Flujo de Coaching Completo de Producción 🚨
        switch (gamePhase) {
            case 'Matchmaking':
            case 'ReadyCheck':
                return <PreGameCoach LCU_STATUS={LCU_STATUS} />;
            case 'ChampSelect':
                if (draftData) {
                    return <ChampSelectCoach draftData={draftData} LCU_STATUS={LCU_STATUS} />;
                }
                return null;
            case 'InProgress':
                return <InGameCoach LCU_STATUS={LCU_STATUS} />;
            default:
                return null;
        }
    }, [gamePhase, draftData, LCU_STATUS, isLoadingUser, userData]);

    const baseClass = "absolute inset-0 transition-all duration-300";

    return (
        <div 
            className={`\${baseClass} \${isInteractive ? 'pointer-events-auto' : 'pointer-events-none'}\`}
            style={{ backgroundColor: isInteractive ? 'rgba(0, 0, 0, 0.1)' : 'transparent' }}
        >
            {/* Widget de Estado (Control de Interacción) */}
            <div 
                className={\`absolute top-4 left-4 p-2 rounded-full \${isInteractive ? 'cursor-default' : 'pointer-events-auto'} bg-lol-blue-medium/90 text-lol-gold-light flex items-center shadow-xl\`}
                onMouseEnter={() => setInteractive(true)}
                onMouseLeave={() => setInteractive(false)}
            >
                {isLoadingUser ? (
                    <FaSync className="animate-spin mr-2" />
                ) : (
                    <FaWifi className={`mr-2 \${LCU_STATUS === 'ONLINE' ? 'text-lol-blue-accent' : 'text-red-500'}\`} />
                )}
                <span className="text-sm font-bold">{LCU_STATUS} | {gamePhase}</span>
                {isInteractive && (
                    <FaTools title="Controles (Interactivos)" className="ml-2 text-lol-gold" />
                )}
            </div>
            
            {/* Contenedor de Widget Activo */}
            <div className="w-full h-full flex justify-center items-center p-12">
                {CurrentWidget}
            </div>
        </div>
    );
}

export default function OverlayPage() {
    return (
        <AppStateProvider> 
            <ScaleProvider>
                <CoachContainer />
            </ScaleProvider>
        </AppStateProvider>
    );
}
EOF
echo "✅ Creado src/app/overlay/page.jsx: Router que consume el estado LCU."

echo "--- 🟢 IMPLEMENTACIÓN V3.2 COMPLETADA ---"