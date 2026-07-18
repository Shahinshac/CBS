/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f8fafc',
          100: '#e2e8f0',
          500: '#0f172a',
          600: '#0f172a',
          700: '#0f172a',
          900: '#0f172a',
        },
        success: '#10b981',
        danger: '#ba1a1a',
        warning: '#f59e0b',
      }
    },
  },
  plugins: [],
}
