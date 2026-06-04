/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./src/**/*.{html,ts}",
  ],
  theme: {
    extend: {
      colors: {
        bg: { base: '#0A0B0F', surface: '#111318', elevated: '#1A1D26', hover: '#1F2230' },
        accent: { DEFAULT: '#6366F1', hover: '#818CF8', subtle: 'rgba(99,102,241,0.12)' },
        border: { DEFAULT: 'rgba(255,255,255,0.07)', strong: 'rgba(255,255,255,0.14)' },
        success: '#22C55E',
        warning: '#F59E0B',
        danger: '#EF4444',
        info: '#38BDF8',
      },
      fontFamily: {
        display: ['Syne', 'sans-serif'],
        body:    ['DM Sans', 'sans-serif'],
        mono:    ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'shimmer':     'shimmer 1.5s infinite',
        'slide-up':    'slideUp 200ms ease-out',
        'slide-right': 'slideRight 250ms ease-out',
        'fade-in':     'fadeIn 150ms ease-out',
        'scale-in':    'scaleIn 150ms ease-out',
        'bounce-dot':  'bounceDot 0.4s ease',
      },
      keyframes: {
        shimmer:    { '0%,100%': { opacity: 0.5 }, '50%': { opacity: 1 } },
        slideUp:    { from: { opacity: 0, transform: 'translateY(8px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        slideRight: { from: { opacity: 0, transform: 'translateX(-12px)' }, to: { opacity: 1, transform: 'translateX(0)' } },
        fadeIn:     { from: { opacity: 0 }, to: { opacity: 1 } },
        scaleIn:    { from: { opacity: 0, transform: 'scale(0.95)' }, to: { opacity: 1, transform: 'scale(1)' } },
        bounceDot:  { '0%,100%': { transform: 'scale(1)' }, '50%': { transform: 'scale(1.4)' } },
      },
      boxShadow: {
        card:  '0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.3)',
        modal: '0 25px 50px rgba(0,0,0,0.6)',
        glow:  '0 0 20px rgba(99,102,241,0.25)',
      },
    },
  },
  plugins: [],
}
