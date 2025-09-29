// src/app/dashboard/page.jsx

// Asegúrate de usar 'use client' si este componente maneja estados o eventos del navegador/Electron
"use client"; 

import React from 'react';
import DashboardTabs from '@/components/DashboardTabs'; 

const DashboardPage = () => {
    return (
        // Contenedor principal: min-h-screen y flex-col.
        <div className="min-h-screen bg-lol-app-bg text-lol-text p-8 flex flex-col">
            
            {/* Header original con arrastre y borde */}
            <header className="mb-6 pt-2 pb-4 text-center -webkit-app-region-drag user-select-none border-b border-lol-gold/50"> 
                <h1 className="text-4xl font-black text-lol-gold uppercase tracking-widest text-shadow-lg">
                    Panel de Control MetaMind
                </h1>
                <p className="text-lol-light/70 mt-2">Bienvenido, Invocador.</p>
            </header>
            
            {/* Contenedor de pestañas */}
            <div className="flex-grow">
                 <DashboardTabs />
            </div>
            
        </div>
    );
};

export default DashboardPage;