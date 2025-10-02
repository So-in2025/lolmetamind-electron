// src/components/widgets/ChampSelectCoach.jsx - VERSIÓN CORREGIDA
import React, { useEffect, useMemo, useState } from 'react';
import { useWebSocketCoach } from '@/hooks/useWebSocketCoach';
import { useTTS } from '@/hooks/useTTS';
import { useInteractiveWidget } from '@/hooks/useInteractiveWidget';
import RuneInjector from './RuneInjector';
import { FaMicrophoneAlt, FaSync, FaRedo, FaHandPointer, FaStar, FaCircle } from 'react-icons/fa';
// 🚨 'useAppState' ya no es necesario aquí.
// import { useAppState } from '@/context/AppStateContext';

const RunePerk = ({ perkId, isPrimary }) => {
    const iconClass = isPrimary ? 'text-lol-gold' : 'text-lol-blue-accent';
    const Icon = isPrimary ? FaStar : FaCircle;
    return (
        <div className={`w-6 h-6 rounded-full ${iconClass} flex items-center justify-center border border-lol-gold-dark`} title={`Rune ID: ${perkId}`}>
            <Icon size={12} />
        </div>
    );
};

// 🚨 1. ACEPTAMOS 'userData' COMO PROP
export default function ChampSelectCoach({ draftData, LCU_STATUS, userData }) {
    console.log('[ChampSelectCoach] --- RENDERIZANDO ---');
    console.log('[ChampSelectCoach] Props recibidas -> LCU_STATUS:', LCU_STATUS);
    console.log('[ChampSelectCoach] Props recibidas -> draftData:', draftData);
    console.log('[ChampSelectCoach] Props recibidas -> userData:', userData);

    // 🚨 2. ELIMINAMOS LA LLAMADA A 'useAppState'
    // const { userData } = useAppState();
    
    // El hook 'useWebSocketCoach' ahora recibe el 'userData' de las props.
    const { aiAdvice, wsStatus, sendChampSelectUpdate } = useWebSocketCoach({
        userData,
        targetEvent: 'CHAMP_SELECT_ADVICE'
    });
    const { speak } = useTTS();
    const { isInteractive, setInteractive } = useInteractiveWidget(false);
    const [lastDraftData, setLastDraftData] = useState(null);
    const [lastSpokenAdvice, setLastSpokenAdvice] = useState(null); // Para no repetir el TTS

    // CRÍTICO: Enviar actualización de Draft cuando cambian los picks/bans
    useEffect(() => {
        console.log('[ChampSelectCoach] useEffect [draftData] -> Verificando si el draft cambió.');
        const draftStateChanged = JSON.stringify(draftData) !== JSON.stringify(lastDraftData);
        
        // Solo enviar si hay datos, el estado cambió y el WS está conectado y tenemos usuario
        if (draftData && draftStateChanged && wsStatus === 'CONNECTED' && userData) {
            console.log('[ChampSelectCoach] ¡El draft cambió! Enviando actualización al WebSocket.');
            sendChampSelectUpdate(draftData);
            setLastDraftData(draftData);
        } else {
            // El draft no ha cambiado o faltan condiciones.
        }
    }, [draftData, lastDraftData, sendChampSelectUpdate, wsStatus, userData]);

    // Lógica para TTS cuando llega un nuevo consejo
    useEffect(() => {
        console.log('[ChampSelectCoach] useEffect [aiAdvice] -> Verificando si hay nuevo consejo de la IA.');
        const newAdviceText = aiAdvice?.champion; // Usamos el nombre del campeón como identificador único del consejo
        if (newAdviceText && newAdviceText !== lastSpokenAdvice) {
            const ttsText = `Recomendación para ${aiAdvice.champion}. Runas: ${aiAdvice.runes.name}. Prioridad: ${aiAdvice.earlyGame.split('.')[0]}.`;
            console.log('[ChampSelectCoach] Nuevo consejo recibido. Texto para hablar:', ttsText);
            speak(ttsText);
            setLastSpokenAdvice(newAdviceText); // Guardamos el identificador del consejo que acabamos de decir
        }
    }, [aiAdvice, speak, lastSpokenAdvice]);

    const handleReanalyze = () => {
        if (draftData) {
            console.log('[ChampSelectCoach] Botón "Forzar Re-Análisis" presionado. Enviando datos del draft...');
            sendChampSelectUpdate(draftData); // No necesitamos 'true', la función ya envía los datos
        } else {
            console.log('[ChampSelectCoach] Botón "Forzar Re-Análisis" presionado, pero no hay draftData.');
        }
    };

    return (
        <div
            className={`w-full max-w-lg p-4 bg-lol-blue-dark/95 rounded-xl shadow-2xl border-2 border-lol-gold-dark transition-all duration-300 font-sans ${isInteractive ? 'pointer-events-auto' : 'pointer-events-none'}`}
            onMouseEnter={() => setInteractive(true)}
            onMouseLeave={() => setInteractive(false)}
        >
            {/* Encabezado */}
            <div className="flex justify-between items-center mb-3">
                <h2 className="text-xl font-bold text-lol-gold font-cinzel">Asistente de Draft</h2>
                {isInteractive && (
                    <div className="flex items-center gap-3">
                        <FaMicrophoneAlt title="Activar/Desactivar TTS" className="cursor-pointer text-lol-gold-light hover:text-lol-accent" />
                        <FaRedo title="Forzar Re-Análisis" onClick={handleReanalyze} className="cursor-pointer text-lol-gold-light hover:text-lol-accent" />
                        <FaHandPointer title="Modo Interactivo" className="text-lol-accent" />
                    </div>
                )}
            </div>

            {/* Contenido Principal */}
            {aiAdvice ? (
                <div className="space-y-3">
                    <div className="text-center p-2 bg-lol-blue-medium rounded-t-lg">
                        <h3 className="text-lg font-bold text-lol-gold">Recomendación para: <span className="text-lol-blue-accent">{aiAdvice.champion}</span></h3>
                    </div>

                    {/* Botón para Inyectar Runas */}
                    {isInteractive && aiAdvice.runes && <RuneInjector runeData={aiAdvice.runes} />}

                    {/* Detalles de Runas */}
                    {aiAdvice.runes?.selectedPerkIds && (
                        <div className="p-3 bg-lol-blue-dark rounded border-l-4 border-lol-gold">
                            <h3 className="text-lol-gold font-bold mb-1">RUNAS CLAVE ({aiAdvice.runes.name})</h3>
                            <div className="flex space-x-2 mt-2">
                                {/* Aseguramos que el array exista antes de hacer slice */}
                                {(aiAdvice.runes.selectedPerkIds || []).slice(0, 4).map(id => <RunePerk key={id} perkId={id} isPrimary={id === aiAdvice.runes.primaryStyleId} />)}
                            </div>
                        </div>
                    )}

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
                    <p className="text-lol-gold-light">Analizando Draft... Esperando respuesta de la IA ({wsStatus}).</p>
                </div>
            )}
        </div>
    );
}