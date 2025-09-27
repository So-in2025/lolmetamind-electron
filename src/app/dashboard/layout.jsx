import React from 'react';

// Este layout puede envolver el Dashboard con un menú lateral o un encabezado fijo si lo deseas.
// Por ahora, solo envuelve el contenido principal.

export default function DashboardLayout({ children }) {
  return (
    <div className="flex h-screen bg-[#091018] text-white">
      {/* Puedes agregar aquí un componente Sidebar */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}