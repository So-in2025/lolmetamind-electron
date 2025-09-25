'use client';
import { createContext, useState, useContext, useEffect } from 'react';

const ScaleContext = createContext();

export const useScale = () => useContext(ScaleContext);

export const ScaleProvider = ({ children }) => {
  const [scale, setScale] = useState(1.0);

  useEffect(() => {
    const savedScale = localStorage.getItem('widgets-scale');
    if (savedScale) {
      setScale(parseFloat(savedScale));
    }
  }, []);

  const updateScale = (newScale) => {
    // RANGO AJUSTADO: de 40% a 200%
    const clampedScale = Math.max(0.4, Math.min(2.0, newScale));
    setScale(clampedScale);
    localStorage.setItem('widgets-scale', clampedScale.toString());
  };

  const increaseScale = () => {
    updateScale(scale + 0.1);
  };

  const decreaseScale = () => {
    updateScale(scale - 0.1);
  };

  return (
    <ScaleContext.Provider value={{ scale, increaseScale, decreaseScale }}>
      {children}
    </ScaleContext.Provider>
  );
};