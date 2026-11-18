/** @type {import('tailwindcss').Config} */
const v = name => `rgb(var(--${name}-rgb) / <alpha-value>)`
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: { 50:'#eef2ff', 100:'#e0e7ff', 300:'#a5b4fc', 400:'#818cf8', 500:'#6366f1', 600:'#4f46e5', 700:'#4338ca', 900:'#1e1b4b' },
        // Surfaces qui suivent le thème clair / sombre (voir src/index.css)
        dark: { 600: v('fill2'), 700: v('fill'), 800: v('card'), 900: v('bg'), 950: v('bg') },
        gray: { 300: v('gray300'), 400: v('gray400'), 500: v('gray500'), 600: v('gray600'), 700: v('gray700') },
        label: v('label'),
        contrast: v('label'),
      },
      opacity: { 8: '0.08' },
      fontFamily: { sans: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Text"', '"Helvetica Neue"', 'Inter', 'system-ui', 'sans-serif'] }
    }
  },
  plugins: []
}
