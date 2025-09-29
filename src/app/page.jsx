// src/app/page.jsx
"use client"
import React, { useEffect } from 'react';
import { useAppState, AppFlowState } from '../context/AppStateContext'; 
import LoginScreen from '../components/LoginScreen'; 
import DashboardLayout from './dashboard/layout'; 
import DashboardPage from './dashboard/page'; 
import LoadingScreen from '../components/LoadingScreen';

export default function AppPage() {
    // 🚨 LOG: Se ejecuta en cada renderizado para monitorear el estado
    console.log(`[RENDERER] AppPage render. Estado actual: ${useAppState().flowState}`); 
    
    const { flowState, userData } = useAppState();

    // Lógica IPC para iniciar el polling en Electron.
    // Este useEffect es CRÍTICO: se dispara solo cuando el estado cambia a DASHBOARD.
    useEffect(() => {
        console.log(`[RENDERER] useEffect disparado. flowState: ${flowState}`);
        
        if (flowState === AppFlowState.DASHBOARD) {
            console.log("[RENDERER] Transición a DASHBOARD detectada. Preparando IPC.");
            
            // 🚨 CLAVE: El setTimeout asegura que el preload script de Electron haya tenido
            // tiempo de inyectar `window.electronAPI` antes de que intentemos usarlo.
            // Esto previene race conditions durante la carga inicial.
            const timer = setTimeout(() => { 
                 const electronAPIAvailable = window.electronAPI && typeof window.electronAPI.send === 'function';
                 
                 // 🚨 LOG: Muestra si el bridge IPC está listo.
                 console.log(`[RENDERER] Chequeo de 500ms: window.electronAPI.send es ${electronAPIAvailable ? '¡DISPONIBLE!' : 'UNDEFINED o NO ES FUNCIÓN.'}`);
                 
                 if (electronAPIAvailable) {
                    console.log("[RENDERER] ENVIANDO IPC 'user-logged-in'...");
                    // Envía los datos del usuario a main.js para iniciar el polling.
                    window.electronAPI.send('user-logged-in', { 
                        username: userData?.username || 'user-anon', 
                        token: userData?.token || 'SESSION_TOKEN' // Pasa el token real
                    });
                 } else {
                    console.error("[RENDERER] FALLO CRÍTICO: No se pudo enviar el IPC 'user-logged-in'.");
                 }
            }, 500); // <-- 500ms de espera

            // Función de limpieza para el useEffect
            return () => clearTimeout(timer);
        }
    }, [flowState, userData]); // Se ejecuta cuando flowState o userData cambian


    // Renderiza el componente adecuado según el estado actual de la aplicación
    switch (flowState) {
        case AppFlowState.LOADING:
            return <LoadingScreen />;

        case AppFlowState.LOGIN:
            return <LoginScreen />; 

        case AppFlowState.DASHBOARD:
            return (
                <DashboardLayout>
                    <DashboardPage />
                </DashboardLayout>
            );
            
        default:
            return <LoginScreen />;
    }
}
