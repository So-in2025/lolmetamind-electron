import './globals.css'
export const metadata = {
  title: 'LoL MetaMind HUD',
  description: 'HUD flotante de LoL MetaMind',
}
export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
