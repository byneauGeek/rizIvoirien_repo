/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        forest: {
          DEFAULT: '#1B4332',
          light: '#2D6A4F',
          dark: '#0D2B1E',
          muted: '#52796F',
        },
        safran: {
          DEFAULT: '#E8A217',
          light: '#F5C842',
          dark: '#C47F00',
          pale: '#FEF3C7',
        },
        cream: '#FDF6E3',
        terra: {
          DEFAULT: '#C4501A',
          light: '#E8714A',
          pale: '#FEE8E0',
        },
        gold: '#D4A853',
        charcoal: '#1A1A1A',
      },
      fontFamily: {
        playfair: ['"Playfair Display"', 'Georgia', 'serif'],
        syne: ['Syne', 'sans-serif'],
        dm: ['"DM Sans"', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'kente': `repeating-linear-gradient(
          45deg,
          rgba(232,162,23,0.07) 0px,
          rgba(232,162,23,0.07) 2px,
          transparent 2px,
          transparent 14px
        ),
        repeating-linear-gradient(
          -45deg,
          rgba(196,80,26,0.05) 0px,
          rgba(196,80,26,0.05) 2px,
          transparent 2px,
          transparent 14px
        )`,
      },
      animation: {
        'float': 'float 5s ease-in-out infinite',
        'float-delayed': 'float 5s ease-in-out 2s infinite',
        'slide-up': 'slideUp 0.6s ease-out forwards',
        'fade-in': 'fadeIn 0.8s ease-out forwards',
        'spin-slow': 'spin 12s linear infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px) rotate(0deg)' },
          '50%': { transform: 'translateY(-12px) rotate(2deg)' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(30px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
      },
      boxShadow: {
        'card': '0 4px 24px rgba(27,67,50,0.10)',
        'card-hover': '0 12px 40px rgba(27,67,50,0.18)',
        'glow': '0 0 40px rgba(232,162,23,0.25)',
      },
    },
  },
  plugins: [],
}
