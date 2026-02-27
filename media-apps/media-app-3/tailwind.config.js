/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'surface-0': '#0d0d17',
        'surface-1': '#13131f',
        'surface-2': '#1e1e2e',
        'surface-3': '#252538',
        primary: '#e2e8f0',
        muted: '#64748b',
        accent: '#6366f1',
        'accent-hover': '#818cf8',
        danger: '#ef4444',
        success: '#22c55e',
      },
    },
  },
  plugins: [],
}
