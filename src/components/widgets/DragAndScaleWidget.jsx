// src/components/widgets/DragAndScaleWidget.jsx - Wrapper Hextech Modular (FINAL CSS FIX)
"use client"
import React, { useEffect, useRef, useState } from 'react';
import Draggable from 'react-draggable';
import { useWidgetScale } from '@/context/ScaleContext';
import { ArrowsPointingOutIcon, LockClosedIcon, LockOpenIcon, MinusIcon, PlusIcon } from '@heroicons/react/24/outline';
import { useInteractiveWidget } from '@/hooks/useInteractiveWidget';

// Rango de escala permitido
const MIN_SCALE = 40;
const MAX_SCALE = 200;
const SCALE_STEP = 20;

const HextechButton = ({ children, onClick, className = '' }) => (
    <button
        onClick={onClick}
        className={`p-1.5 rounded-full backdrop-blur-sm bg-blue-900/50 hover:bg-blue-700/70 border border-blue-500/50 text-white shadow-lg transition duration-200 ${className}`}
        style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        aria-label="Control Button"
    >
        {children}
    </button>
);

export default function DragAndScaleWidget({ children, widgetId, defaultPosition = { x: 0, y: 0 } }) {
    const { widgetStates, loadWidgetState, saveWidgetState } = useWidgetScale();
    const { isWidgetInteractive } = useInteractiveWidget('global-overlay'); 
    const [initialStateLoaded, setInitialStateLoaded] = useState(false); 
    const widgetState = widgetStates[widgetId];
    
    // Cargar estado inicial
    useEffect(() => {
        const loadState = async () => {
            const state = await loadWidgetState(widgetId, 100, defaultPosition);
            if (state) setInitialStateLoaded(true);
        };
        loadState();
    }, [widgetId, loadWidgetState, defaultPosition]);

    const scaleWidget = (direction) => {
        if (!widgetState) return;

        let newScale = widgetState.scale + (direction === 'in' ? SCALE_STEP : -SCALE_STEP);
        newScale = Math.min(Math.max(newScale, MIN_SCALE), MAX_SCALE);
        
        if (newScale !== widgetState.scale) {
            saveWidgetState(widgetId, { scale: newScale });
        }
    };

    const toggleLock = () => {
        if (!widgetState) return;
        saveWidgetState(widgetId, { isLocked: !widgetState.isLocked });
    };

    const handleDragStop = (e, data) => {
        saveWidgetState(widgetId, { position: { x: data.x, y: data.y } });
    };

    if (!initialStateLoaded) {
        return null;
    }

    // Estilo de transformación para la escala
    const scaleStyle = {
        transform: `scale(${widgetState.scale / 100})`,
        transformOrigin: 'top left',
        transition: isWidgetInteractive ? 'none' : 'transform 0.1s ease-out',
        width: `calc(100% / (${widgetState.scale / 100}))`,
        height: `calc(100% / (${widgetState.scale / 100}))`,
        pointerEvents: isWidgetInteractive ? 'auto' : 'none',
    };
    
    const showControls = isWidgetInteractive;

    return (
        <Draggable 
            handle={showControls && !widgetState.isLocked ? ".drag-handle" : null}
            position={widgetState.position} 
            onStop={handleDragStop}
            disabled={widgetState.isLocked || !showControls}
            bounds="parent" 
        >
            {/* Contenedor Draggable Wrapper: Posicionamiento absoluto y Z-Index Alto */}
            <div 
                className="absolute min-w-64 min-h-20 bg-black/10" // Min size para evitar colapso
                style={{ zIndex: 9999 }} // Nivel Z Alto
            >
                
                {/* Contenedor que aplica la escala y el estilo Hextech */}
                <div style={scaleStyle} className="lol-metamind-widget relative w-full h-full">
                    
                    {/* Controles de la esquina superior izquierda (Fijos para el widget) */}
                    {showControls && (
                        <div className="absolute top-[-40px] left-0 flex space-x-2 p-1 bg-transparent z-[10001]">
                            {/* Botón de Bloqueo/Desbloqueo */}
                            <HextechButton onClick={toggleLock} className="drag-handle">
                                {widgetState.isLocked ? (
                                    <LockClosedIcon className="w-4 h-4 text-red-400" />
                                ) : (
                                    <LockOpenIcon className="w-4 h-4 text-green-400" />
                                )}
                            </HextechButton>
                            
                            {/* Botón de Arrastre (Solo visible si está desbloqueado) */}
                            {!widgetState.isLocked && (
                                <HextechButton className="drag-handle" title="Arrastrar Widget">
                                    <ArrowsPointingOutIcon className="w-4 h-4 text-yellow-400" />
                                </HextechButton>
                            )}
                            
                            {/* Controles de Escala (+ / -) */}
                            <HextechButton onClick={() => scaleWidget('out')} title="Reducir (40% - 200%)">
                                <MinusIcon className="w-4 h-4" />
                            </HextechButton>
                            <HextechButton onClick={() => scaleWidget('in')} title="Aumentar (40% - 200%)">
                                <PlusIcon className="w-4 h-4" />
                            </HextechButton>
                            
                            <span className="text-white ml-2 text-sm font-bold p-1 rounded backdrop-blur-sm bg-gray-900/50 border border-gray-500/50">
                                {widgetState.scale}%
                            </span>
                        </div>
                    )}
                    
                    {/* Contenido del Widget */}
                    <div className="w-full h-full pointer-events-auto">
                        {children}
                    </div>
                </div>
            </div>
        </Draggable>
    );
}
