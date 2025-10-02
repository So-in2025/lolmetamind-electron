'use client';
import React from 'react';
import dynamic from 'next/dynamic'; // Importa 'dynamic' de next/dynamic
import { AppStateProvider, useAppState } from '@/context/AppStateContext';
import DashboardTabs from '@/components/DashboardTabs';

// Carga LoginScreen de forma dinámica y deshabilita el pre-renderizado en el servidor
const LoginScreen = dynamic(() => import('@/components/LoginScreen'), {
    ssr: false,
    // Opcional: puedes mostrar un componente de carga mientras se carga LoginScreen
    loading: () => <p>Cargando...</p>,
});

function MainContent() {
    const { isAuthenticated } = useAppState();

    if (!isAuthenticated) {
        return <LoginScreen />;
    }

    return <DashboardTabs />;
}

export default function HomePage() {
    return (
        <AppStateProvider>
            <MainContent />
        </AppStateProvider>
    );
}