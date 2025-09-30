// src/app/page.jsx - Versión FINAL sin lógica de enrutamiento de React.
"use client"
import React from 'react';
import { useAppState, AppFlowState } from '../context/AppStateContext'; 
// ELIMINADO: import { useRouter } from 'next/navigation'; // Ya no es necesario
import LoginScreen from '../components/LoginScreen'; 
import DashboardLayout from './dashboard/layout'; 
import DashboardPage from './dashboard/page'; 
// NOTA: Eliminamos la importación de LoadingScreen.jsx

export default function AppPage() {
    // Si esta página carga, asumimos que fue cargada por Electron.
    const { flowState, AppFlowState } = useAppState(); 
    
    // 1. Renderización basada en Estado
    switch (flowState) {
        
        case AppFlowState.LOGIN:
            // Esta ruta ("/") se carga en la loginWindow (Ventana pequeña).
            return <LoginScreen />; 

        case AppFlowState.DASHBOARD:
            // Si el estado es DASHBOARD, significa que Electron cargó la URL del dashboard aquí.
            // Aunque main.js debería cargar directamente la ruta /dashboard, 
            // mantenemos la estructura de renderizado para cuando Next.js hace la pre-renderización.
            return (
                <DashboardLayout>
                    <DashboardPage />
                </DashboardLayout>
            );
            
        default:
            // Si el estado inicial es cualquier otra cosa (como LOADING), mostramos el LOGIN.
            return <LoginScreen />;
    }
}