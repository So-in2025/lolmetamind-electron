// src/app/dashboard/page.jsx

"use client"; 

import React, { useState } from 'react';
// Asegúrate de que estos componentes existan en src/components/
import RiotApiSettings from '@/components/RiotApiSettings'; 
import WeeklyChallenges from '@/components/WeeklyChallenges'; 
import RiotProfileData from '@/components/RiotProfileData'; 

// Importación de Iconos para las pestañas
import { Cog8ToothIcon, UserCircleIcon, ChartBarIcon, CpuChipIcon } from '@heroicons/react/24/solid';

const TABS = [
    { id: 'profile', name: 'Perfil & Diagnóstico', icon: UserCircleIcon, component: RiotProfileData },
    { id: 'analytics', name: 'Análisis Histórico', icon: ChartBarIcon, component: WeeklyChallenges }, // Usamos WeeklyChallenges como placeholder para Análisis
    { id: 'settings', name: 'Configuración & Status', icon: Cog8ToothIcon, component: RiotApiSettings },
    { id: 'ai', name: 'Módulo IA', icon: CpuChipIcon, component: WeeklyChallenges } // Placeholder para Módulo IA
];

const DashboardPage = () => {
    const [activeTab, setActiveTab] = useState(TABS[0].id);
    const ActiveComponent = TABS.find(tab => tab.id === activeTab).component;

    // Altura calculada: 100vh (720px) menos el espacio de cabecera y pestañas (aprox. 160px)
    const contentHeightClass = "h-[calc(100vh-160px)]"; 

    return (
        // El contenedor principal debe ser no-scroll y usar la altura completa
        <div className="w-full h-full flex flex-col p-0"> 
            
            {/* 1. CABECERA Y BARRA DE ARRASTRE */}
            <header className="mb-4 text-center py-2 bg-[#0A141A] window-draggable">
                <h1 className="text-4xl font-black text-[#C89B3C] uppercase tracking-widest text-shadow-lg user-select-none">
                    COUCH METAMIND | Panel de Análisis
                </h1>
                <p className="text-[#F0E6D2]/70 mt-2 -webkit-app-region-no-drag">Análisis de Perfil y Preparación Estratégica.</p>
            </header>

            {/* 2. SISTEMA DE PESTAÑAS (TABS) */}
            <nav className="flex space-x-0 border-b border-[#C89B3C]/50 mb-4 -webkit-app-region-no-drag">
                {TABS.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`
                            flex items-center justify-center space-x-2 px-6 py-2 text-sm font-bold uppercase flex-1 
                            transition-all duration-300 transform 
                            ${tab.id === activeTab
                                ? 'bg-[#C89B3C] text-[#1A2328] scale-105 shadow-lg border-t-2 border-l-2 border-r-2 border-[#FFD700]'
                                : 'text-[#C89B3C] bg-[#1A2328]/50 hover:bg-[#1A2328]'
                            }
                            /* Usamos clip-path para un corte hextech más pro (si está en globals.css) */
                            clip-path-hextech-tab
                        `}
                        style={{ borderBottom: tab.id !== activeTab ? '2px solid #5A472C' : 'none' }}
                    >
                        <tab.icon className="h-5 w-5" />
                        <span className="hidden sm:inline">{tab.name}</span>
                    </button>
                ))}
            </nav>

            {/* 3. CONTENIDO PRINCIPAL (SIN SCROLL) */}
            <main className={`p-0 flex-grow ${contentHeightClass} overflow-hidden no-scrollbar`}>
                <div className="w-full h-full p-6 bg-[#1A2328] rounded-lg shadow-inner overflow-y-auto no-scrollbar border border-[#C89B3C]/30">
                    <ActiveComponent />
                </div>
            </main>
        </div>
    );
};

export default DashboardPage;