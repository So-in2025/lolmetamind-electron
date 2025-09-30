// src/app/page.jsx - FINAL Y COMPACTO PARA VENTANAS SEPARADAS
"use client"
import React, { useEffect } from 'react';
import { useAppState, AppFlowState } from '../context/AppStateContext'; 
import { useRouter } from 'next/navigation'; 
import LoginScreen from '../components/LoginScreen'; 
import DashboardLayout from './dashboard/layout'; 
import DashboardPage from './dashboard/page'; 
// NOTA: Eliminamos la importación de LoadingScreen.jsx

export default function AppPage() {
    const { flowState, userData, setFlowState } = useAppState();
    const router = useRouter(); 
    
    // 1. Efecto de Enrutamiento
    useEffect(() => {
        // Lógica de Redirección: Se dispara cuando el estado interno cambia a DASHBOARD (después del login)
        if (flowState === AppFlowState.DASHBOARD) {
            // Si la URL es la raíz ("/"), redirigimos a la sub-ruta correcta.
            if (window.location.pathname !== '/dashboard') {
                 console.log("[AppPage] Redireccionando a /dashboard forzada por estado.");
                 router.push('/dashboard');
            }
        }
        
    }, [flowState, router, AppFlowState, setFlowState]);

    // 2. Renderización basada en Estado
    switch (flowState) {
        
        case AppFlowState.LOGIN:
            // Esta ruta ("/") se carga en la loginWindow y muestra el formulario.
            return <LoginScreen />; 

        case AppFlowState.DASHBOARD:
            // Esta ruta ("/dashboard") se carga en la mainWindow y muestra el panel.
            return (
                <DashboardLayout>
                    <DashboardPage />
                </DashboardLayout>
            );
            
        default:
            // Si es LOADING (estado inicial del contexto), mostramos el LOGIN inmediatamente.
            return <LoginScreen />;
    }
}