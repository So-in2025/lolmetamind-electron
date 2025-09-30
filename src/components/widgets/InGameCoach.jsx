// src/components/widgets/InGameCoach.jsx - VERSIÓN FINAL (TTS solo para IA)
"use client"
import React, { useEffect, useState } from 'react'; // <--- SINTAXIS CORREGIDA: 'from' en lugar de '=>'
import { useInteractiveWidget } from '@/hooks/useInteractiveWidget'; 

// Función TTS (copiada del OverlayPage para ser autónoma en el coach)
const speak = (text, priority = 'normal') => {
  try {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window && text) {
      if (priority === 'high') {
        window.speechSynthesis.cancel();
      }
      
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'es-ES';
      utterance.rate = 1.2;
      utterance.pitch = 1.1;
      
      window.speechSynthesis.speak(utterance);
      
    } else {
      console.warn("[TTS-Coach] ⚠️ API de SpeechSynthesis no disponible.");
    }
  } catch (e) {
    console.error(`[TTS-Coach] 🚨 Fallo al intentar hablar: ${e.message}`);
  }
};

export default function InGameCoach({ liveData, userData, isInteractive }) {
    // CRÍTICO: Asumiendo que window.electronAPI existe debido a preload.js
    const { ipcRenderer } = typeof window !== 'undefined' && window.electronAPI ? window.electronAPI : {};
    const [advice, setAdvice] = useState("Esperando impulso de IA (Presiona el botón para solicitar consejo)...");
    const [lastAdviceSpoken, setLastAdviceSpoken] = useState(null);
    
    // Función para solicitar consejo de IA
    const requestAIAdvice = async () => {
        if (!ipcRenderer || !liveData || !userData) {
            setAdvice("Error: Cliente de Electron o datos de usuario no disponibles.");
            return;
        }

        setAdvice("Analizando datos en tiempo real...");
        
        try {
            const payload = {
                liveData: liveData,
                userData: userData,
                gameflow: liveData.gameflow,
            };

            const result = await ipcRenderer.invoke('get-live-coaching', payload);
            
            if (result && result.error) {
                setAdvice(`Error de IA: ${result.error}`);
                return;
            }

            const newAdviceText = result?.advice || "No hay consejo estratégico por el momento.";
            
            setAdvice(newAdviceText);
            
            // Lógica de TTS: Habla SOLO si el consejo es nuevo
            if (newAdviceText !== lastAdviceSpoken && newAdviceText !== "No hay consejo estratégico por el momento.") {
                 console.log("[TTS-Coach] 🗣️ Coach AI hablando: ", newAdviceText);
                 speak(newAdviceText, 'high');
                 setLastAdviceSpoken(newAdviceText);
            }

        } catch (error) {
            console.error("Fallo al pedir consejo de IA:", error);
            setAdvice("Fallo de conexión con el backend de IA.");
        }
    };

    // Usaremos un useEffect para simular que el hotkey dispara esta función
    // Esto debería ser disparado por CTRL+F1 o un botón. Mantenemos el botón de prueba.

    return (
        <div className="p-4 bg-gray-900/90 border border-yellow-500 rounded-lg shadow-2xl relative">
            <h3 className="text-lg font-bold text-yellow-400 mb-2">COACH IA EN VIVO</h3>
            <p className="text-sm text-gray-200">{advice}</p>
            
            {/* Botón de prueba para disparar el TTS de la IA */}
            {isInteractive && (
                 <button 
                    onClick={requestAIAdvice}
                    className="mt-3 px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded transition-colors"
                 >
                    Pedir Consejo IA (TTS)
                 </button>
            )}
        </div>
    );
}
