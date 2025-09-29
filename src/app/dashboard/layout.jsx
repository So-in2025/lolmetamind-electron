// src/app/dashboard/layout.jsx
"use client"
import React from 'react';
import { useAppState, AppFlowState } from '../../context/AppStateContext'; 
import WindowControls from '@/components/WindowControls'; 

export default function DashboardLayout({ children }) {
    const { flowState } = useAppState();

    if (flowState !== AppFlowState.DASHBOARD) {
        return null;
    }

    return (
        // 🔑 NOTA: Ya no necesitamos window-draggable aquí si el CSS global es correcto
        // El fondo opaco AHORA está aquí para que la ventana transparente no muestre el escritorio
        <div className="flex flex-col w-full h-full bg-[#0A141A] text-[#F0E6D2] min-w-[1280px] min-h-[720px] overflow-hidden">
            
            {/* Controles de Ventana (Minimizar, Cerrar) - DEBEN SER -webkit-app-region: no-drag */}
            <WindowControls />

            {/* El contenido principal del dashboard */}
            <main className="flex-1 w-full h-full"> 
                {children}
            </main>
        </div>
    );
}