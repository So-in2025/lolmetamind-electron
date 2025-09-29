// src/hooks/useInteractiveWidget.js
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

export function useInteractiveWidget(widgetId, defaultPos = { x: 0, y: 0 }) {
  // --- TUS ESTADOS ORIGINALES (MANTENIDOS) ---
  const [position, setPosition] = useState(defaultPos);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const [isLoaded, setIsLoaded] = useState(false);
  
  // --- NUEVO ESTADO (INTEGRADO) ---
  const [isWidgetInteractive, setIsWidgetInteractive] = useState(false);

  // --- TU LÓGICA ORIGINAL DE CARGA (MANTENIDA) ---
  useEffect(() => {
    const savedPosition = localStorage.getItem(widgetId);
    if (savedPosition) {
      setPosition(JSON.parse(savedPosition));
    }
    setIsLoaded(true);
  }, [widgetId]);

  // --- TU LÓGICA DE ARRASTRE (ADAPTADA) ---
  const handleMouseDown = useCallback((e) => {
    // ADAPTACIÓN: Solo permitir arrastrar si el widget es interactivo
    if (isWidgetInteractive) {
      setIsDragging(true);
      dragStartPos.current = {
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      };
    }
  }, [position, isWidgetInteractive]); // Dependencia añadida

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
      localStorage.setItem(widgetId, JSON.stringify(position));
    }
  }, [isDragging, position, widgetId]);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  // --- ¡LA PIEZA QUE FALTABA! (INTEGRADA) ---
  // EFECTO CRÍTICO: Escuchar el evento de Alt+O desde main.js
  useEffect(() => {
    if (window.electronAPI && typeof window.electronAPI.on === 'function') {
        const unsubscribe = window.electronAPI.on('overlay-interaction-toggle', (isInteractive) => {
            console.log(`[Hook] Recibido 'overlay-interaction-toggle'. Interactivo: ${isInteractive}`);
            setIsWidgetInteractive(isInteractive);
        });
        // Limpieza al desmontar el componente
        return () => unsubscribe();
    }
  }, []); // Se ejecuta solo una vez al montar

  // Devolvemos TODO: Tu lógica de posición + la nueva lógica de interactividad
  return { 
      position, 
      isLoaded, 
      handleMouseDown, 
      isWidgetInteractive // <-- ¡AHORA LO DEVOLVEMOS!
  };
};