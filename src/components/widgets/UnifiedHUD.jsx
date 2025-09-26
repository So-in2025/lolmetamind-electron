'use client';
import { useState, useEffect } from 'react';
import BuildsHUD from './BuildsHUD';
import StrategicHUD from './StrategicHUD';
import RealtimeCoachHUD from './RealtimeCoachHUD';
import ControlsHUD from './ControlsHUD';

export default function UnifiedHUD() {
  const [isEditMode, setIsEditMode] = useState(true);

  useEffect(() => {
    const handleSetEditMode = (value) => {
      setIsEditMode(value);
    };

    // --- CORRECCIÓN CLAVE: Usar la sintaxis correcta del listener ---
    if (window.electronAPI) {
      window.electronAPI.on('set-edit-mode', handleSetEditMode);
    }
    // --- FIN DE LA CORRECCIÓN ---

    return () => {
      if (window.electronAPI && typeof window.electronAPI.removeAllListeners === 'function') {
        window.electronAPI.removeAllListeners('set-edit-mode');
      }
    };
  }, []);

  return (
    <>
      {isEditMode && <ControlsHUD />}
      
      <BuildsHUD />
      <StrategicHUD />
      <RealtimeCoachHUD />
    </>
  );
}