import type { Config } from 'tailwindcss';

/** Tailwind config for the DOS web app — no design tokens defined yet (Fase 5 UX work). */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {},
  },
  plugins: [],
} satisfies Config;
