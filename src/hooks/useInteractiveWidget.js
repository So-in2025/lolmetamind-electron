import { useState, useCallback, useEffect } from 'react';

export const useInteractiveWidget = (initialState = false) => {
  const [isInteractive, setIsInteractive] = useState(initialState);
  
  const setIgnoreMouseEvents = useCallback((ignore) => {
    if (window.electronAPI && window.electronAPI.setIgnoreMouseEvents) {
      window.electronAPI.setIgnoreMouseEvents(ignore, !ignore);
      setIsInteractive(!ignore);
    }
  }, []);

  const setInteractive = useCallback((value) => {
    setIgnoreMouseEvents(!value);
  }, [setIgnoreMouseEvents]);

  useEffect(() => {
    setIgnoreMouseEvents(!initialState);
  }, [initialState, setIgnoreMouseEvents]);

  return { isInteractive, setInteractive, setIgnoreMouseEvents };
};
