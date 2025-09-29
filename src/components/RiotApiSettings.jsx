// src/components/RiotApiSettings.jsx
"use client";

import React, { useState, useEffect } from 'react';
import { KeyIcon, CheckCircleIcon, ExclamationTriangleIcon, ArrowPathIcon } from '@heroicons/react/24/solid';

const RiotApiSettings = () => {
    const [apiKey, setApiKey] = useState('');
    const [status, setStatus] = useState('initial'); // 'initial', 'success', 'error', 'loading'

    // Simula la obtención de la clave guardada al cargar
    useEffect(() => {
        // En un componente real, aquí se llamaría a window.ipcRenderer.send('get-stored-key')
    }, []);

    const handleSaveKey = (e) => {
        e.preventDefault();
        
        if (!apiKey || apiKey.length < 30) {
            setStatus('error');
            setTimeout(() => setStatus('initial'), 3000);
            return;
        }

        setStatus('loading');
        
        // Simulación de envío/reinicio de polling
        if (window.ipcRenderer) {
            // 🔑 Lógica real de guardado y reinicio del polling en main.js
            window.ipcRenderer.send('set-riot-api-key', apiKey);
            
            // Simulación de respuesta exitosa
            setTimeout(() => {
                setStatus('success');
                // No reseteamos a initial para que el usuario sepa que está activa
            }, 1000);
        } else {
            console.error("IPC Renderer not available. Cannot save key.");
            setStatus('error');
            setTimeout(() => setStatus('initial'), 3000);
        }
    };

    const getStatusIcon = () => {
        if (status === 'success') return <CheckCircleIcon className="w-5 h-5 text-green-400" />;
        if (status === 'error') return <ExclamationTriangleIcon className="w-5 h-5 text-red-400" />;
        if (status === 'loading') return <ArrowPathIcon className="w-5 h-5 text-[#FFD700] animate-spin" />;
        return <KeyIcon className="w-5 h-5 text-[#C89B3C]" />;
    };

    return (
        <div className="p-4 bg-[#1A2328] rounded-lg shadow-inner border border-[#C89B3C]/30">
            <h2 className="text-xl font-bold text-[#F0E6D2] mb-4 border-b border-[#C89B3C]/20 pb-2">
                Credenciales de Acceso (Riot API Key)
            </h2>
            <form onSubmit={handleSaveKey} className="space-y-6">
                <label className="block">
                    <span className="text-[#F0E6D2]/80 text-sm mb-2 block">Clave de Desarrollo (Caduca cada 24h)</span>
                    <div className="relative flex items-center">
                        <input
                            type="text"
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            placeholder="RGAPI-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                            className="w-full px-4 py-2 bg-black/40 border border-[#C89B3C]/60 text-[#F0E6D2] focus:outline-none focus:ring-2 focus:ring-[#FFD700] rounded transition duration-200 shadow-md"
                            // 🔑 Asegura la interactividad
                            onMouseDown={(e) => e.stopPropagation()} 
                        />
                    </div>
                </label>
                
                <div className="flex justify-between items-center">
                    <p className={`text-sm ${status === 'error' ? 'text-red-400' : status === 'success' ? 'text-green-400' : 'text-[#F0E6D2]/60'}`}>
                        {status === 'success' ? 'Clave activa. Polling reiniciado.' : status === 'error' ? '¡Error! Clave demasiado corta o inválida (403 probable).' : 'Recuerde regenerar la clave diariamente.'}
                    </p>
                    <button
                        type="submit"
                        className="hextech-button-gold text-sm transition duration-300 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={status === 'loading'}
                    >
                        {getStatusIcon()}
                        <span className="-webkit-app-region-no-drag">
                            {status === 'loading' ? 'Guardando...' : 'Guardar y Testear Conexión'}
                        </span>
                    </button>
                </div>
            </form>
        </div>
    );
};

export default RiotApiSettings;