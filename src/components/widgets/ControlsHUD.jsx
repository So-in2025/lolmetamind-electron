// src/components/widgets/ControlsHUD.jsx
'use client';

import { useScale } from '@/context/ScaleContext';
import { FaPlus, FaMinus } from 'react-icons/fa';
import { useInteractiveWidget } from '@/hooks/useInteractiveWidget';

export default function ControlsHUD() {
  const { scale, increaseScale, decreaseScale } = useScale();
  const { position, isLoaded, handleMouseDown } = useInteractiveWidget('widget-controls', { x: 10, y: 10 });

  if (!isLoaded) return null;

  return (
    <div
      className="absolute origin-top-left"
      style={{
        top: `${position.y}px`,
        left: `${position.x}px`,
        transform: `scale(${scale})`,
      }}
    >
      <div 
        onMouseDown={handleMouseDown}
        className="bg-lol-grey-dark/90 border border-lol-gold-dark rounded-md text-lol-gold-light shadow-lg backdrop-blur-sm flex items-center gap-2 p-1 cursor-move"
      >
        <div className="px-1">::</div>
        <button onClick={decreaseScale} className="bg-lol-grey-light hover:bg-lol-gold-dark p-2 rounded cursor-pointer">
          <FaMinus />
        </button>
        <span className="min-w-[4ch] text-center font-bold">{(scale * 100).toFixed(0)}%</span>
        <button onClick={increaseScale} className="bg-lol-grey-light hover:bg-lol-gold-dark p-2 rounded cursor-pointer">
          <FaPlus />
        </button>
      </div>
    </div>
  );
}