// src/components/widgets/DragAndScaleWidget.jsx - Wrapper Hextech Modular
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
    const { isWidgetInteractive } = useInteractiveWidget('global-overlay'); // Estado global CTRL+F1/F2
    const widgetState = widgetStates[widgetId];
    
    // Cargar estado inicial
    useEffect(() => {
        loadWidgetState(widgetId, 100, defaultPosition);
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

    if (!widgetState) {
        // Renderizar un fallback mientras se carga el estado
        return <div className="absolute top-0 left-0 p-2 text-blue-400">Cargando Widget...</div>;
    }

    // Estilo de transformación para la escala
    const scaleStyle = {
        // FIX CRÍTICO: Eliminados los backslashes innecesarios
        transform: `scale(${widgetState.scale / 100})`,
        transformOrigin: 'top left',
        transition: isWidgetInteractive ? 'none' : 'transform 0.1s ease-out', // Suavizar solo al jugar
        width: `calc(100% / (${widgetState.scale / 100}))`, // Corrección para que el contenedor mantenga el tamaño lógico
        height: `calc(100% / (${widgetState.scale / 100}))`,
        pointerEvents: isWidgetInteractive ? 'auto' : 'none', // Asegurar que el contenido también sea transparente al click
    };
    
    // El widget se convierte en el área de agarre
    const dragClassName = `relative w-full h-full p-2 rounded-lg transition-shadow duration-300 ${!widgetState.isLocked && isWidgetInteractive ? 'cursor-grab hover:shadow-[0_0_20px_rgba(30,144,255,0.5)]' : 'cursor-default'}`;
    
    // Mostrar controles solo en modo interactivo (CTRL+F1)
    const showControls = isWidgetInteractive;

    return (
        <Draggable 
            handle={showControls && !widgetState.isLocked ? ".drag-handle" : null}
            defaultPosition={defaultPosition}
            position={widgetState.position}
            onStop={handleDragStop}
            disabled={widgetState.isLocked || !showControls}
            bounds="parent" // Asegura que no se salga de la pantalla (overlayWindow)
        >
            <div 
                className={dragClassName} 
                style={scaleStyle}
            >
                {/* Controles de la esquina superior izquierda (Fijos para el widget) */}
                {showControls && (
                    <div className="absolute top-[-40px] left-0 flex space-x-2 p-1 bg-transparent z-50">
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
                            ${widgetState.scale}%
                        </span>
                    </div>
                )}
                
                {/* Contenido del Widget */}
                <div className="w-full h-full pointer-events-auto">
                    {children}
                </div>
            </div>
        </Draggable>
    );
}
