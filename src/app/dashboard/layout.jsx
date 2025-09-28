// src/app/dashboard/layout.jsx
"use client"
import React from 'react';
// 🚨 RUTA AJUSTADA para que el build la encuentre
import { useAppState, AppFlowState } from '../../context/AppStateContext'; 

export default function DashboardLayout({ children }) {
    const { flowState, AppFlowState } = useAppState();

    // FIREWALL: Si el estado NO es DASHBOARD, no se debe renderizar NADA.
    // Esto resuelve el mensaje de error prematuro "No autenticado..."
    if (flowState !== AppFlowState.DASHBOARD) {
        return null;
    }

    // A partir de aquí, el usuario está autenticado.
    return (
        <div className="flex h-screen bg-[#0A141A] text-[#F0E6D2]">
            <main className="flex-1 overflow-auto p-4">
                {children}
            </main>
        </div>
    );
}

// Opcional: Si tenías metadatos estáticos
// export const metadata = { title: 'Dashboard LolMetaMind', ... };