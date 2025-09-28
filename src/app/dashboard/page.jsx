// src/app/dashboard/page.jsx
"use client"
import React from 'react';
// Importa hooks o usa componentes que usan useAppState
// import { useAppState } from '../../context/AppStateContext'; 

export default function DashboardPage() {
    
    return (
        <div className="p-8">
            <h1 className="text-3xl font-bold title-glow">Dashboard Principal</h1>
            <p className="mt-4">Aquí va el contenido de coach en tiempo real.</p>
            {/* ... Tu código de widgets y funcionalidad ... */}
        </div>
    );
}