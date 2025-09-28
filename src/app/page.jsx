"use client"
import React from 'react';
import { useAppState } from '../context/AppStateContext';

// Importaciones corregidas y limpias
import LoginScreen from '../components/LoginScreen';
import LoadingScreen from '../components/LoadingScreen';
import Dashboard from './dashboard/page'; 

const ErrorScreen = () => (
    <div className="flex items-center justify-center h-screen bg-red-900 text-white">
        ERROR CRÍTICO EN LA APLICACIÓN
    </div>
);


export default function Home() {
    const { flowState, AppFlowState } = useAppState();

    switch (flowState) {
        case AppFlowState.LOADING:
            return <LoadingScreen />;

        case AppFlowState.LOGIN:
            return <LoginScreen />;

        case AppFlowState.DASHBOARD:
            return <Dashboard />; 
            
        default:
            return <ErrorScreen />;
    }
}