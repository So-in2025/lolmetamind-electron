// src/components/DashboardTabs.jsx
// Este componente gestiona las pestañas navegables del dashboard,
// permitiendo al usuario acceder a diferentes secciones de información
// y análisis proporcionadas por la IA y la configuración.

"use client";

// #1. IMPORTACIÓN CORREGIDA: Se añaden useState, useEffect y useCallback desde 'react'.
import React, { useState, useEffect, useCallback } from 'react';
import { Tab } from '@headlessui/react';
import MetaAnalysis from './dashboard/MetaAnalysis';
import WeeklyChallenges from './dashboard/WeeklyChallenges';
import Recommendations from './dashboard/Recommendations';
import RiotApiSettings from './RiotApiSettings';

function classNames(...classes) {
  return classes.filter(Boolean).join(' ');
}

export default function DashboardTabs({ 
    userData, 
    metaData: initialMetaData,
    weeklyChallenges: initialWeeklyChallenges,
    recommendations: initialRecommendations,
    onAnalysisRequest 
}) {
  // #2. LÓGICA DE ESTADO CORREGIDA:
  // El estado ahora se usa solo para los datos que se pueden "refrescar"
  // y se inicializa de forma segura dentro de un `useEffect` para evitar actualizaciones durante el renderizado.
  const [metaData, setMetaData] = useState(null);
  const [weeklyChallenges, setWeeklyChallenges] = useState(null);
  const [recommendations, setRecommendations] = useState(null);
  const [loadingSpecificTab, setLoadingSpecificTab] = useState(null);

  // Sincroniza las props iniciales con los estados locales de forma segura
  useEffect(() => { setMetaData(initialMetaData); }, [initialMetaData]);
  useEffect(() => { setWeeklyChallenges(initialWeeklyChallenges); }, [initialWeeklyChallenges]);
  useEffect(() => { setRecommendations(initialRecommendations); }, [initialRecommendations]);

  // Función para refrescar datos de una pestaña específica (ej. Meta, Desafíos)
  const refreshTabData = useCallback(async (type) => {
      if (!window.electronAPI) return;
      setLoadingSpecificTab(type);
      let result;
      try {
          switch (type) {
              case 'meta':
                  result = await window.electronAPI.getMetaAnalysis();
                  if (!result.error) setMetaData(result);
                  break;
              case 'challenges':
                  result = await window.electronAPI.getWeeklyChallenges();
                  if (!result.error) setWeeklyChallenges(result);
                  break;
              case 'recommendations':
                  result = await window.electronAPI.getRecommendations({
                      favRole1: userData?.favRole1,
                      favChamp1: userData?.favChamp1,
                  });
                  if (!result.error) setRecommendations(result);
                  break;
              default:
                  console.warn(`Tipo de refresco desconocido: ${type}`);
          }
          if (result && result.error) {
              console.error(`Error al refrescar ${type}:`, result.error);
          }
      } catch (err) {
          console.error(`Fallo en el refresco de ${type}:`, err);
      } finally {
          setLoadingSpecificTab(null);
      }
  }, [userData]);

  const tabs = [
    { name: 'Recomendaciones de IA', component: Recommendations, type: 'recommendations' },
    { name: 'Meta Actual', component: MetaAnalysis, type: 'meta' },
    { name: 'Desafíos Semanales', component: WeeklyChallenges, type: 'challenges' },
    { name: 'Configuración', component: RiotApiSettings, type: 'settings' }
  ];

  return (
    <div className="w-full flex-grow flex flex-col">
      <Tab.Group>
        <Tab.List className="flex space-x-1 rounded-xl bg-lol-dark-blue p-1 mb-4">
          {tabs.map((tab) => (
            <Tab
              key={tab.name}
              className={({ selected }) =>
                classNames(
                  'w-full rounded-lg py-2.5 text-base font-medium leading-5',
                  'ring-white/60 ring-offset-2 ring-offset-lol-dark-blue focus:outline-none focus:ring-2',
                  selected
                    ? 'bg-lol-gold text-white shadow-md'
                    : 'text-blue-100 hover:bg-white/[0.12] hover:text-white',
                    'transition-colors duration-200'
                )
              }
            >
              {tab.name}
            </Tab>
          ))}
        </Tab.List>

        <Tab.Panels className="flex-grow">
          {tabs.map((tab, idx) => (
            <Tab.Panel key={idx} className="rounded-xl bg-lol-dark-blue p-6 h-full shadow-lg">
              <div className="flex justify-between items-center mb-4 border-b border-lol-gold/40 pb-3">
                 <h3 className="text-2xl font-bold text-lol-gold">{tab.name}</h3>
                 {(tab.type === 'meta' || tab.type === 'challenges' || tab.type === 'recommendations') && (
                     <button
                         onClick={() => refreshTabData(tab.type)}
                         className="bg-lol-accent-gold text-white text-sm py-1.5 px-3 rounded hover:bg-lol-accent-gold/80 transition-colors duration-200 flex items-center gap-1"
                         disabled={loadingSpecificTab === tab.type}
                     >
                         {loadingSpecificTab === tab.type ? (
                             <>
                                 <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                     <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                     <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                 </svg>
                                 Cargando...
                             </>
                         ) : 'Actualizar'}
                     </button>
                 )}
              </div>
              
              {tab.type === 'recommendations' && <Recommendations recommendations={recommendations} userData={userData} />}
              {tab.type === 'meta' && <MetaAnalysis metaData={metaData} />}
              {tab.type === 'challenges' && <WeeklyChallenges challenges={weeklyChallenges} />}
              {tab.type === 'settings' && <RiotApiSettings />}
            </Tab.Panel>
          ))}
        </Tab.Panels>
      </Tab.Group>
    </div>
  );
}

