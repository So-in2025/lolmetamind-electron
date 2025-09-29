// src/app/dashboard/page.jsx

"use client"; 

import React from 'react';
import RiotApiSettings from '@/components/RiotApiSettings'; 
import WeeklyChallenges from '@/components/WeeklyChallenges'; 
import RiotProfileData from '@/components/RiotProfileData'; 

const DashboardPage = () => {
    return (
        <div className="w-full h-full p-4 flex flex-col"> {/* Añadimos flex-col para el layout */}
            
            {/* Cabecera con la clase para arrastrar la ventana */}
            <header className="mb-4 text-center py-2 bg-[#0A141A] window-draggable"> {/* Añadimos window-draggable y padding/background */}
                <h1 className="text-4xl font-black text-[#C89B3C] uppercase tracking-widest text-shadow-lg">
                    COUCH METAMIND | Panel de Análisis
                </h1>
                <p className="text-[#F0E6D2]/70 mt-2 -webkit-app-region: no-drag;"> {/* Aseguramos que el texto no arrastre */}
                    Análisis de Perfil y Preparación Estratégica.
                </p>
            </header>
            
            {/* Contenido principal, ocupa el espacio restante */}
            <div className="grid grid-cols-12 gap-6 flex-grow overflow-hidden"> {/* flex-grow para que ocupe el espacio restante */}
                
                {/* Columna Izquierda (4/12): Configuración y Utilidades */}
                <aside className="col-span-12 lg:col-span-4 space-y-6 overflow-y-auto pr-2"> {/* Agregamos pr-2 para scrollbar */}
                    
                    {/* 🔑 1. INGRESO DE LA CLAVE API */}
                    <div className="bg-[#1A2328] p-4 rounded-lg shadow-xl border border-[#C89B3C]/30 -webkit-app-region: no-drag;">
                        <h2 className="text-xl font-bold text-[#F0E6D2] mb-3">Configuración API</h2>
                        <RiotApiSettings />
                    </div>
                    
                    {/* 🔑 2. Weekly Challenges (Se mantiene el componente original) */}
                    <div className="bg-[#1A2328] p-4 rounded-lg shadow-xl border border-[#C89B3C]/30 -webkit-app-region: no-drag;">
                        <WeeklyChallenges /> 
                    </div>
                    
                </aside>
                
                {/* Columna Derecha (8/12): Dashboard Principal de Datos y AI */}
                <main className="col-span-12 lg:col-span-8 overflow-y-auto pr-2"> 
                    
                    {/* 🚀 3. Visor de Datos del Perfil y Diagnóstico */}
                    <RiotProfileData />
                    
                </main>
            </div>
        </div>
    );
};

export default DashboardPage;