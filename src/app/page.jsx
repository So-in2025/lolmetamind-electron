// src/app/page.jsx
"use client"
import React, { useEffect } from 'react';
import { useAppState, AppFlowState } from '../context/AppStateContext'; 
import LoginScreen from '../components/LoginScreen'; 
import DashboardLayout from './dashboard/layout'; 
import DashboardPage from './dashboard/page'; 
import LoadingScreen from '../components/LoadingScreen';

export default function AppPage() {
    // 🚨 LOG: Se ejecuta en cada renderizado
    console.log(`[RENDERER] AppPage render. Estado actual: ${useAppState().flowState}`); 
    
    const { flowState, userData } = useAppState();

    // Lógica IPC para iniciar el polling en Electron.
    useEffect(() => {
        console.log(`[RENDERER] useEffect disparado. flowState: ${flowState}`);
        
        if (flowState === AppFlowState.DASHBOARD) {
            console.log("[RENDERER] Transición a DASHBOARD detectada. Preparando IPC.");
            
            // 🚨 CLAVE: Aumentamos el tiempo a 500ms para asegurar que el 'send' funcione.
            const timer = setTimeout(() => { 
                 const electronAPIAvailable = window.electronAPI && typeof window.electronAPI.send === 'function';
                 
                 // 🚨 LOG: Muestra si el bridge IPC está listo.
                 console.log(`[RENDERER] Chequeo de 500ms: window.electronAPI.send es ${electronAPIAvailable ? '¡DISPONIBLE!' : 'UNDEFINED o NO ES FUNCIÓN.'}`);
                 
                 if (electronAPIAvailable) {
                    console.log("[RENDERER] ENVIANDO IPC 'user-logged-in'...");
                    window.electronAPI.send('user-logged-in', { 
                        username: userData?.username || 'user-anon', 
                        token: 'SESSION_TOKEN' 
                    });
                 } else {
                    console.error("[RENDERER] FALLO CRÍTICO: No se pudo enviar el IPC.");
                 }
            }, 500); // <-- 500ms

            return () => clearTimeout(timer);
        }
    }, [flowState, userData]);


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