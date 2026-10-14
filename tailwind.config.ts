import type { Config } from 'tailwindcss';

/** Design tokens — "paper-cut diorama at dusk". See ARCHITECTURE.md › Design system. */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    screens: { xs: '380px', sm: '640px', md: '768px', lg: '1024px', xl: '1280px' },
    extend: {
      colors: {
        night: { DEFAULT: '#1b1446', 700: '#241a5c', 600: '#2d2470', 500: '#3b3190', 400: '#5a50b5' },
        lantern: { DEFAULT: '#ffc94a', dark: '#d99a12', light: '#ffe39a' },
        berry: { DEFAULT: '#e2447a', dark: '#a8285a', light: '#ff9fbf' },
        lagoon: { DEFAULT: '#2ec4b6', dark: '#1b8c82', light: '#a5f0e8' },
        paper: { DEFAULT: '#fff6e3', dark: '#f0dfbd', edge: '#e6cf9f' },
        moss: { DEFAULT: '#7cc96a', dark: '#4f9a40' },
        sky: { DEFAULT: '#6ec3ff', dark: '#3a8fd0' },
        ink: { DEFAULT: '#241c4f', soft: '#5b5482', faint: '#8d87ad' },
      },
      fontFamily: {
        kid: ['Grandstander', '"Baloo Bhaijaan 2"', 'ui-rounded', 'system-ui', 'sans-serif'],
        read: ['"Atkinson Hyperlegible"', '"Baloo Bhaijaan 2"', 'system-ui', 'sans-serif'],
        dyslexic: ['Lexend', '"Baloo Bhaijaan 2"', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        // modular scale 1.25, rounded to whole pixels
        'kid-sm': ['1rem', { lineHeight: '1.35' }],
        'kid-base': ['1.25rem', { lineHeight: '1.35' }],
        'kid-lg': ['1.5625rem', { lineHeight: '1.25' }],
        'kid-xl': ['1.953rem', { lineHeight: '1.15' }],
        'kid-2xl': ['2.441rem', { lineHeight: '1.1' }],
        'kid-3xl': ['3.052rem', { lineHeight: '1.05' }],
      },
      borderRadius: { blob: '2rem', token: '1.25rem', tab: '0.75rem' },
      boxShadow: {
        // solid "cut paper" offsets instead of blurry drop shadows
        paper: '0 6px 0 0 #e6cf9f',
        'paper-sm': '0 3px 0 0 #e6cf9f',
        lantern: '0 6px 0 0 #d99a12',
        berry: '0 6px 0 0 #a8285a',
        lagoon: '0 6px 0 0 #1b8c82',
        night: '0 6px 0 0 #120d33',
        glow: '0 0 0 6px rgba(255,201,74,0.25), 0 0 40px 8px rgba(255,201,74,0.45)',
        focus: '0 0 0 4px #ffffff, 0 0 0 8px #2ec4b6',
      },
      transitionTimingFunction: { bounce: 'cubic-bezier(.34,1.56,.64,1)' },
      keyframes: {
        bob: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-8px)' } },
        wiggle: { '0%,100%': { transform: 'rotate(-6deg)' }, '50%': { transform: 'rotate(6deg)' } },
        twinkle: { '0%,100%': { opacity: '0.25' }, '50%': { opacity: '1' } },
        drift: { from: { transform: 'translateX(-10%)' }, to: { transform: 'translateX(110vw)' } },
        rise: { from: { transform: 'translateY(110%)' }, to: { transform: 'translateY(-30%)' } },
        pulseRing: { '0%': { transform: 'scale(1)', opacity: '0.6' }, '100%': { transform: 'scale(1.6)', opacity: '0' } },
      },
      animation: {
        bob: 'bob 3s ease-in-out infinite',
        wiggle: 'wiggle 0.6s ease-in-out infinite',
        twinkle: 'twinkle 2.4s ease-in-out infinite',
        drift: 'drift 40s linear infinite',
        'pulse-ring': 'pulseRing 1.6s ease-out infinite',
      },
    },
  },
  plugins: [],
};
export default config;
