// src/components/RiotApiSettings.jsx
// Este componente permite al usuario introducir y guardar su clave de la API de Riot Games.
// Es crucial para que la aplicación pueda acceder a los datos de la API de Riot.

import React, { useState } from 'react';

const RiotApiSettings = () => {
    // Estado local para el valor del campo de entrada de la API Key
    const [apiKey, setApiKey] = useState('');
    // Estado para mostrar mensajes de éxito o error al usuario
    const [statusMessage, setStatusMessage] = useState('');
    // Estado para controlar el color del mensaje de estado
    const [statusColor, setStatusColor] = useState('text-lol-light');

    /**
     * Maneja el evento de guardar la clave API.
     * Valida la clave y la envía al proceso principal de Electron para su almacenamiento.
     */
    const handleSave = () => {
        // Validación básica de la clave API
        if (!apiKey.trim()) {
            setStatusMessage('La clave API no puede estar vacía.');
            setStatusColor('text-red-400');
            return;
        }
        if (!apiKey.startsWith('RGAPI-') && apiKey.length < 20) { // Ejemplo de validación mínima
            setStatusMessage('Formato de clave API inválido. Debe empezar con "RGAPI-" y ser lo suficientemente larga.');
            setStatusColor('text-red-400');
            return;
        }

        // Si la API de Electron está disponible, envía la clave.
        if (window.electronAPI?.setRiotApiKey) {
            window.electronAPI.setRiotApiKey(apiKey.trim()); // Envía la clave sin espacios extra
            setStatusMessage('¡Clave API de Riot guardada con éxito! El sistema de polling se ha reiniciado.');
            setStatusColor('text-green-400');
            setApiKey(''); // Limpia el campo después de guardar
            // Opcional: Oculta el mensaje de estado después de un tiempo
            setTimeout(() => setStatusMessage(''), 5000);
        } else {
            setStatusMessage('Error: No se pudo conectar con el sistema de Electron para guardar la clave.');
            setStatusColor('text-red-400');
        }
    };

    return (
        <div className="text-lol-light h-full">
            <p className="mb-6 text-lol-light/80 text-lg">
                Introduce tu clave de desarrollo de la API de Riot Games para que MetaMind pueda acceder a tu historial de partidas y otros datos de juego en tiempo real.
            </p>
            <p className="mb-4 text-sm text-gray-500 italic">
                (Puedes obtener una clave de desarrollo temporal en el portal de desarrollo de Riot Games.)
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 mb-4">
                {/* Campo de entrada para la clave API */}
                <input
                    type="password" // Tipo password para ocultar la clave
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="RGAPI-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    className="flex-grow p-3 bg-lol-input-bg text-white border border-lol-accent-gold/40 
                               rounded-md focus:border-lol-highlight outline-none text-base 
                               transition-all duration-200"
                />
                {/* Botón para guardar la clave */}
                <button
                    onClick={handleSave}
                    className="bg-lol-gold text-white font-bold py-3 px-6 rounded-md 
                               hover:bg-lol-gold/80 transition-colors duration-200 text-lg 
                               flex-shrink-0" // Asegura que el botón no se encoja
                >
                    Guardar Clave
                </button>
            </div>
            
            {/* Mensaje de estado (éxito/error) */}
            {statusMessage && (
                <p className={`text-sm mt-2 ${statusColor}`}>
                    {statusMessage}
                </p>
            )}

            <div className="mt-8 p-4 bg-black/20 rounded-lg text-sm text-gray-400 border border-lol-gold/10">
                <p className="font-semibold text-lol-light-blue mb-2">¿Por qué necesito una clave API?</p>
                <p>La API de Riot Games requiere una clave para autenticar las solicitudes de datos. Sin ella, MetaMind no podrá acceder a información detallada como tu historial de partidas, estadísticas de campeón o tu progreso en las ligas.</p>
                <p className="mt-2">Tu clave se almacena de forma segura solo en tu equipo local y se utiliza para todas las comunicaciones con la API de Riot.</p>
            </div>
        </div>
    );
};

export default RiotApiSettings;