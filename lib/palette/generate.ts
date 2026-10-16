/**
 * generate(seed) -> a complete nine-token palette.
 *
 * One 32-bit seed is the entire state; everything else is derived. That is what
 * makes a palette reproducible, storable as a single integer, and shareable.
 *
 * The constraint set, and what each rule prevents, is documented in CLAUDE.md.
 * Every numeric target here was calibrated by measuring three hand-designed
 * palettes rather than chosen by taste — dark-mono, which ships as the site's
 * default, plus the former funky and light themes, kept as the chromatic and
 * neutral-light ends of the range. See lib/palette/__tests__/fixtures.ts, where
 * all three are asserted to pass the same gates this generator targets.
 */

import { maxChroma, oklch, type Rgb } from './oklch'
import { contrast, solveL, solveNear } from './contrast'
import { pickHarmony, rng, type HarmonyName } from './harmony'
import type { Palette, Polarity } from './tokens'

/**
 * Accent chroma ceiling.
 *
 * funky's #e8ff00 measures C=0.218 and sits at the exact sRGB gamut edge for
 * its hue (C/maxC = 1.00), so "as vivid as the gamut allows" is the brand's
 * actual rule and the gamut is the real cap. This ceiling only bites on
 * wide-gamut hues — green and cyan reach C=0.23-0.27 at accent lightness and
 * would out-saturate the wordmark. 0.24 sits just above funky itself. funky no
 * longer ships (dark-mono replaced it on 2026-10-16) but remains the ONLY
 * evidence for this number, which is why it is kept as a calibration fixture.
 */
export const CHROMA_CEIL = 0.24

/** Weighted toward dark: the default theme is dark, and it is the brand look. */
const DARK_PROBABILITY = 0.72

/**
 * The accent search degrades in stages.
 *
 * Vividness and contrast are in genuine opposition in the tight corners of
 * sRGB: for a cyan-blue accent on a white page, clearing 6.5:1 forces L<=0.46,
 * where max chroma is only 0.083 — no lightness satisfies both. Rather than
 * silently emitting a grey accent (which would defeat the point of an accent),
 * the contrast target drops to WCAG AA to buy chroma, and only then is chroma
 * itself relaxed. Measured: 95% of seeds never leave stage 1.
 */
const ACCENT_STAGES = [
  { bgMin: 6.5, surfaceMin: 6.0, chromaMin: 0.085 },
  // surfaceMin is 4.5, not 4.2, because the accent is rendered as small text
  // directly on --surface (inline code, and the chips/doc-nav items that the
  // random theme routes onto an opaque surface) -- so WCAG AA applies to this
  // pair, not just to accent-on-bg.
  { bgMin: 4.5, surfaceMin: 4.5, chromaMin: 0.085 },
  { bgMin: 4.5, surfaceMin: 4.5, chromaMin: 0 },
] as const

/** `success` keeps a fixed hue: it carries meaning, not the key hue. */
const SUCCESS_HUE = 152

export type GeneratedPalette = {
  seed: number
  keyHue: number
  accentHue: number
  harmony: HarmonyName
  polarity: Polarity
  tokens: Palette
  /** Realised chroma of the accent, for diagnostics and the chroma gate. */
  accentChroma: number
  /** Which ACCENT_STAGES entry produced the accent. 1 is the preferred target. */
  accentStage: 1 | 2 | 3
}

