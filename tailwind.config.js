/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
       backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic':
          'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
      colors: {
        // TUS COLORES ORIGINALES, AJUSTADOS PARA CONSISTENCIA:
        'lol-gold': {
          DEFAULT: '#c8aa6e', // Dorado principal
          light: '#F0E6D2',   // Beige/Claro (para texto/acento)
          dark: '#785A28',
        },
        'lol-blue': {
          DEFAULT: '#0099ff', // Azul brillante (para botones/acento)
          light: '#0BC6E3',
          medium: '#0A2433',   // <-- agrega un tono medio aquí
          dark: '#031A21',
          accent: '#0BC6E3',
        },
        'lol-grey': {
          DEFAULT: '#A09B8C',
          light: '#3C3C41',
          dark: '#1E2328', // Gris muy oscuro/Fondo de contenedores
        },
        // 🚨 COLORES CRÍTICOS AÑADIDOS PARA LA ESTÉTICA (Nuevos o ajustados):
        'lol-app-bg': '#091018', // Fondo más oscuro para toda la app (casi negro)
        'lol-input-bg': '#1e2328', // Fondo de input
        'lol-text': '#f0e6d2',    // Texto principal
        'lol-dark-blue': '#1e2328', // Fondo del panel de configuración
      },
    },
  },
  plugins: [
    // Asegúrate de que tienes 'tailwindcss-textshadow' si lo usas
    require('tailwindcss-textshadow'),
  ],
}