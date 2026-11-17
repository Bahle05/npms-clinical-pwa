/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{js,jsx}'
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Fira Sans"', 'system-ui', '-apple-system', 'sans-serif'],
        heading: ['"Fira Sans"', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"Fira Code"', 'ui-monospace', 'SFMono-Regular', 'monospace']
      },
      colors: {
        clinical: {
          bg: '#F8FAFC',
          surface: '#FFFFFF',
          primary: '#1D4ED8',
          safe: '#15803D',
          priority: '#B45309',
          urgent: '#B91C1C'
        }
      }
    }
  },
  plugins: []
};