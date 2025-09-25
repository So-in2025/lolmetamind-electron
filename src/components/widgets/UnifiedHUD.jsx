'use client';
import { useState, useEffect } from 'react';
import BuildsHUD from './BuildsHUD';
import StrategicHUD from './StrategicHUD';
import RealtimeCoachHUD from './RealtimeCoachHUD';
import ControlsHUD from './ControlsHUD';

export default function UnifiedHUD() {
  const [isEditMode, setIsEditMode] = useState(true);

  useEffect(() => {
    // Escuchamos el evento 'set-edit-mode' que envía main.js a través del preload
    const handleSetEditMode = (event, value) => {
      setIsEditMode(value);
    };

    // Usamos el API expuesto en el preload script
    window.electronAPI.onSetEditMode(handleSetEditMode);

    // Limpiamos el listener cuando el componente se desmonta
    return () => {
      window.electronAPI.removeAllListeners('set-edit-mode');
    };
  }, []);

  return (
    <>
      {/* El ControlsHUD solo se muestra si isEditMode es true */}
      {isEditMode && <ControlsHUD />}
      
      <BuildsHUD />
      <StrategicHUD />
      <RealtimeCoachHUD />
    </>
  );
}