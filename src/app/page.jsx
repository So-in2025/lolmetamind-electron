// Ruta: src/app/page.jsx
'use client';
import React from 'react';
import { useAppState } from '@/context/AppStateContext';

import AuthScreen from '@/components/AuthScreen'; 
import LoadingScreen from '@/components/LoadingScreen';
import DashboardLayout from './dashboard/layout'; 
import DashboardPage from './dashboard/page';     

export default function Home() {
  // Ahora usamos splashLoaded para la primera comprobación.
  const { isAuthenticated, loading, splashLoaded } = useAppState(); 

  // 1. Mostrar pantalla de carga inicial si el AppState no ha cargado O el Splash aún no termina
  if (loading || !splashLoaded) { 
    return <LoadingScreen message="Cargando aplicación..." />;
  }
  
  // 2. Si NO está autenticado, muestra la pantalla de Login/Registro
  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-lol-blue-dark">
        <AuthScreen /> 
      </div>
    );
  }

  // 3. Si está autenticado, muestra el Dashboard
  return (
    <DashboardLayout>
      <DashboardPage />
    </DashboardLayout>
  );
}