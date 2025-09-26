import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-lol-blue-dark text-lol-gold-light">
      <h1 className="text-3xl font-bold">Iniciando HUD de Electron...</h1>
      <p>Para ver el overlay, ve a <a href="/overlay" className="text-lol-blue-accent">/overlay</a></p>
    </div>
  );
}
