// src/hooks/useInteractiveWidget.js
// Hook para manejar interactividad del widget y arrastre en Electron
import { useState, useCallback, useEffect } from 'react';

export const useInteractiveWidget = (initialState = false) => {
  const [isInteractive, setIsInteractive] = useState(initialState);

  // setIgnoreMouseEvents: controla si el widget ignora eventos del mouse
  const setIgnoreMouseEvents = useCallback((ignore) => {
    if (window.electronAPI?.setIgnoreMouseEvents) {
      window.electronAPI.setIgnoreMouseEvents(ignore, !ignore);
      setIsInteractive(!ignore);
    }
  }, []);

  // setInteractive: activa/desactiva interactividad
  const setInteractive = useCallback((value) => setIgnoreMouseEvents(!value), [setIgnoreMouseEvents]);

  // Al montar, establecer el estado inicial
  useEffect(() => {
    setIgnoreMouseEvents(!initialState);
  }, [initialState, setIgnoreMouseEvents]);

  return { isInteractive, setInteractive, setIgnoreMouseEvents };
};
