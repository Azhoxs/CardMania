import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Neutres : un gris très légèrement bleuté, texte quasi noir
        ink: {
          50: '#f4f5f7',
          100: '#e9ebf0',
          200: '#d8dbe3',
          300: '#b9bece',
          400: '#8a92a6',
          500: '#5b6478',
          700: '#2a3144',
          900: '#0b1020',
        },
        // Bleu cobalt : l'action principale
        brand: {
          50: '#eef1ff',
          100: '#dde3ff',
          500: '#2b4eff',
          600: '#1f3be0',
          700: '#182fb3',
        },
        // Jaune : repère des cartes Pokémon
        sun: {
          100: '#fff3c4',
          400: '#ffcf33',
          600: '#a87b00',
        },
        // Vert : XP, progression, bonnes nouvelles
        mint: {
          100: '#d9f7e8',
          400: '#2fd48a',
          500: '#12b76a',
          700: '#0b7a47',
        },
        pink: {
          100: '#ffe0ea',
          400: '#ff6b9a',
          600: '#d92f6b',
        },
        danger: {
          50: '#fdecef',
          500: '#d92d4a',
          600: '#b81f3a',
        },
      },
      fontFamily: {
        sans: ['var(--font-body)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'var(--font-body)', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        // Coins d'une vraie carte (63 × 88 mm)
        card: '6% / 4.3%',
      },
      boxShadow: {
        card: '0 1px 2px rgba(11,16,32,0.10), 0 10px 24px -10px rgba(11,16,32,0.35)',
        lift: '0 2px 4px rgba(11,16,32,0.10), 0 22px 40px -14px rgba(11,16,32,0.40)',
        bar: '0 -1px 0 rgba(11,16,32,0.06), 0 -12px 32px -12px rgba(11,16,32,0.12)',
        sheet: '0 -10px 50px -10px rgba(11,16,32,0.35)',
        fab: '0 12px 28px -8px rgba(43,78,255,0.65)',
        // Ombre « dure » façon interface de jeu
        chunk: '0 4px 0 rgba(11,16,32,0.10)',
      },
    },
  },
  plugins: [],
}
export default config
