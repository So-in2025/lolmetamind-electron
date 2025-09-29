// src/app/layout.jsx

import React from 'react';
import { AppStateProvider } from '../context/AppStateContext';
import './globals.css';

export const metadata = {
  title: 'LolMetaMind - Coach Estratégico',
  description: 'Aplicación de escritorio para análisis estratégico de League of Legends.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      {/* 🚨 CRÍTICO: El body no tiene ninguna clase de fondo para permitir la transparencia de Electron. */}
      <body>
        <AppStateProvider>
          {children}
        </AppStateProvider>
      </body>
    </html>
  );
}