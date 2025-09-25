'use client';
import { useState, useEffect } from 'react';
import { FaLock, FaUnlock } from 'react-icons/fa';
import { useScale } from '@/context/ScaleContext';
import { useInteractiveWidget } from '@/hooks/useInteractiveWidget';

// --- FUNCIÓN DE NARRACIÓN MEJORADA CON PRIORIDAD DE VOCES ---
const speak = (text) => {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    
    const getVoicesAndSpeak = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length === 0) {
        window.speechSynthesis.onvoiceschanged = getVoicesAndSpeak;
        return;
      }

      const preferredVoice = 
        voices.find(voice => voice.name.includes('Google') && voice.lang.startsWith('es-')) ||
        voices.find(voice => voice.name.includes('Helena') && voice.lang === 'es-ES') ||
        voices.find(voice => voice.name.includes('Microsoft') && voice.lang.startsWith('es-')) ||
        voices.find(voice => voice.lang.startsWith('es-'));

      if (preferredVoice) {
        utterance.voice = preferredVoice;
        utterance.lang = preferredVoice.lang;
      } else {
        utterance.lang = 'es-ES';
      }
      
      utterance.rate = 1.1;
      
      window.speechSynthesis.speak(utterance);
    };

    getVoicesAndSpeak();
    
  } else {
    console.log('La síntesis de voz no es soportada en este entorno.');
  }
};
// --- FIN DE LA FUNCIÓN MEJORADA ---


export default function RealtimeCoachHUD() {
  const [isDraggable, setIsDraggable] = useState(true);
  const { scale } = useScale();
  const { position, isLoaded, handleMouseDown } = useInteractiveWidget('widget-coach', { x: 0, y: 450 });

  const [eventMessage, setEventMessage] = useState('Esperando eventos del juego...');
  const [connectionStatus, setConnectionStatus] = useState('Conectando...');

  useEffect(() => {
    // --- NUEVA LÍNEA PARA REPRODUCIR EL MENSAJE INICIAL ---
    // Usamos un pequeño retraso para darle tiempo a las voces a cargar
    const initialMessageTimer = setTimeout(() => {
      speak('Sistema de voz iniciado. Esperando eventos del juego.');
    }, 500);
    // --- FIN DE LA NUEVA LÍNEA ---

    const handleStatusUpdate = (event, status) => {
      setConnectionStatus(status);
    };
    window.electronAPI.onWebsocketStatus(handleStatusUpdate);

    const handleNewEvent = (event, data) => {
      if (data && data.message) {
        setEventMessage(data.message);
        speak(data.message);
      }
    };
    window.electronAPI.onNewGameEvent(handleNewEvent);

    return () => {
      clearTimeout(initialMessageTimer); // Limpiamos el temporizador
      window.electronAPI.removeAllListeners('websocket-status');
      window.electronAPI.removeAllListeners('new-game-event');
      window.speechSynthesis.cancel();
    };
  }, []); // El array vacío asegura que esto se ejecute solo una vez

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
        <p className="font-bold text-lol-blue-accent text-lg">▶️ {eventMessage}</p>
        
        <p className="absolute bottom-1 right-2 text-xs text-lol-grey">
          {connectionStatus}
        </p>
      </div>
    </div>
  );
}