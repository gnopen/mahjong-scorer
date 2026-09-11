/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        felt: { DEFAULT: '#0f5132', dark: '#0a3a24', light: '#166b45' },
        ink: { DEFAULT: '#0b1220', soft: '#141d31', line: '#22304d' },
        gold: '#e9b949',
        winner: '#22c55e',
        loser: '#ef4444',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        tile: ['"Segoe UI Symbol"', '"Noto Sans Symbols 2"', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
