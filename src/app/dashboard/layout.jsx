// src/app/dashboard/layout.jsx
"use client"
import React from 'react';
import WindowControls from '@/components/WindowControls'; 

export default function DashboardLayout({ children }) {
    return (
        // CONTENEDOR RAÍZ:
        // - `flex flex-col`: Organiza los elementos en una columna (header, main).
        // - `h-screen w-screen`: Ocupa toda la altura y anchura de la ventana.
        // - `bg-[#0A141A]`: Fondo oscuro principal.
        // - `text-[#F0E6D2]`: Color de texto por defecto (crema).
        // - `overflow-hidden`: Previene barras de scroll indeseadas.
        <div className="flex flex-col h-screen w-screen bg-[#0A141A] text-[#F0E6D2] overflow-hidden">
            
            {/* CONTROLES DE VENTANA: Se quedan fijos en la esquina superior derecha. */}
            <WindowControls />

            {/* CONTENIDO PRINCIPAL: 
                - `flex-1`: Hace que este contenedor ocupe todo el espacio vertical restante.
                - `overflow-y-auto`: Permite el scroll vertical SOLO si el contenido es más alto que la ventana.
            */}
            <main className="flex-1 overflow-y-auto">
                {children}
            </main>
        </div>
    );
}