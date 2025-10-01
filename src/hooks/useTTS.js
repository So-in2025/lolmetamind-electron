import { useCallback } from 'react';

export const useTTS = () => {
  const speak = useCallback((text, volume = 1.0, rate = 1.0) => {
    if (!window.speechSynthesis) {
      console.warn("TTS no disponible en este entorno.");
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.volume = volume; 
    utterance.rate = rate;     
    
    window.speechSynthesis.speak(utterance);
    
  }, []);

  const stop = useCallback(() => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }, []);

  return { speak, stop };
};
