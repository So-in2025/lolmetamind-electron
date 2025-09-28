// src/components/RiotApiSettings.jsx

"use client"; 

import React, { useState } from 'react';
import { KeyIcon, CheckCircleIcon, ExclamationCircleIcon } from '@heroicons/react/24/solid';

const RiotApiSettings = () => {
  const [apiKey, setApiKey] = useState('');
  const [status, setStatus] = useState(null); // null, 'success', 'error'

  const handleSave = () => {
    const trimmedKey = apiKey.trim();

    if (trimmedKey.length < 30) {
      setStatus('error');
      return;
    }

    if (typeof window !== 'undefined' && window.electronAPI && window.electronAPI.send) {
      window.electronAPI.send('set-riot-api-key', trimmedKey);
      setStatus('success');
    } else {
      setStatus('error');
    }
  };

  const statusMessages = {
    success: "✅ Clave de Riot API guardada con éxito. El sistema de sondeo la usará en el próximo ciclo.",
    error: "❌ Error: Clave muy corta o IPC no disponible. Vuelve a intentarlo.",
  };

  const statusColor = status === 'success' ? 'border-lol-blue-light text-lol-blue-light' : 
                      status === 'error' ? 'border-red-500 text-red-400' : 'border-lol-gold text-lol-gold';

  return (
    <div className="bg-lol-gray/50 p-6 rounded-lg shadow-inner shadow-lol-blue/10 border border-lol-grey/20 w-full max-w-3xl mx-auto backdrop-blur-sm">
      <h3 className="text-2xl font-extrabold text-lol-gold mb-4 flex items-center border-b border-lol-gold/50 pb-2 uppercase tracking-wider">
        <KeyIcon className="w-7 h-7 mr-3 text-lol-gold" />
        Configuración de Clave RIOT
      </h3>

      <p className="text-lol-text mb-6 text-sm">
        Ingresa tu clave de la API de Riot Games para habilitar la búsqueda de datos de perfil y partidas.
      </p>

      <div className="flex flex-col sm:flex-row items-stretch sm:space-x-4 space-y-4 sm:space-y-0">
        <input
          type="text"
          value={apiKey}
          onChange={(e) => { 
              setApiKey(e.target.value); 
              setStatus(null);
          }}
          placeholder="RGAPI-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
          className="flex-grow p-4 bg-lol-input-bg text-lol-text border-2 border-lol-gray/50 rounded-md 
                     focus:border-lol-blue-light focus:ring-lol-blue-light transition duration-200 shadow-xl shadow-black/30 placeholder-lol-grey"
        />
        
        <button
          onClick={handleSave}
          className={`px-6 py-3 rounded-md font-bold uppercase text-lol-dark-blue whitespace-nowrap
                      bg-lol-gold hover:bg-lol-gold/90 transition duration-200 
                      shadow-lg shadow-black/50 border border-lol-gold`}
        >
          Guardar Clave
        </button>
      </div>

      {status && (
        <div className={`mt-5 p-4 rounded-md font-medium border-2 ${statusColor} bg-lol-gray/30 flex items-center`}>
          {status === 'success' ? <CheckCircleIcon className="w-6 h-6 mr-3" /> : <ExclamationCircleIcon className="w-6 h-6 mr-3" />}
          {statusMessages[status]}
        </div>
      )}
    </div>
  );
};

export default RiotApiSettings;