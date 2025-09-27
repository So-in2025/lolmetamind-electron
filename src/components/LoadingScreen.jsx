"use client"
import React, { useEffect, useState } from 'react';

export default function LoadingScreen() {
    const [showContent, setShowContent] = useState(false);
    
    // La animación del logo se muestra al instante
    useEffect(() => {
        setShowContent(true); 
    }, []);

    return (
        // 🚨 CAMBIO CRÍTICO: Eliminamos el fondo y la imagen para que la ventana de Electron sea transparente.
        <div 
            className="flex items-center justify-center h-screen w-screen transition-opacity duration-1000" 
            style={{ 
                // Eliminamos backgroundImage y backgroundColor para transparencia total en Electron
                backgroundColor: 'transparent', 
            }}
        >
            {/* 🚨 Splash Content: El logo y animación en una caja semi-flotante */}
            <div className={`flex flex-col items-center p-8 rounded-xl bg-[#0D1117] bg-opacity-95 transform transition-all duration-1000 ${
                showContent ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
            }`}
            style={{
                boxShadow: '0 0 50px rgba(197, 181, 142, 0.4), 0 0 20px rgba(0, 0, 0, 0.7)',
                border: '1px solid #C5B58E' // Borde sutil de Hextech
            }}>
                
                {/* 🚨 LOGO: Ruta assets/icon2.png */}
                <img 
                    src="/assets/icon2.png" 
                    alt="Logo Meta Mind" 
                    className="w-24 h-24 mb-4 animate-pulse"
                    style={{filter: 'drop-shadow(0 0 15px #C5B58E)', animationDuration: '3s'}}
                />
                
                <h1 className="text-4xl font-bold text-white tracking-widest uppercase">
                    Meta Mind
                </h1>
                <p className="text-md text-[#C5B58E] mt-2">
                    Iniciando Módulos de IA Estratégica...
                </p>
            </div>
        </div>
    );
}
