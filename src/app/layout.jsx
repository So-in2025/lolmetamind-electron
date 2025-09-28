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
      <body>
        <AppStateProvider>
          {children}
        </AppStateProvider>
      </body>
    </html>
  );
}