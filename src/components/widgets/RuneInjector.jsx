'use client';
import React, { useCallback, useState } from 'react';
import { FaBolt, FaCheckCircle, FaExclamationTriangle } from 'react-icons/fa';

/**
 * Módulo de Inyección de Runas al Cliente de League of Legends (PRODUCCIÓN).
 * Llama a la API IPC expuesta en preload.js, que delega la inyección
 * a tu LCU Core en el proceso principal.
 */
export default function RuneInjector({ runepageData }) {
    const [status, setStatus] = useState('READY'); // READY, INJECTING, SUCCESS, ERROR

    const CREATE_RUNE_ENDPOINT = '/lol-perks/v1/pages';

    const injectRunes = useCallback(async () => {
        if (status === 'INJECTING' || !window.electronAPI || !runepageData) return;

        const runePayload = {
            name: runepageData.name,
            current: true,
            primaryStyleId: runepageData.primaryStyleId,
            subStyleId: runepageData.subStyleId,
            selectedPerkIds: runepageData.selectedPerkIds
        };

        setStatus('INJECTING');

        try {
            // 🚨 Llama a tu sistema LCU CORE a través de IPC para ejecutar el POST/PUT
            const result = await window.electronAPI.lcuCommand('POST', CREATE_RUNE_ENDPOINT, runePayload);

            if (result.error) {
                throw new Error(result.error);
            }

            setStatus('SUCCESS');
            setTimeout(() => setStatus('READY'), 5000);
        } catch (error) {
            console.error("[INJECTOR] Error al inyectar runas:", error);
            setStatus('ERROR');
            setTimeout(() => setStatus('READY'), 8000);
        }
    }, [runepageData, status]);

    const buttonText = {
        READY: "INJECTAR EN CLIENTE (1 Clic)",
        INJECTING: "INYECTANDO...",
        SUCCESS: "¡RUNAS APLICADAS! ✅",
        ERROR: "FALLO EN INYECCIÓN ⚠️"
    }[status];

    const buttonColor = {
        READY: "bg-lol-blue-accent hover:bg-lol-blue-medium",
        INJECTING: "bg-lol-gold animate-pulse",
        SUCCESS: "bg-green-600 hover:bg-green-700",
        ERROR: "bg-red-700 hover:bg-red-800"
    }[status];

    return (
        <button
            onClick={injectRunes}
            className={`w-full py-2 font-bold rounded text-lol-blue-dark transition-colors ${buttonColor} ${status === 'INJECTING' ? 'cursor-not-allowed' : ''}`}
            disabled={status === 'INJECTING'}
        >
            {status === 'INJECTING' && <FaBolt className="inline-block mr-2 animate-ping" />}
            {status === 'SUCCESS' && <FaCheckCircle className="inline-block mr-2" />}
            {status === 'ERROR' && <FaExclamationTriangle className="inline-block mr-2" />}
            {buttonText}
        </button>
    );
}