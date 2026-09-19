/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          0: '#050505',
          1: '#0c0c0c',
          2: '#131313',
          3: '#1a1a1a',
          4: '#222222',
          5: '#2a2a2a',
        },
        accent: {
          DEFAULT: '#f97316',
          hover: '#fb923c',
          dim: '#c2410c',
        },
        muted: {
          DEFAULT: '#555555',
          hover: '#777777',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        'glow-orange': '0 0 30px rgba(249, 115, 22, 0.2)',
        'glow-sm': '0 0 15px rgba(249, 115, 22, 0.15)',
      },
      animation: {
        'pulse-live': 'pulse-live 2s ease-in-out infinite',
        'spin-slow': 'spin 3s linear infinite',
        'fade-in': 'fade-in 0.3s ease-out',
        'slide-up': 'slide-up 0.3s ease-out',
      },
      keyframes: {
        'pulse-live': {
          '0%, 100%': { opacity: '1', boxShadow: '0 0 8px rgba(249,115,22,0.6)' },
          '50%': { opacity: '0.5', boxShadow: '0 0 16px rgba(249,115,22,0.8)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