export function generate(seed: number): GeneratedPalette {
  const next = rng(seed)

  const keyHue = next() * 360
  const dark = next() < DARK_PROBABILITY
  const harmony = pickHarmony(next)
  const accentHue = (((keyHue + harmony.offset) % 360) + 360) % 360

  // Neutral hue cast, strongest at mid lightness and fading at both extremes.
  // A *constant* cast makes near-black and near-white look dirty rather than
  // tinted; fading it is what reads as an expensive grey. funky's own neutrals
  // measure C=0.000, so any cast at all is a deliberate departure from it.
  const castMax = 0.01 + next() * 0.012
  const cast = (L: number): number => castMax * (1 - Math.pow(2 * L - 1, 2))
  const neutral = (L: number): Rgb => oklch(L, cast(L), keyHue)

  const bgL = dark ? 0.135 + next() * 0.055 : 0.975 + next() * 0.02
  const bg = neutral(bgL)
  const surface = neutral(bgL + (dark ? 1 : -1) * 0.035)

  // border and grid-dot are solved to a contrast *window*, not offset by a
  // fixed lightness: near white, +0.105 L buys far more contrast than it does
  // near black. Targets sit inside the range the three calibration palettes
  // already occupy (border 1.24-1.48, grid-dot 1.19-1.37).
  const border = neutral(solveNear(1.32, bg, bgL, keyHue, cast, dark))
  const gridDot = neutral(solveNear(1.2, bg, bgL, keyHue, cast, dark))

  const textL = solveL(14, bg, keyHue, cast, dark)
  const text = oklch(textL, cast(textL), keyHue)

  // Solved against SURFACE, not bg: muted-on-surface is the tightest pair on
  // the site (4.78:1 in funky, 5.55:1 in dark-mono), so it is the binding constraint.
  const mutedL = solveL(5, surface, keyHue, cast, dark)
  const muted = oklch(mutedL, cast(mutedL), keyHue)

  let accent: Rgb | null = null
  let accentL = 0
  let accentChroma = 0
  let accentStage: 1 | 2 | 3 = 1

  for (let i = 0; i < ACCENT_STAGES.length; i++) {
    const stage = ACCENT_STAGES[i]
    for (
      let L = dark ? 0.97 : 0.7;
      dark ? L > 0.45 : L > 0.1;
      L -= 0.005
    ) {
      const c = Math.min(maxChroma(L, accentHue) * 0.92, CHROMA_CEIL)
      if (c < stage.chromaMin) continue

      const candidate = oklch(L, c, accentHue)
      if (
        contrast(candidate, bg) >= stage.bgMin &&
        contrast(candidate, surface) >= stage.surfaceMin &&
        c > accentChroma
      ) {
        accentChroma = c
        accentL = L
        accent = candidate
        accentStage = (i + 1) as 1 | 2 | 3
      }
    }
    if (accent) break
  }

  // ACCENT_STAGES ends with no chroma requirement and an AA contrast target, so
  // the loop above always finds a candidate. Narrowing the type, not a fallback.
  if (!accent) {
    throw new Error(`palette: no accent found for seed ${seed}`)
  }

  // accent-dim is the hover shade AND is used as body text, so it cannot just
  // be "accent minus 0.145": for a hue whose accent already sits near the
  // contrast floor, that offset walks straight through 4.5:1. Solve for the
  // floor, then dim as far as it allows; with no room below, brighten instead,
  // which is an equally valid hover.
  const dimChroma = (L: number): number =>
    Math.min(accentChroma, maxChroma(L, accentHue) * 0.92, CHROMA_CEIL)
  const floorL = solveL(4.7, bg, accentHue, dimChroma, dark)
  const wantL = accentL + (dark ? -0.145 : 0.145)
  const dimL = dark
    ? floorL > accentL - 0.04
      ? accentL + 0.09
      : Math.max(wantL, floorL)
    : floorL < accentL + 0.04
      ? accentL - 0.09
      : Math.min(wantL, floorL)
  const accentDim = oklch(dimL, dimChroma(dimL), accentHue)

  // Calibrated to funky's #4ade80 (measured L=0.800 C=0.182 H=152). Kept at that
  // hue after funky stopped shipping: success carries MEANING, not the key hue,
  // so "open to work" must not go red on a red seed -- or grey on a mono default.
  //
  // The solver and the emitter MUST use the same chroma function. They did not:
  // the solver evaluated candidates at a flat 0.182 while the emitter applied
  // the 0.9 gamut margin, so wherever maxChroma fell below 0.202 the colour
  // shipped was not the one whose contrast had been solved -- success/bg missed
  // its 5.5 target on 77.5% of seeds (never by much, and never near the 4.5
  // gate, but wrong for no reason).
  const successChroma = (L: number): number =>
    Math.min(0.182, maxChroma(L, SUCCESS_HUE) * 0.9)
  const successL = solveL(5.5, bg, SUCCESS_HUE, successChroma, dark)
  const success = oklch(successL, successChroma(successL), SUCCESS_HUE)

  return {
    seed,
    keyHue,
    accentHue,
    harmony: harmony.name,
    polarity: dark ? 'dark' : 'light',
    tokens: {
      bg,
      surface,
      border,
      text,
      muted,
      accent,
      'accent-dim': accentDim,
      'grid-dot': gridDot,
      success,
    },
    accentChroma,
    accentStage,
  }
}
