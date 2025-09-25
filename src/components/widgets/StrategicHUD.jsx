'use client';
import { useState, useEffect } from 'react';
import { FaLock, FaUnlock } from 'react-icons/fa';
import { useScale } from '@/context/ScaleContext';
import { useInteractiveWidget } from '@/hooks/useInteractiveWidget';

export default function StrategicHUD() {
  const [isDraggable, setIsDraggable] = useState(true);
  const { scale } = useScale();
  const { position, isLoaded, handleMouseDown } = useInteractiveWidget('widget-strategy', { x: 0, y: 250 });

  // Nuevo estado para el mensaje del consejo de estrategia
  const [strategyAdvice, setStrategyAdvice] = useState('Esperando análisis estratégico...');

  useEffect(() => {
    // Escuchamos los nuevos consejos de estrategia
    const handleNewAdvice = (event, data) => {
      // Asumimos que la respuesta del backend es algo como { advice: 'Es un buen momento para pushear bot.' }
      if (data && data.advice) {
        setStrategyAdvice(data.advice);
      }
    };
    window.electronAPI.onNewStrategyAdvice(handleNewAdvice);

    return () => {
      window.electronAPI.removeAllListeners('new-strategy-advice');
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
        <h3 className="font-bold text-shadow-md">Consejos Estratégicos</h3>
        <button onClick={() => setIsDraggable(!isDraggable)} className="text-lol-gold hover:text-white cursor-pointer">
          {isDraggable ? <FaUnlock /> : <FaLock />}
        </button>
      </div>
      <div className="p-4">
        <p className="italic">"{strategyAdvice}"</p>
      </div>
    </div>
  );
}