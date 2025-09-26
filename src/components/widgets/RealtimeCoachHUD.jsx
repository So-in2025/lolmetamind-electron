'use client';
import { useState, useEffect } from 'react';
import { FaLock, FaUnlock } from 'react-icons/fa';
import { useScale } from '@/context/ScaleContext';
import { useInteractiveWidget } from '@/hooks/useInteractiveWidget';

// Función de narración (opcional, pero la mantenemos)
const speak = (text) => {
  if ('speechSynthesis' in window && text) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'es-ES';
    utterance.rate = 1.1;
    window.speechSynthesis.speak(utterance);
  }
};

export default function RealtimeCoachHUD() {
  const [isDraggable, setIsDraggable] = useState(true);
  const { scale } = useScale();
  const { position, isLoaded, handleMouseDown } = useInteractiveWidget('widget-coach', { x: 0, y: 500 });
  const [advice, setAdvice] = useState('Iniciando MetaMind...');
  
  useEffect(() => {
    const handleNewEvent = (eventData) => {
      if (eventData && eventData.message) {
        console.log("Nuevo evento de coach:", eventData.message);
        setAdvice(eventData.message);
        // Opcional: solo narra los consejos importantes, no cada estado
        // speak(eventData.message); 
      }
    };
    
    // --- CORRECCIÓN CLAVE: Escuchamos el nuevo canal 'new-coach-message' ---
    const handleNewCoachMessage = (message) => {
        console.log("Nuevo mensaje de estado/coach:", message);
        setAdvice(message);
    };

    if (window.electronAPI) {
        // Mantenemos el listener de eventos por si el backend los envía directamente
        window.electronAPI.on('new-game-event', handleNewEvent);
        // Añadimos el nuevo listener para los mensajes de estado desde main.js
        window.electronAPI.on('new-coach-message', handleNewCoachMessage);
    }
    // --- FIN DE LA CORRECCIÓN ---

    return () => {
      if (window.electronAPI && typeof window.electronAPI.removeAllListeners === 'function') {
          window.electronAPI.removeAllListeners('new-game-event');
          window.electronAPI.removeAllListeners('new-coach-message');
      }
      window.speechSynthesis.cancel();
    };
  }, []);

  if (!isLoaded) return null;

  return (
    <div
      className="absolute w-96 origin-top-left bg-lol-blue-dark/10 border-2 border-lol-gold rounded-md text-lol-gold-light shadow-lg backdrop-blur-sm"
      style={{
        top: `${position.y}px`,
        left: `${position.x}px`,
        transform: `scale(${scale})`,
        cursor: isDraggable ? 'move' : 'default',
      }}
    >
      <div
        className="bg-lol-blue-dark p-2 flex justify-between items-center"
        onMouseDown={isDraggable ? handleMouseDown : undefined}
      >
        <h3 className="font-bold text-shadow-md">Coach en Tiempo Real</h3>
        <button onClick={() => setIsDraggable(!isDraggable)} className="text-lol-gold hover:text-white cursor-pointer">
          {isDraggable ? <FaUnlock /> : <FaLock />}
        </button>
      </div>
      <div className="p-4 relative min-h-[5rem]">
        <p className="font-bold text-lol-blue-accent text-lg">▶ {advice}</p>
      </div>
    </div>
  );
}