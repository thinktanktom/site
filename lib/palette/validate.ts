/**
 * The gate table: every contrast pair that actually occurs on the site.
 *
 * These are not aspirations. Each floor was set by measuring the three
 * hand-designed palettes and taking a value they all clear, which is why the
 * calibration test (funky, dark and light must all pass this table) is the
 * strongest available evidence that the gates encode this site's design rather
 * than a guess. Only dark (shipping as dark-mono) is a page theme now.
 */

import { toOklch, type Rgb } from './oklch'
import { contrast } from './contrast'
import type { Palette, TokenName } from './tokens'

export type Gate = {
  a: TokenName
  b: TokenName
  /** What the pair is used for on the site. */
  role: string
  min: number
  /** Some pairs need a ceiling as well — see the note on border and grid-dot. */
  max: number
}

export const GATES: readonly Gate[] = [
  { a: 'text', b: 'bg', role: 'body copy on the page', min: 14, max: Infinity },
  { a: 'text', b: 'surface', role: 'body copy on a card', min: 12, max: Infinity },
  { a: 'muted', b: 'bg', role: 'metadata, excerpts', min: 4.5, max: Infinity },
  // The tightest informational pair on the site: 5.55:1 in dark-mono, and it was
  // 4.78:1 in funky, which is the measurement this 4.5 floor was set from.
  { a: 'muted', b: 'surface', role: 'metadata on a card', min: 4.5, max: Infinity },
  // WCAG AA is the hard floor. The staged search in generate() *prefers* 6.5:1
  // and degrades to this only where chroma and contrast genuinely oppose.
  { a: 'accent', b: 'bg', role: 'hero name, links, inline code', min: 4.5, max: Infinity },
  { a: 'accent', b: 'surface', role: 'inline code, chips, doc nav', min: 4.5, max: Infinity },
  { a: 'accent-dim', b: 'bg', role: 'hover state, also used as text', min: 4.5, max: Infinity },
  { a: 'success', b: 'bg', role: 'open-to-work status chip', min: 4.5, max: Infinity },
  // Windows, not floors. A floor alone lets a divider become a stripe and the
  // hero dot texture become noise; both want to be only just perceptible.
  { a: 'border', b: 'bg', role: 'dividers and card edges', min: 1.14, max: 2.0 },
  { a: 'grid-dot', b: 'bg', role: 'hero pixel-grid texture', min: 1.08, max: 1.55 },
]

/**
 * An accent must stay an ACCENT: chromatic enough to read as a colour rather
 * than as another neutral. 0.055 is the floor sRGB allows for a dark cyan-blue
 * on a white page; every other hue lands far above it.
 *
 * Deliberately NOT a contrast gate against --text. funky's yellow against its
 * off-white measures 1.02:1 — near-identical in luminance, obviously distinct
 * by hue — so a luminance test here would reject the brand's own palette.
 */
export const CHROMA_FLOOR = 0.055

export type Failure = {
  pair: string
  value: number
  min: number
  max: number
}

export type ValidateOptions = {
  /**
   * Check the accent chroma floor. Generator-only: the `dark` and `light`
   * calibration palettes are deliberately achromatic (accent is pure #ffffff /
   * #000000), so this must not run against the calibration set.
   */
  checkChroma?: boolean
}

/** Returns every gate the palette misses. Empty array means it passes. */
export function validate(
  tokens: Palette,
  { checkChroma = false }: ValidateOptions = {},
): Failure[] {
  const failures: Failure[] = []

  for (const { a, b, min, max } of GATES) {
    const value = contrast(tokens[a], tokens[b])
    if (value < min || value > max) {
      failures.push({ pair: `${a}/${b}`, value: round(value), min, max })
    }
  }

  if (checkChroma) {
    const c = toOklch(tokens.accent).C
    if (c < CHROMA_FLOOR) {
      failures.push({
        pair: 'accent chroma',
        value: round(c, 3),
        min: CHROMA_FLOOR,
        max: Infinity,
      })
    }
  }

  return failures
}

const round = (n: number, places = 2): number =>
  Math.round(n * 10 ** places) / 10 ** places

/** Convenience for tests and the roller: generate-and-check in one step. */
export const isValid = (tokens: Palette, options?: ValidateOptions): boolean =>
  validate(tokens, options).length === 0

export type { Rgb }
