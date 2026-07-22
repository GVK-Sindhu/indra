/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f3f4fd',
          100: '#e5e6fb',
          200: '#cbcdf7',
          300: '#a3a6f1',
          400: '#7377e9',
          500: '#4f52db',
          600: '#3c3ebe',
          700: '#30329c',
          800: '#2c2e81',
          900: '#27286b',
          950: '#161741',
        },
        dark: {
          50: '#f8fafc',
          100: '#f1f5f9',
          800: '#1e293b',
          900: '#0f172a',
          950: '#030712', // deep rich black
        }
      },
      fontFamily: {
        sans: ['Outfit', 'Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
