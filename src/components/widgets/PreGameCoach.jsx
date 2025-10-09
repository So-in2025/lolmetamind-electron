// src/components/widgets/PreGameCoach.jsx
// =================================================================================================
// 🔥 COMPONENTE PRE-GAME COACH [VERSIÓN DEFINITIVA] by Asistente de Programación
// =================================================================================================
//
// CARACTERÍSTICAS CLAVE:
// ----------------------
// 1.  **Orquestación de Hooks**: Integra `useWebSocketCoach` para la comunicación, `useTTS` para el
//     audio y `useInteractiveWidget` para la UX, actuando como el "cerebro" de la UI.
// 2.  **Máquina de Estados Visual**: Gestiona múltiples estados de la UI (carga, éxito, timeout, error)
//     para dar feedback claro al usuario en todo momento.
// 3.  **Resiliencia ante Cold Start**: Implementa un sistema de timeout inteligente que espera un
//     periodo inicial antes de mostrar un error, siendo tolerante con servicios que necesitan "despertar".
// 4.  **Solicitud Única por Fase**: Utiliza `useRef` para garantizar que la solicitud de consejo a la IA
//     se envíe una sola vez al entrar en la fase de 'Lobby', evitando peticiones duplicadas.
// 5.  **Reintento Manual**: Ofrece al usuario un botón para reintentar la solicitud en caso de fallo,
//     mejorando la experiencia de usuario ante problemas de red o del servidor.
// 6.  **Ciclo de Vida Limpio**: La lógica se resetea automáticamente al salir de la fase de 'Lobby',
//     preparando el componente para la siguiente vez que se necesite.
//
// =================================================================================================

'use client';

import React, { useEffect, useState, useRef } from 'react';
import { FaSync, FaBrain, FaMicrophoneAlt, FaExclamationTriangle, FaRedo, FaStop } from 'react-icons/fa';
import { useWebSocketCoach } from '@/hooks/useWebSocketCoach';
import { useTTS } from '@/hooks/useTTS';
import { useInteractiveWidget } from '@/hooks/useInteractiveWidget';


