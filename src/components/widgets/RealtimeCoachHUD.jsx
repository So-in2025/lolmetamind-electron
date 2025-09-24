'use client';
import Draggable from 'react-draggable';
import { useState, useEffect } from 'react';
import { FaLock, FaUnlock } from 'react-icons/fa';
import { useScale } from '@/context/ScaleContext';

const useDraggablePosition = (widgetId) => {
  const [position, setPosition] = useState({ x: 100, y: 100 });
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const savedPosition = localStorage.getItem(widgetId);
    if (savedPosition) {
      setPosition(JSON.parse(savedPosition));
    }
    setIsLoaded(true);
  }, [widgetId]);

  const handleStop = (e, data) => {
    const newPosition = { x: data.x, y: data.y };
    setPosition(newPosition);
    localStorage.setItem(widgetId, JSON.stringify(newPosition));
  };

  return { position, handleStop, isLoaded };
};

export default function RealtimeCoachHUD() {
  const { position, handleStop, isLoaded } = useDraggablePosition('widget-coach');
  const [isDraggable, setIsDraggable] = useState(true);
  const { scale } = useScale();

  if (!isLoaded) return null;

  return (
    <Draggable
      handle=".drag-handle"
      position={position}
      onStop={handleStop}
      disabled={!isDraggable}
    >
      <div
        className="absolute w-72 origin-top-left bg-lol-blue-dark/10 border-2 border-lol-gold rounded-md text-lol-gold-light shadow-lg backdrop-blur-sm"
        style={{ transform: `scale(${scale})` }}
      >
        <div className="drag-handle bg-lol-blue-dark p-2 flex justify-between items-center cursor-move">
          <h3 className="font-bold text-shadow-md">Coach en Tiempo Real</h3>
          <button onClick={() => setIsDraggable(!isDraggable)} className="text-lol-gold hover:text-white">
            {isDraggable ? <FaUnlock /> : <FaLock />}
          </button>
        </div>
        <div className="p-4">
          <p>Aquí se mostrarán los eventos y alertas en tiempo real.</p>
          <div className="mt-2 font-bold text-lol-blue-accent">▶️ "Atención al Heraldo en 30s"</div>
        </div>
      </div>
    </Draggable>
  );
}