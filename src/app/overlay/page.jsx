// src/app/overlay/page.jsx
"use client"
import React from 'react';
import { useAppState } from '../../context/AppStateContext'; 
import { useInteractiveWidget } from '../../hooks/useInteractiveWidget'; 
import BuildsHUD from '../../components/widgets/BuildsHUD';
import ControlsHUD from '../../components/widgets/ControlsHUD';
import RealtimeCoachHUD from '../../components/widgets/RealtimeCoachHUD';
import StrategicHUD from '../../components/widgets/StrategicHUD';
import UnifiedHUD from '../../components/widgets/UnifiedHUD';


export default function OverlayPage() {
    // Si necesitas el estado global en este overlay, lo usas aquí:
    const { flowState, AppFlowState } = useAppState();
    
    // Obtener el estado de interactividad del widget
    // Este hook se actualiza cuando Alt+O es presionado en main.js
    const { isWidgetInteractive } = useInteractiveWidget();
    
    // La clase 'pointer-events-auto' permite clics/interacción cuando Alt+O está activo.
    // 'pointer-events-none' permite que los clics pasen al juego cuando el overlay está visible pero inactivo.
    const containerClasses = `h-screen w-screen bg-transparent ${isWidgetInteractive ? 'pointer-events-auto' : 'pointer-events-none'}`;
    
    return (
        <div className={containerClasses}>
            {/* UnifiedHUD actuará como el contenedor de todos los widgets del coach en tiempo real */}
            <UnifiedHUD /> 
        </div>
    );
}