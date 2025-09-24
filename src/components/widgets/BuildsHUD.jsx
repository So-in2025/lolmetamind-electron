'use client';
import Draggable from 'react-draggable';
import { useState, useEffect } from 'react';
import { FaLock, FaUnlock } from 'react-icons/fa'; // Necesitarás react-icons

// Hook para guardar la posición en localStorage
const useDraggablePosition = (widgetId) => {
  const [position, setPosition] = useState({ x: 0, y: 0 });
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

export default function BuildsHUD() {
  const { position, handleStop, isLoaded } = useDraggablePosition('widget-builds');
  const [isDraggable, setIsDraggable] = useState(true);

  if (!isLoaded) return null; // No renderizar hasta que la posición se haya cargado

  return (
    <Draggable
      handle=".drag-handle"
      position={position}
      onStop={handleStop}
      disabled={!isDraggable}
    >
      <div className="cursor-pointer w-72 bg-lol-blue-dark/80 border-2 border-lol-gold rounded-md text-lol-gold-light shadow-lg backdrop-blur-sm">
        {/* Barra para arrastrar */}
        <div className="drag-handle bg-lol-blue-dark p-2 flex justify-between items-center cursor-move">
          <h3 className="font-bold text-shadow-md">Consejos de Build</h3>
          <button onClick={() => setIsDraggable(!isDraggable)} className="text-lol-gold hover:text-white">
            {isDraggable ? <FaUnlock /> : <FaLock />}
          </button>
        </div>
        {/* Contenido del widget */}
        <div className="p-4">
          <p>Aquí irán los consejos de objetos recomendados...</p>
          {/* Ejemplo de item */}
          <div className="mt-2">Item 1, Item 2, Item 3</div>
        </div>
      </div>
    </Draggable>
  );
}