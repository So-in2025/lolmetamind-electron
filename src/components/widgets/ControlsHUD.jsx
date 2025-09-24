'use client';
import Draggable from 'react-draggable';
import { useScale } from '@/context/ScaleContext';
import { FaPlus, FaMinus } from 'react-icons/fa';
import { useState, useEffect } from 'react'; // <-- ¡LA LÍNEA QUE FALTABA!

// Hook para guardar la posición en localStorage
const useDraggablePosition = (widgetId) => {
  const [position, setPosition] = useState({ x: 10, y: 10 });
  useEffect(() => {
    const savedPosition = localStorage.getItem(widgetId);
    if (savedPosition) setPosition(JSON.parse(savedPosition));
  }, [widgetId]);
  const handleStop = (e, data) => localStorage.setItem(widgetId, JSON.stringify({ x: data.x, y: data.y }));
  return { position, handleStop };
};

export default function ControlsHUD() {
  const { scale, increaseScale, decreaseScale } = useScale();
  const { position, handleStop } = useDraggablePosition('widget-controls');

  return (
    <Draggable handle=".drag-handle" defaultPosition={position} onStop={handleStop}>
      <div className="absolute bg-lol-grey-dark/90 border border-lol-gold-dark rounded-md text-lol-gold-light shadow-lg backdrop-blur-sm flex items-center gap-2 p-1">
        <div className="drag-handle cursor-move px-1">::</div>
        <button onClick={decreaseScale} className="bg-lol-grey-light hover:bg-lol-gold-dark p-2 rounded">
          <FaMinus />
        </button>
        <span className="min-w-[4ch] text-center font-bold">{(scale * 100).toFixed(0)}%</span>
        <button onClick={increaseScale} className="bg-lol-grey-light hover:bg-lol-gold-dark p-2 rounded">
          <FaPlus />
        </button>
      </div>
    </Draggable>
  );
}