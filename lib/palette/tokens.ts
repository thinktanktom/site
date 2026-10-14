/** The nine theme tokens, in the order globals.css declares them. */
export const TOKEN_NAMES = [
  'bg',
  'surface',
  'border',
  'text',
  'muted',
  'accent',
  'accent-dim',
  'grid-dot',
  'success',
] as const

export type TokenName = (typeof TOKEN_NAMES)[number]

/** A complete palette: every token, as sRGB bytes. */
export type Palette = Record<TokenName, import('./oklch').Rgb>

export type Polarity = 'dark' | 'light'
