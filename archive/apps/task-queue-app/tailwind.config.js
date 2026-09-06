/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Industrial dark palette
        surface: {
          950: '#0a0a0b',
          900: '#111113',
          800: '#1a1a1d',
          700: '#252529',
          600: '#313136',
          500: '#3f3f46',
        },
        // Status colors
        status: {
          idle: '#6b7280',
          running: '#3b82f6',
          success: '#22c55e',
          error: '#ef4444',
          warning: '#f59e0b',
        },
        // Accent - electric cyan
        accent: {
          DEFAULT: '#06b6d4',
          dim: '#0891b2',
          bright: '#22d3ee',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
        display: ['Outfit', 'system-ui', 'sans-serif'],
        body: ['Outfit', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'fade-in': 'fadeIn 0.2s ease-out',
        'progress-indeterminate': 'progressIndeterminate 1.5s ease-in-out infinite',
      },
      keyframes: {
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        progressIndeterminate: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(400%)' },
        },
      },
      boxShadow: {
        'inner-glow': 'inset 0 1px 0 0 rgba(255, 255, 255, 0.05)',
        'card': '0 0 0 1px rgba(255, 255, 255, 0.05), 0 4px 20px rgba(0, 0, 0, 0.4)',
      },
    },
  },
  plugins: [],
};
