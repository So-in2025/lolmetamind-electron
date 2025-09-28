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
        // TUS COLORES ORIGINALES (PRESERVADOS)
        'lol-gold': {
          DEFAULT: '#C89B3C',
          light: '#F0E6D2',
          dark: '#785A28',
        },
        'lol-blue': {
          DEFAULT: '#0A323C',
          light: '#091428',
          dark: '#031A21',
          accent: '#0BC6E3',
        },
        'lol-grey': {
          DEFAULT: '#A09B8C',
          light: '#3C3C41',
          dark: '#1E2328',
        },
        // 🚨 COLORES CRÍTICOS AÑADIDOS PARA LA ESTÉTICA DEL LOGIN 🚨
        'lol-app-bg': '#091018', // Fondo más oscuro (el que resuelve el problema del fondo claro)
        'lol-input-bg': '#111A23', // Fondo de input/campos
        'lol-accent-gold': '#C5B58E', // Oro específico usado para bordes/botones de Login
        'lol-highlight': '#FFD700', // Dorado más brillante para focus/shadow
      },
      textShadow: {
        'default': '0 2px 4px rgba(0, 0, 0, 0.5)',
        'md': '0 4px 8px rgba(0, 0, 0, 0.6...',
      },
      fontFamily: {
        'lol-title': ['BeaufortforLOL-Bold', 'Cinzel', 'serif'],
      },
    },
  },
  plugins: [],
};