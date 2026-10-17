import type { Config } from 'tailwindcss'

// Tokens live in src/app/globals.css as space-separated RGB channel triples so
// the <alpha-value> placeholder keeps opacity modifiers (bg-accent/10) working.
const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`

const config: Config = {
  // This project is App Router with src/, and components/ at the repo root.
  // Globs for ./src/pages, ./src/components and ./app were carried over from the
  // create-next-app default and match nothing here.
  content: [
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: token('bg'),
        surface: token('surface'),
        border: token('border'),
        text: token('text'),
        muted: token('muted'),
        accent: token('accent'),
        'accent-dim': token('accent-dim'),
        'grid-dot': token('grid-dot'),
        success: token('success'),
      },
      fontFamily: {
        mono: ['var(--font-space-mono)', 'ui-monospace', 'monospace'],
        sans: ['var(--font-dm-sans)', 'ui-sans-serif', 'sans-serif'],
      },
      maxWidth: {
        article: '780px',
        chrome: '1100px',
      },
    },
  },
  plugins: [],
}

export default config
