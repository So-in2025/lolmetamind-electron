// src/app/dashboard/page.jsx

// Asegúrate de usar 'use client' si este componente maneja estados o eventos del navegador/Electron
"use client"; 

import React from 'react';
import RiotApiSettings from '@/components/RiotApiSettings'; 
import WeeklyChallenges from '@/components/WeeklyChallenges'; // Mantenido tu import original
import RiotProfileData from '@/components/RiotProfileData'; // 🚀 NUEVO: Import para visualización

const DashboardPage = () => {
    return (
        // Usar un fondo oscuro que coincida con la estética de LoL
        <div className="min-h-screen bg-lol-app-bg text-lol-text p-8">
            
            <header className="mb-10 text-center">
                <h1 className="text-4xl font-black text-lol-gold uppercase tracking-widest text-shadow-lg">
                    Panel de Control MetaMind
                </h1>
                <p className="text-lol-light/70 mt-2">Bienvenido, Invocador.</p>
            </header>
            
            <section className="mt-10 mb-10">
                {/* 🚀 1. INGRESO DE LA CLAVE API */}
                <RiotApiSettings />
            </section>
            
            <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                <div className="lg:col-span-2">
                    {/* 🔑 NUEVA SECCIÓN DE DATOS: Muestra Ligas y Maestrías */}
                    <RiotProfileData />
                </div>
                
                <div className="lg:col-span-1">
                    <WeeklyChallenges /> 
                </div>
            </section>
        </div>
    );
};

export default DashboardPage;