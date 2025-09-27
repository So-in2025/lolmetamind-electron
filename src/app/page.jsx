"use client"
import React from 'react';
import { useAppState } from '../context/AppStateContext';
// 🚨 CORRECCIÓN CRÍTICA: Quitamos el import de AllFlowComponents
import LoginScreen from '../components/LoginScreen'; 
import OnboardingForm from '../components/OnboardingForm';
import Dashboard from './dashboard/page'; 
import LoadingScreen from '../components/LoadingScreen'; 

export default function Home() {
    const { flowState, AppFlowState } = useAppState();

    switch (flowState) {
        case AppFlowState.LOADING:
        case AppFlowState.SPLASH: 
            return <LoadingScreen />;
        
        case AppFlowState.LOGIN:
            return <LoginScreen />;
            
        case AppFlowState.ONBOARDING:
            return <OnboardingForm />;
            
        case AppFlowState.DASHBOARD:
            return <Dashboard />;

        default:
            return <LoadingScreen />;
    }
}
