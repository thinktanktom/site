/**
 * The DOM side of the palette engine: write tokens onto an element, and cache
 * the resolved result so the pre-paint script can restore it without running
 * the engine.
 *
 * Kept separate from ./index so the engine itself stays environment-free.
 */

import { TOKEN_NAMES, type Palette, type Polarity } from './tokens'
import type { GeneratedPalette } from './generate'

export const THEME_KEY = 'ttt-theme'
export const SEED_KEY = 'ttt-seed'
export const PALETTE_KEY = 'ttt-palette'
export const VERSION_KEY = 'ttt-palette-v'

/**
 * Bump this whenever a change to the engine would make a cached palette differ
 * from what the same seed now produces. The pre-paint script refuses a cache
 * written by a different version and falls through to funky, which is corrected
 * from the seed after hydration — one frame of funky, once, after such a deploy.
 * Trusting a stale cache instead would be worse: it would pin readers to a
 * palette the engine no longer generates.
 */
export const ENGINE_VERSION = '2'

/** The serialised shape in localStorage. Values are "R G B" channel triples. */
export type CachedPalette = Record<string, string> & { polarity: Polarity }

/** `[13, 16, 18]` -> `"13 16 18"`, the form the CSS custom properties take. */
const triple = (rgb: readonly number[]): string => rgb.join(' ')

/**
 * Write the nine tokens as inline custom properties, plus `color-scheme` so the
 * browser's own form controls and scrollbars match the palette rather than
 * fighting it.
 */
export function applyPalette(
  tokens: Palette,
  polarity: Polarity,
  el: HTMLElement = document.documentElement,
): void {
  for (const name of TOKEN_NAMES) {
    el.style.setProperty(`--${name}`, triple(tokens[name]))
  }
  el.style.setProperty('color-scheme', polarity)
  // Published as an attribute as well as a property because CSS has to branch
  // on it: the Shiki token set and the light-polarity accent-border nudges in
  // globals.css cannot be selected by a generated colour, only by this.
  el.setAttribute('data-polarity', polarity)
}

/**
 * Remove every property applyPalette set.
 *
 * Required when switching back to funky: inline styles beat the stylesheet, so
 * leaving them in place would pin funky to the last random palette.
 */
export function clearPalette(el: HTMLElement = document.documentElement): void {
  for (const name of TOKEN_NAMES) {
    el.style.removeProperty(`--${name}`)
  }
  el.style.removeProperty('color-scheme')
  el.removeAttribute('data-polarity')
}

/** Serialise a generated palette into the cache shape. */
export function toCache(palette: GeneratedPalette): CachedPalette {
  const out: Record<string, string> = {}
  for (const name of TOKEN_NAMES) {
    out[name] = triple(palette.tokens[name])
  }
  out.polarity = palette.polarity
  return out as CachedPalette
}

/**
 * Persist the palette: the seed is the source of truth, the resolved tokens are
 * the pre-paint cache, and the version stamp is what makes the cache safe.
 *
 * All writes are wrapped: localStorage throws outright in some privacy modes,
 * and a palette that cannot be persisted should still apply for this session.
 */
export function persistPalette(palette: GeneratedPalette): void {
  try {
    localStorage.setItem(THEME_KEY, 'random')
    localStorage.setItem(SEED_KEY, String(palette.seed))
    localStorage.setItem(PALETTE_KEY, JSON.stringify(toCache(palette)))
    localStorage.setItem(VERSION_KEY, ENGINE_VERSION)
  } catch {
    // no-op: the palette is already applied to the document
  }
}

/** Read the stored seed, or null if absent or unusable. */
export function readSeed(): number | null {
  try {
    const raw = localStorage.getItem(SEED_KEY)
    if (!raw) return null
    const n = Number.parseInt(raw, 10)
    return Number.isFinite(n) && n > 0 ? n : null
  } catch {
    return null
  }
}

/** A seed in the range the generator and the PRNG both handle. */
export const randomSeed = (): number =>
  1 + Math.floor(Math.random() * 2147483646)
