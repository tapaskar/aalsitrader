/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#080810',
        card: '#13132a',
        'card-hover': '#1e1e3a',
        border: '#3a3a5c',
        
        // Agent colors
        alpha: '#ff6b6b',
        beta: '#4ecdc4',
        gamma: '#a855f7',
        theta: '#f97316',
        delta: '#3b82f6',
        sigma: '#10b981',
        
        // Status colors
        active: '#00d4aa',
        sleeping: '#6b7280',
        warning: '#f59e0b',
        danger: '#ef4444',
        
        // Accent
        accent: '#00d4ff',
      },
      fontFamily: {
        mono: ['Fira Code', 'Monaco', 'Consolas', 'monospace'],
        sans: ['Inter', 'SF Pro Display', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'slide-in': 'slideIn 0.3s ease-out',
        'fade-in': 'fadeIn 0.2s ease-out',
        'typing': 'typing 1.4s infinite',
      },
      keyframes: {
        slideIn: {
          '0%': { transform: 'translateX(-20px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        typing: {
          '0%, 60%, 100%': { transform: 'translateY(0)' },
          '30%': { transform: 'translateY(-4px)' },
        },
      },
    },
  },
  plugins: [],
}
