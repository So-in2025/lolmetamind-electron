// src/components/widgets/ControlsHUD.jsx - VERSIÓN DE PRUEBA
'use client';

import React from 'react';

// SIN DEPENDENCIAS DE HOOKS O ÍCONOS

export default function ControlsHUD() {
  
  const handleTestClick = () => {
    alert("¡El clic en el Overlay funciona!");
  };

  return (
    <div
      className="absolute"
      style={{
        top: `10px`,
        left: `10px`,
        // Damos un fondo visible para confirmar que se está renderizando
        backgroundColor: 'rgba(255, 0, 0, 0.7)', 
        padding: '10px',
        color: 'white',
        border: '2px solid white',
        zIndex: 9999, // Asegurar que esté por encima de todo
      }}
    >
      <div 
        className="flex items-center gap-2 p-1 cursor-move"
        // Quitamos el onMouseDown para simplificar la prueba
      >
        <p>OVERLAY ACTIVO</p>
        <button onClick={handleTestClick} style={{ border: '1px solid white', padding: '5px' }}>
          Test Clic
        </button>
      </div>
    </div>
  );
}