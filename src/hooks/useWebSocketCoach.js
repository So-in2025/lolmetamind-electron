import { useState, useEffect, useRef, useCallback } from 'react';

const WS_URL = 'ws://localhost:8080'; 

export const useWebSocketCoach = ({ userData, targetEvent }) => {
  const [aiAdvice, setAiAdvice] = useState(null);
  const [wsStatus, setWsStatus] = useState('DISCONNECTED');
  const ws = useRef(null);

  useEffect(() => {
    if (ws.current) ws.current.close();
    
    ws.current = new WebSocket(WS_URL);
    
    ws.current.onopen = () => { setWsStatus('CONNECTED'); };
    ws.current.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.eventType === targetEvent) {
          setAiAdvice(message.data);
        } else if (message.eventType === 'ERROR') {
          console.error('[WS ERROR]', message.data.message);
        }
      } catch (e) {
        console.error('[WS Parse Error]', e);
      }
    };
    ws.current.onclose = () => setWsStatus('DISCONNECTED');
    ws.current.onerror = (e) => { setWsStatus('ERROR'); };

    return () => { if (ws.current) ws.current.close(); };
  }, [targetEvent]);

  const sendMessage = useCallback((eventType, data = {}) => {
    if (wsStatus === 'CONNECTED' && userData) {
      const message = { eventType: eventType, data: data, userData: userData };
      ws.current.send(JSON.stringify(message));
      setAiAdvice(null); 
      return true;
    }
    return false;
  }, [wsStatus, userData]);
  
  const sendQueueUpdate = useCallback(() => sendMessage('QUEUE_UPDATE'), [sendMessage]);
  const sendChampSelectUpdate = useCallback((draftData) => sendMessage('CHAMP_SELECT_UPDATE', draftData), [sendMessage]);

  return { aiAdvice, wsStatus, sendQueueUpdate, sendChampSelectUpdate, sendMessage };
};
