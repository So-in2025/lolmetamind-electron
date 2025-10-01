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
