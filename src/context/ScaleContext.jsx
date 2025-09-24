'use client';
import { createContext, useState, useContext, useEffect } from 'react';

const ScaleContext = createContext();

export const useScale = () => useContext(ScaleContext);

export const ScaleProvider = ({ children }) => {
  const [scale, setScale] = useState(1.0);

  // Cargar la escala guardada al iniciar
  useEffect(() => {
    const savedScale = localStorage.getItem('widgets-scale');
    if (savedScale) {
      setScale(parseFloat(savedScale));
    }
  }, []);

  // Guardar la escala cada vez que cambia
  const updateScale = (newScale) => {
    const clampedScale = Math.max(0.5, Math.min(2.0, newScale)); // Limita la escala entre 50% y 200%
    setScale(clampedScale);
    localStorage.setItem('widgets-scale', clampedScale);
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