// src/app/layout.jsx
import { AppStateProvider } from '../context/AppStateContext'; // Asegúrate de la ruta correcta
import '../app/globals.css'; // Asumo que esta es la ruta de tu CSS global

export const metadata = {
  title: 'LolMetaMind - Coach Estratégico',
  description: 'Coach estratégico para League of Legends.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
        {/* 🚨 INTEGRACIÓN DEL PROVEEDOR DE ESTADO */}
        <AppStateProvider>
          {children}
        </AppStateProvider>
      </body>
    </html>
  );
}
