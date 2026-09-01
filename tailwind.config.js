/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        cyber: {
          bg: '#080b11',
          surface: '#0d131f',
          elevated: '#131c2d',
          card: '#0f172a',
          border: '#1e293b',
          'border-bright': '#334155',
          cyan: '#00f0ff',
          'cyan-dim': 'rgba(0, 240, 255, 0.15)',
          purple: '#a855f7',
          violet: '#8b5cf6',
          emerald: '#10b981',
          amber: '#f59e0b',
          rose: '#f43f5e',
          terminal: '#05070a'
        }
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', 'monospace'],
        sans: ['"Space Grotesk"', '"Inter"', 'sans-serif'],
        display: ['"Space Grotesk"', 'sans-serif'],
      },
      boxShadow: {
        'neon-cyan': '0 0 15px rgba(0, 240, 255, 0.45), 0 0 30px rgba(0, 240, 255, 0.2)',
        'neon-purple': '0 0 15px rgba(168, 85, 247, 0.45), 0 0 30px rgba(168, 85, 247, 0.2)',
        'neon-emerald': '0 0 15px rgba(16, 185, 129, 0.45), 0 0 30px rgba(16, 185, 129, 0.2)',
        'neon-rose': '0 0 15px rgba(244, 63, 94, 0.45), 0 0 30px rgba(244, 63, 94, 0.2)',
        'hologram': '0 8px 32px 0 rgba(0, 240, 255, 0.15), inset 0 0 0 1px rgba(0, 240, 255, 0.25)',
        'hud-glow': 'inset 0 0 20px rgba(0, 240, 255, 0.08), 0 4px 24px rgba(0, 0, 0, 0.8)',
      },
      animation: {
        'scanline': 'scanline 2.5s linear infinite',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'radar-sweep': 'radarSweep 4s linear infinite',
        'sheen': 'sheen 3s ease infinite',
        'badge-float': 'badgeFloat 6s ease-in-out infinite',
      },
      keyframes: {
        scanline: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(1000%)' },
        },
        radarSweep: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        sheen: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        badgeFloat: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-6px)' },
        },
      },
    },
  },
  plugins: [],
};