export default function PreGameCoach({ LCU_STATUS, userData, gamePhase }) {
  // Log inicial para cada renderizado, ayuda a depurar bucles infinitos.
  console.log(`[PreGameCoach] ⚙️ Renderizando componente. Fase actual: ${gamePhase}, Estado WS: ${wsStatus}`);

  // --- HOOKS PRINCIPALES ---
  // Hook para la comunicación en tiempo real. Le decimos que escuche el evento 'QUEUE_ADVICE'.
  const { aiAdvice, wsStatus, sendQueueUpdate } = useWebSocketCoach({ userData, targetEvent: 'QUEUE_ADVICE' });
  // Hook para la síntesis de voz.
  const { speak, stop, preload } = useTTS();
  // Hook para gestionar la interactividad visual del widget.
  const { isInteractive, setInteractive } = useInteractiveWidget(false);

  // --- ESTADOS INTERNOS DEL COMPONENTE ---
  // Controla si estamos esperando una respuesta de la IA.
  const [isLoading, setIsLoading] = useState(true);
  // Controla si la solicitud ha superado el tiempo de espera máximo.
  const [isTimedOut, setIsTimedOut] = useState(false);
  // Controla si el audio del consejo está listo para ser reproducido.
  const [isAudioReady, setIsAudioReady] = useState(false);
  // Ref para rastrear si ya hemos enviado la solicitud en la fase actual.
  // Usamos `useRef` para que su valor persista entre renders sin causar uno nuevo.
  const sentRequestRef = useRef(false);

  // ==========================================================================
  // EFECTO 1: LÓGICA DE SOLICITUD DE CONSEJO
  // Se dispara cuando la fase del juego o el estado del WebSocket cambian.
  // ==========================================================================
  useEffect(() => {
    // [GUARDIA] Solo actuar si estamos en 'Lobby', el WS está conectado y NO hemos enviado ya una solicitud.
    if (gamePhase === 'Lobby' && wsStatus === 'CONNECTED' && !sentRequestRef.current) {
      console.log('[PreGameCoach] 🚀 Fase de Lobby y WS conectado. Enviando solicitud de consejo...');
      // Reiniciamos los estados visuales a "cargando".
      setIsLoading(true);
      setIsTimedOut(false);
      // Llamamos a la función del hook para enviar el mensaje al backend.
      sendQueueUpdate();
      // Marcamos que la solicitud ha sido enviada para no volver a enviarla en esta fase.
      sentRequestRef.current = true;
    }
    
    // --- Lógica de Limpieza ---
    // Si la fase del juego ya no es 'Lobby', reseteamos el componente para la próxima vez.
    if (gamePhase !== 'Lobby' && sentRequestRef.current) {
        console.log('[PreGameCoach] 🔄 Saliendo de Lobby. Reseteando estado del componente.');
        sentRequestRef.current = false;
        setIsLoading(true);
        setIsTimedOut(false);
        setIsAudioReady(false);
    }

  }, [gamePhase, wsStatus, sendQueueUpdate]); // Dependencias críticas para re-evaluar la lógica.

  // ==========================================================================
  // EFECTO 2: LÓGICA DE TIMEOUT PARA MANEJAR EL COLD START
  // Se activa cuando se envía una solicitud y espera una respuesta.
  // ==========================================================================
  useEffect(() => {
    // [GUARDIA] Si ya tenemos respuesta o el componente no está en estado de carga, no hay nada que hacer.
    if (aiAdvice || !isLoading) return;

    // Solo iniciar el temporizador si hemos enviado la solicitud.
    if (!sentRequestRef.current) return;

    console.log('[PreGameCoach] ⏱️ Solicitud enviada. Iniciando temporizador de timeout...');
    
    // Establecemos un temporizador. Si después de 35 segundos no hemos recibido `aiAdvice`,
    // asumimos que el servidor (Render) tuvo un "cold start" y tardó demasiado, o falló.
    const timeoutId = setTimeout(() => {
        // Doble chequeo: solo activar el timeout si `aiAdvice` sigue siendo nulo.
        if (!aiAdvice) {
            console.error('[PreGameCoach] ❌ TIMEOUT: No se recibió consejo en 35 segundos. Mostrando error al usuario.');
            setIsTimedOut(true);
            setIsLoading(false);
        }
    }, 35000); // 35 segundos es un tiempo generoso para un cold start.

    // --- Función de Limpieza del Efecto ---
    // Si el componente se desmonta o las dependencias cambian (ej. llega `aiAdvice`),
    // cancelamos el temporizador para evitar que se active innecesariamente.
    return () => {
      clearTimeout(timeoutId);
    };
  }, [isLoading, aiAdvice]); // Se re-evalúa si empezamos a cargar o si recibimos el consejo.

  // ==========================================================================
  // EFECTO 3: LÓGICA DE PROCESAMIENTO DE RESPUESTA DE LA IA Y TTS
  // Se dispara SOLAMENTE cuando el estado `aiAdvice` cambia de null a un valor.
  // ==========================================================================
  useEffect(() => {
    // [GUARDIA] Si no hay consejo, no hacer nada.
    if (!aiAdvice?.fullText) return;

    console.log('[PreGameCoach] ✅ ¡Consejo recibido del servidor! Procesando audio TTS...');
    // Actualizamos los estados para reflejar que la carga terminó exitosamente.
    setIsLoading(false);
    setIsTimedOut(false); 

    // Precargamos el audio para que esté listo cuando el usuario haga clic.
    preload(aiAdvice.fullText)
      .then(() => {
        console.log('[PreGameCoach] ✅ Audio precargado y listo para reproducir.');
        setIsAudioReady(true);
        // Opcional: podrías llamar a `speak(aiAdvice.fullText)` aquí para reproducción automática.
      })
      .catch((err) => {
        console.error('[PreGameCoach] ❌ ERROR CRÍTICO: La precarga del audio TTS falló:', err.message);
        // Aunque el texto se muestre, indicamos que el audio no está disponible.
        setIsAudioReady(false);
      });

  }, [aiAdvice, preload]); // La única dependencia es el consejo de la IA.

  // ==========================================================================
  // FUNCIÓN DE RENDERIZADO CONDICIONAL DEL WIDGET
  // Decide qué mostrar basado en los estados `isLoading`, `isTimedOut`, `aiAdvice`, etc.
  // ==========================================================================
  const renderWidgetContent = () => {
    // Estado 1: Cargando y esperando respuesta.
    if (isLoading && !isTimedOut) {
        return (
            <div className="text-center p-4">
                <FaSync className="animate-spin text-lol-gold mx-auto text-3xl mb-2" />
                <p className="text-lol-gold-light text-sm font-bold">Despertando IA y analizando meta...</p>
                <p className="text-gray-400 text-xs mt-1">(Puede tardar si el servidor estaba inactivo)</p>
            </div>
        );
    }
    
    // Estado 2: Error por timeout o desconexión del WebSocket.
    if (isTimedOut || wsStatus === 'ERROR' || wsStatus === 'DISCONNECTED') {
        return (
          <div className="text-center p-4 bg-red-900/40 border border-red-500 rounded-xl">
              <FaExclamationTriangle className="text-red-500 mx-auto text-3xl mb-2" />
              <p className="text-red-400 text-sm font-bold">Error de Conexión con la IA</p>
              <p className="text-gray-400 text-xs mt-1">El servidor no respondió a tiempo. Puede que esté inactivo.</p>
              <button
                  onClick={() => {
                      console.log('[PreGameCoach] 🔄 Usuario solicitó reintento manual.');
                      // Reseteamos los estados para forzar la re-ejecución del EFECTO 1.
                      sentRequestRef.current = false;
                      setIsTimedOut(false);
                      setIsLoading(true);
                      // El cambio de estado y la lógica en el useEffect se encargarán del resto.
                  }}
                  className="w-full mt-3 py-2 bg-lol-blue-accent hover:bg-lol-blue-medium text-lol-blue-dark font-bold text-sm rounded transition-colors"
              >
                  <FaRedo className="inline mr-1" size={12} /> REINTENTAR
              </button>
          </div>
        );
    }
    
    // Estado 3: Éxito. Tenemos el consejo de la IA.
    if (aiAdvice) {
      return (
        <div className="p-4 space-y-3">
          <h3 className="text-lol-accent-gold text-lg font-bold">Análisis Astro-Táctico (IA)</h3>
          <p className="text-gray-300 text-sm">{aiAdvice?.fullText}</p>
          
          <div className="flex space-x-2">
            <button
              onClick={() => {
                if (aiAdvice?.fullText) {
                  console.log('[PreGameCoach] ▶️ Usuario solicitó reproducción de audio.');
                  speak(aiAdvice.fullText, 0.85);
                }
              }}
              className={`flex-1 py-1 ${isAudioReady ? 'bg-lol-gold-dark hover:bg-lol-gold' : 'bg-gray-600 opacity-60 cursor-not-allowed'} text-lol-blue-dark font-bold text-xs rounded transition-colors`}
              style={{ WebkitAppRegion: 'no-drag' }} // Permite hacer clic en el botón en una ventana arrastrable.
              disabled={!isAudioReady}
            >
              <FaMicrophoneAlt className="inline mr-1" size={10} /> Escuchar
            </button>
            
            <button
              onClick={() => {
                console.log('[PreGameCoach] ⏹️ Usuario solicitó detener audio.');
                stop();
              }}
              className="py-1 px-3 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded transition-colors"
              style={{ WebkitAppRegion: 'no-drag' }}
            >
              <FaStop size={10} />
            </button>
          </div>
        </div>
      );
    }

    // Estado por defecto o si algo inesperado ocurre.
    return null;
  };

  // --- RENDERIZADO FINAL DEL COMPONENTE ---
  // [GUARDIA DE RENDER] Solo renderizar el widget completo si estamos en la fase de 'Lobby'.
  if (gamePhase !== 'Lobby') {
    return null;
  }

  return (
    <div
      className={`transition-all duration-300 max-w-xs mx-auto p-3 rounded-xl shadow-lol-lg z-50 relative pointer-events-auto ${
        isInteractive ? 'bg-lol-blue-dark bg-opacity-95 border-2 border-lol-blue-accent' : 'bg-lol-blue-dark border border-lol-gold-dark'
      }`}
      style={{ WebkitAppRegion: 'drag' }} // Permite arrastrar la ventana desde este elemento.
      onMouseEnter={() => setInteractive(true)}
      onMouseLeave={() => setInteractive(false)}
    >
      <h2 className="font-display text-lg font-bold text-lol-gold flex items-center mb-1">
        <FaBrain className="mr-2 text-lol-blue-accent" size={14} />
        COACH PRE-PARTIDA
      </h2>
      
      {renderWidgetContent()}
    </div>
  );
}