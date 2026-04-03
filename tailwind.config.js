/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'bjj-bg': '#11161f',
        'bjj-surface': '#161d29',
        'bjj-panel': '#1c2432',
        'bjj-card': '#20293a',
        'bjj-border': '#313d54',
        'bjj-orange': '#c56b46',
        'bjj-orange-dark': '#8c4a2f',
        'bjj-orange-light': '#de8a61',
        'bjj-gold': '#d4875f',
        'bjj-coal': '#10151f',
        'bjj-text': '#eef2f8',
        'bjj-muted': '#9aa7bd',
        'bjj-green': '#22c55e',
        'bjj-locked': '#374151',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Inter', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'hero-gradient': 'radial-gradient(circle at top, rgba(212,135,95,0.12), transparent 28%), linear-gradient(180deg, #151b27 0%, #10151f 100%)',
        'orange-glow': 'radial-gradient(ellipse at center, rgba(197,107,70,0.12) 0%, transparent 72%)',
        'card-gradient': 'linear-gradient(135deg, #20293a 0%, #161d29 100%)',
        'mat-texture': 'linear-gradient(0deg, rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)',
      },
      boxShadow: {
        'orange-glow': '0 0 20px rgba(197,107,70,0.2), 0 0 40px rgba(212,135,95,0.1)',
        'orange-glow-sm': '0 0 10px rgba(197,107,70,0.18)',
        'card': '0 12px 36px rgba(0,0,0,0.28)',
      },
      animation: {
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'slide-up': 'slideUp 0.5s ease-out',
        'fade-in': 'fadeIn 0.3s ease-out',
      },
      keyframes: {
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 10px rgba(249,115,22,0.2)' },
          '50%': { boxShadow: '0 0 25px rgba(249,115,22,0.5), 0 0 50px rgba(249,115,22,0.2)' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
