import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: '#0a0a0a',
        surface: '#111111',
        border: '#222222',
        text: '#f0f0f0',
        muted: '#666666',
        accent: '#e8ff00',
        'accent-dim': '#b8cc00',
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
