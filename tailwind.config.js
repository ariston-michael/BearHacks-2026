/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: '#0a0a1a',
        accent: '#6366f1',
      },
      animation: {
        flicker: 'flicker 1.4s infinite',
      },
      keyframes: {
        flicker: {
          '0%, 100%': { opacity: '1' },
          '20%': { opacity: '0.3' },
          '40%': { opacity: '0.9' },
          '60%': { opacity: '0.2' },
          '80%': { opacity: '0.7' },
        },
      },
    },
  },
  plugins: [],
}
