// src/app/layout.jsx
// Este es el componente de diseño raíz (Root Layout) de la aplicación Next.js.
// Su función principal es envolver todo el contenido de la aplicación.
// Aquí es donde aplicamos estilos globales y, de manera crucial, envolvemos
// la aplicación con nuestro `AppStateProvider` para que el estado global
// (como el flujo de la aplicación y los datos del usuario) esté disponible en todas partes.

import { AppStateProvider } from '@/context/AppStateContext';
import './globals.css'; // Importa los estilos globales de Tailwind CSS

// Metadata para el SEO y la pestaña del navegador.
export const metadata = {
  title: 'LoL MetaMind',
  description: 'Un asistente inteligente en tiempo real para League of Legends.',
};

/**
 * El componente RootLayout.
 * @param {object} props - Propiedades del componente.
 * @param {React.ReactNode} props.children - Los componentes de la página que serán renderizados dentro de este layout.
 */
export default function RootLayout({ children }) {
  return (
    <html lang="es">
      {/* El cuerpo de la aplicación.
        La clase 'bg-transparent' es importante para que la ventana de Electron 
        pueda tener un fondo transparente si es necesario.
      */}
      <body className="bg-transparent">
        {/*
          Aquí envolvemos toda la aplicación con el AppStateProvider.
          Cualquier componente renderizado dentro de `{children}` (es decir, cualquier página)
          ahora podrá usar el hook `useAppState()` para acceder al estado global.
        */}
        <AppStateProvider>
          {children}
        </AppStateProvider>
      </body>
    </html>
  );
}