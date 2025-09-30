// src/hooks/useLcuData.js - VERSIÓN CON LOGS MEJORADOS
"use client"
import { useState, useEffect } from 'react';

export function useLcuData() {
    const [lcuData, setLcuData] = useState(null);

    useEffect(() => {
        if (window.electronAPI && typeof window.electronAPI.on === 'function') {
            console.log("[useLcuData] Suscribiéndose al canal IPC 'riot-profile-data'.");
            
            const handleDataUpdate = (data) => {
                console.log("[useLcuData] ✅ Datos nuevos recibidos desde el proceso principal de Electron:", data);
                setLcuData(data);
            };
            
            const unsubscribe = window.electronAPI.on('riot-profile-data', handleDataUpdate);
            
            // Limpieza: se desuscribe del evento cuando el componente se desmonta
            return () => {
                console.log("[useLcuData] Desuscribiéndose del canal IPC 'riot-profile-data'.");
                unsubscribe();
            };
        } else {
            console.warn("[useLcuData] La API de Electron no está disponible. El hook no recibirá datos.");
        }
    }, []); // El array vacío asegura que esto se ejecute solo una vez

    return lcuData;
}