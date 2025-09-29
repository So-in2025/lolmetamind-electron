// src/hooks/useLcuData.js
"use client"
import { useState, useEffect } from 'react';

export function useLcuData() {
    const [lcuData, setLcuData] = useState(null);

    useEffect(() => {
        if (window.electronAPI && typeof window.electronAPI.on === 'function') {
            const unsubscribe = window.electronAPI.on('riot-profile-data', (data) => {
                console.log('[Frontend Hook] Datos LCU/Riot recibidos:', data);
                setLcuData(data);
            });
            return () => {
                unsubscribe();
            };
        }
    }, []);

    return lcuData;
}