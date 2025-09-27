import React from 'react';
// 🚨 IMPORTACIÓN CRÍTICA: Importamos el proveedor de estado
import { AppStateProvider } from '../context/AppStateContext'; 

// Importa tus estilos globales
import './globals.css'; 

// Puedes definir metadatos si lo deseas
export const metadata = {
  title: 'LolMetaMind - Coach Estratégico',
  description: 'Aplicación de escritorio para análisis estratégico de League of Legends.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body className="antialiased">
        {/* 🚨 ENVOLTURA CRÍTICA: Inicializa el contexto para toda la aplicación */}
        <AppStateProvider> 
          {children}
        </AppStateProvider>
      </body>
    </html>
  );
}
