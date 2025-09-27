
"use client"
import React from 'react';
import { useAppState } from '../context/AppStateContext';
import LoginScreen from '../components/LoginScreen';
// 🚨 CORRECCIÓN CRÍTICA: Quitamos el import de AllFlowComponents
import LoginScreen from '../components/LoginScreen'; 
import OnboardingForm from '../components/OnboardingForm';
// 🚨 CORRECCIÓN CRÍTICA DE RUTA: Ruta correcta al componente
import Dashboard from '../dashboard/page'; 
import Dashboard from './dashboard/page'; 
import LoadingScreen from '../components/LoadingScreen'; 

// Componente simple de carga (para asegurar que siempre esté disponible)
function LoadingScreen() {
    return (
        <div className="flex items-center justify-center h-screen bg-[#091018] text-[#C5B58E]">
            Cargando estado de la aplicación...
        </div>
    );
}

export default function Home() {
    const { flowState, AppFlowState } = useAppState();

    switch (flowState) {
        case AppFlowState.LOADING:
        case AppFlowState.SPLASH: 
            return <LoadingScreen />;

        case AppFlowState.LOGIN:
            // 1. Mostrar la pantalla de Login (para Google Auth)
            return <LoginScreen />;


        case AppFlowState.DASHBOARD:
            // 3. Mostrar el Dashboard (el corazón de la aplicación)
            return <Dashboard />; 
            return <Dashboard />;

        default:
            return <LoadingScreen />;
    }
}