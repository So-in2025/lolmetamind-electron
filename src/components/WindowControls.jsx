// src/components/WindowControls.jsx
"use client";

import React from 'react';
import { MinusIcon, XMarkIcon } from '@heroicons/react/24/outline'; // Asegúrate de tener Heroicons instalados (npm install @heroicons/react)

const WindowControls = () => {
  const handleMinimize = () => {
    window.ipcRenderer.send('minimizeWindow');
  };

  const handleClose = () => {
    window.ipcRenderer.send('closeWindow');
  };

  return (
    <div className="absolute top-0 right-0 flex z-50 -webkit-app-region-no-drag">
      <button 
        onClick={handleMinimize} 
        className="px-4 py-2 hover:bg-[#C89B3C]/30 transition-colors duration-200 -webkit-app-region-no-drag"
        aria-label="Minimizar"
      >
        <MinusIcon className="h-5 w-5 text-[#F0E6D2]" />
      </button>
      <button 
        onClick={handleClose} 
        className="px-4 py-2 hover:bg-red-700/50 transition-colors duration-200 -webkit-app-region-no-drag"
        aria-label="Cerrar"
      >
        <XMarkIcon className="h-5 w-5 text-[#F0E6D2]" />
      </button>
    </div>
  );
};

export default WindowControls;