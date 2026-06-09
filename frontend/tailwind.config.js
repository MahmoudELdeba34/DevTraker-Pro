/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./src/**/*.{html,ts}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          base:     'var(--color-bg-base)',
          surface:  'var(--color-bg-surface)',
          elevated: 'var(--color-bg-elevated)',
          hover:    'var(--color-bg-hover)',
        },
        accent: {
          DEFAULT: 'var(--color-accent-primary, #6366F1)',
          hover:   'var(--color-accent-hover, #818CF8)',
          subtle:  'var(--color-accent-subtle, rgba(99,102,241,0.12))',
          soft:    'rgba(99,102,241,0.18)',
        },
        border: {
          DEFAULT: 'var(--color-border)',
          strong:  'var(--color-border-strong)',
        },
        text: {
          primary:   'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted:     'var(--text-muted)',
          faint:     'rgba(255,255,255,0.28)',
        },
        success: 'var(--color-success, #22C55E)',
        warning: 'var(--color-warning, #F59E0B)',
        danger:  'var(--color-danger, #EF4444)',
        info:    'var(--color-info, #38BDF8)',
      },
      fontFamily: {
        display: ['Syne', 'Cairo', 'sans-serif'],
        body:    ['DM Sans', 'Cairo', 'sans-serif'],
        mono:    ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'shimmer':       'shimmer 1.5s infinite',
        'slide-up':      'slideUp 200ms ease-out both',
        'slide-down':    'slideDown 220ms ease-out both',
        'slide-right':   'slideRight 250ms ease-out both',
        'fade-in':       'fadeIn 150ms ease-out both',
        'fade-up':       'fadeUp 300ms cubic-bezier(0.16, 1, 0.3, 1) both',
        'scale-in':      'scaleIn 180ms cubic-bezier(0.16, 1, 0.3, 1) both',
        'bounce-dot':    'bounceDot 0.4s ease',
        'pulse-glow':    'pulseGlow 2s ease-in-out infinite',
        'spin-slow':     'spin 3s linear infinite',
        'gradient-pan':  'gradientPan 8s ease infinite',
        'count-up':      'countUp 600ms cubic-bezier(0.16, 1, 0.3, 1) both',
        'tab-swap':      'tabSwap 220ms cubic-bezier(0.16, 1, 0.3, 1) both',
      },
      keyframes: {
        shimmer:    { '0%,100%': { opacity: '0.5' }, '50%': { opacity: '1' } },
        slideUp:    { from: { opacity: '0', transform: 'translateY(8px)' },  to: { opacity: '1', transform: 'translateY(0)' } },
        slideDown:  { from: { opacity: '0', transform: 'translateY(-8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        slideRight: { from: { opacity: '0', transform: 'translateX(-12px)' }, to: { opacity: '1', transform: 'translateX(0)' } },
        fadeIn:     { from: { opacity: '0' }, to: { opacity: '1' } },
        fadeUp:     { from: { opacity: '0', transform: 'translateY(14px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        scaleIn:    { from: { opacity: '0', transform: 'scale(0.95)' }, to: { opacity: '1', transform: 'scale(1)' } },
        bounceDot:  { '0%,100%': { transform: 'scale(1)' }, '50%': { transform: 'scale(1.4)' } },
        pulseGlow:  {
          '0%,100%': { boxShadow: '0 0 0 0 rgba(99,102,241,0.45)' },
          '50%':     { boxShadow: '0 0 0 8px rgba(99,102,241,0)' },
        },
        gradientPan: {
          '0%,100%': { backgroundPosition: '0% 50%' },
          '50%':     { backgroundPosition: '100% 50%' },
        },
        countUp: { from: { opacity: '0', transform: 'translateY(6px) scale(0.96)' }, to: { opacity: '1', transform: 'translateY(0) scale(1)' } },
        tabSwap: { from: { opacity: '0', transform: 'translateY(4px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
      },
      boxShadow: {
        card:        '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.08)',
        modal:       '0 25px 50px rgba(0,0,0,0.18)',
        glow:        '0 0 20px rgba(99,102,241,0.25)',
        'glow-soft': '0 0 30px rgba(99,102,241,0.12)',
        'glow-lg':   '0 8px 32px rgba(99,102,241,0.28)',
      },
      backgroundImage: {
        'accent-gradient':   'linear-gradient(135deg, #6366F1 0%, #8b5cf6 100%)',
        'surface-gradient':  'linear-gradient(180deg, rgba(99,102,241,0.04) 0%, transparent 60%)',
      },
    },
  },
  plugins: [],
}
