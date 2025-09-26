'use client';
import { useState, useEffect, useRef, useCallback } from 'react';

export const useInteractiveWidget = (widgetId, defaultPos) => {
  const [position, setPosition] = useState(defaultPos);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const savedPosition = localStorage.getItem(widgetId);
    if (savedPosition) {
      setPosition(JSON.parse(savedPosition));
    }
    setIsLoaded(true);
  }, [widgetId]);

  const handleMouseDown = useCallback((e) => {
    setIsDragging(true);
    dragStartPos.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
  }, [position]);

  const handleMouseMove = useCallback((e) => {
    if (isDragging) {
      const newPos = {
        x: e.clientX - dragStartPos.current.x,
        y: e.clientY - dragStartPos.current.y,
      };
      setPosition(newPos);
    }
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
      // Guardamos la posición final al soltar
      localStorage.setItem(widgetId, JSON.stringify(position));
    }
  }, [isDragging, position, widgetId]);

  useEffect(() => {
    // Agregamos los listeners al window para mover y soltar desde cualquier parte
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    // Limpiamos los listeners cuando el componente se desmonta
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  return { position, isLoaded, handleMouseDown };
};