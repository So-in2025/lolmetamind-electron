/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
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
      },
      textShadow: {
        'default': '0 2px 4px rgba(0, 0, 0, 0.5)',
        'md': '0 4px 8px rgba(0, 0, 0, 0.6)',
        'lg': '0 10px 15px rgba(0, 0, 0, 0.6)',
      },
    },
  },
  plugins: [
    require('tailwindcss-textshadow'),
  ],
};