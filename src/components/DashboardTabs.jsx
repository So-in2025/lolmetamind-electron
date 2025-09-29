// src/components/DashboardTabs.jsx
"use client"; 

import React, { useState } from 'react';
import RiotProfileData from './RiotProfileData'; 
import WeeklyChallenges from './WeeklyChallenges'; 
import RiotApiSettings from './RiotApiSettings'; 

// Componente para el botón de pestaña con estilo LoL PREMIUM
const TabButton = ({ name, isActive, onClick }) => {
    const baseClasses = "py-3 px-8 text-sm font-extrabold uppercase transition-all duration-300 relative group z-10 -webkit-app-region-no-drag";
    const inactiveClasses = "text-lol-grey/70 hover:text-lol-gold hover:bg-lol-grey-dark"; 
    const activeClasses = "text-lol-gold-light bg-lol-input-bg border-t-2 border-lol-gold shadow-inner shadow-lol-grey-dark/50";
    
    const borderClasses = "absolute bottom-0 left-0 h-[3px] w-full bg-transparent transition-all duration-300";
    const activeBorderClasses = "bg-lol-gold shadow-[0_0_15px_rgba(200,155,60,0.8)]"; 
    
    return (
        <button
            onClick={onClick}
            className={`${baseClasses} ${isActive ? activeClasses : inactiveClasses} border-x border-lol-grey-dark/50`}
            style={{ zIndex: 1 }} 
        >
            {name}
            <span className={`${borderClasses} ${isActive ? activeBorderClasses : 'group-hover:bg-lol-gold/50'}`}></span>
        </button>
    );
};


const DashboardTabs = () => {
    const [activeTab, setActiveTab] = useState('profile');

    const renderContent = () => {
        const contentClasses = "h-full flex flex-col"; 

        switch (activeTab) {
            case 'profile':
                return (
                    // La división 2/1 de las columnas de datos
                    <div className={`${contentClasses} grid grid-cols-1 lg:grid-cols-3 gap-8`}>
                        <div className="lg:col-span-2 h-full">
                             <RiotProfileData />
                        </div>
                        <div className="lg:col-span-1 h-full">
                             <WeeklyChallenges />
                        </div>
                    </div>
                );
            case 'settings':
                return (
                    <div className={contentClasses}>
                        <RiotApiSettings />
                    </div>
                );
            default:
                return (
                    <div className={contentClasses}>
                         <RiotProfileData />
                    </div>
                );
        }
    };
    
    return (
        <div 
            className="border-[6px] border-lol-gold rounded-lg shadow-[0_0_50px_rgba(200,155,60,0.3)] p-0 flex flex-col h-full overflow-hidden"
            style={{ 
                background: 'radial-gradient(circle at center top, #10151B 0%, #091018 70%)' 
            }}
        >
            
            {/* Cabecera de Pestañas */}
            <div className="flex border-b-2 border-lol-gold/80 bg-lol-dark-blue/95 -webkit-app-region-drag overflow-hidden">
                <TabButton 
                    name="MI PERFIL & DATOS" 
                    isActive={activeTab === 'profile'} 
                    onClick={() => setActiveTab('profile')} 
                />
                <TabButton 
                    name="CONFIGURACIÓN API" 
                    isActive={activeTab === 'settings'} 
                    onClick={() => setActiveTab('settings')} 
                />
            </div>

            {/* Contenido de la Pestaña */}
            <div className="p-6 flex-grow overflow-y-auto no-scrollbar"> 
                 {renderContent()}
            </div>
            
        </div>
    );
};

export default DashboardTabs;