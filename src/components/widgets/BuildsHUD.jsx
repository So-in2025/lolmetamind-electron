'use client';
import { useState, useEffect } from 'react';
import { FaLock, FaUnlock } from 'react-icons/fa';
import { useScale } from '@/context/ScaleContext';
import { useInteractiveWidget } from '@/hooks/useInteractiveWidget';

export default function BuildsHUD() {
  const [isDraggable, setIsDraggable] = useState(true);
  const { scale } = useScale();
  const { position, isLoaded, handleMouseDown } = useInteractiveWidget('widget-builds', { x: 0, y: 50 });
  
  const [buildAdvice, setBuildAdvice] = useState('Inicia una partida para recibir consejos.');

  useEffect(() => {
    const handleNewAdvice = (data) => {
      if (data && data.recommendedItem) {
        setBuildAdvice(`Próximo objeto recomendado: ${data.recommendedItem}`);
      }
    };
    
    // --- CORRECCIÓN CLAVE: Usar la sintaxis correcta del listener ---
    if (window.electronAPI) {
      window.electronAPI.on('new-build-advice', handleNewAdvice);
    }
    // --- FIN DE LA CORRECCIÓN ---

    return () => {
      if (window.electronAPI && typeof window.electronAPI.removeAllListeners === 'function') {
        window.electronAPI.removeAllListeners('new-build-advice');
      }
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
        <h3 className="font-bold text-shadow-md">Consejos de Build</h3>
        <button onClick={() => setIsDraggable(!isDraggable)} className="text-lol-gold hover:text-white cursor-pointer">
          {isDraggable ? <FaUnlock /> : <FaLock />}
        </button>
      </div>
      <div className="p-4">
        <p>{buildAdvice}</p>
      </div>
    </div>
  );
}