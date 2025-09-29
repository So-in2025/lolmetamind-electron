// src/app/overlay/page.jsx
"use client"
import React from 'react';
// 🚨 CORRECCIÓN: Rutas de importación completas y correctas para los hooks de cliente.
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
    
    // Asumo que tu lógica de overlay usa el hook interactivo
    // const { isWidgetInteractive } = useInteractiveWidget();
    
    return (
        // El Overlay DEBE ser transparente y no interactivo por defecto
        <div className="h-screen w-screen bg-transparent pointer-events-none">
            {/* Los componentes reales del HUD deben ir aquí, envueltos por la lógica de visibilidad */}

            {/* Ejemplo de cómo llamarías a uno de tus HUDs: */}
            {/* <UnifiedHUD /> */} 
            
            {/* Puedes dejar este texto temporalmente para confirmar que el OverlayPage se carga: */}
            <h1 className="text-white text-xl p-4">Overlay Activo</h1>
        </div>
    );
}