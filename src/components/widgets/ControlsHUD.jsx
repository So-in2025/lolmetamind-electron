'use client';
import Draggable from 'react-draggable';
import { useScale } from '@/context/ScaleContext';
import { FaPlus, FaMinus } from 'react-icons/fa';
import { useState, useEffect, useRef } from 'react';

export default function ControlsHUD() {
  const { scale, increaseScale, decreaseScale } = useScale();
  const [defaultPosition, setDefaultPosition] = useState({ x: 10, y: 10 });
  const [isLoaded, setIsLoaded] = useState(false);
  const nodeRef = useRef(null);

  useEffect(() => {
    const savedPosition = localStorage.getItem('widget-controls');
    if (savedPosition) {
      setDefaultPosition(JSON.parse(savedPosition));
    }
    setIsLoaded(true);
  }, []);

  const handleStop = (e, data) => {
    localStorage.setItem('widget-controls', JSON.stringify({ x: data.x, y: data.y }));
  };
  
  if (!isLoaded) return null;

  return (
    <Draggable
      nodeRef={nodeRef}
      handle=".drag-handle"
      defaultPosition={defaultPosition}
      onStop={handleStop}
    >
      <div ref={nodeRef} className="absolute origin-top-left" style={{ transform: `scale(${scale})` }}>
        <div className="bg-lol-grey-dark/90 border border-lol-gold-dark rounded-md text-lol-gold-light shadow-lg backdrop-blur-sm flex items-center gap-2 p-1 cursor-move">
          <div className="drag-handle px-1">::</div>
          <button onClick={decreaseScale} className="bg-lol-grey-light hover:bg-lol-gold-dark p-2 rounded cursor-pointer">
            <FaMinus />
          </button>
          <span className="min-w-[4ch] text-center font-bold">{(scale * 100).toFixed(0)}%</span>
          <button onClick={increaseScale} className="bg-lol-grey-light hover:bg-lol-gold-dark p-2 rounded cursor-pointer">
            <FaPlus />
          </button>
        </div>
      </div>
    </Draggable>
  );
}