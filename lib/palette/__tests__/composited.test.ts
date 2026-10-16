/**
 * Contrast of ALPHA-COMPOSITED accent utilities.
 *
 * The gate table in validate.ts bounds pairs of solid tokens. It cannot bound
 * `border-accent/40` or `text-accent/80` on `bg-accent/10`, because those are
 * composites of a token against another token, and an alpha on the accent is
 * only as strong as the accent's own contrast.
 *
 * That gap mattered. funky puts the accent at 17-21:1 against bg (it is pure
 * yellow), so 40% alpha still clears the 3:1 non-text UI floor. A GENERATED
 * accent only has to clear 4.5-6.5:1, so the same 40% landed at 1.72:1 -- under
 * the floor on 78.7% of palettes -- and the accent-tinted chip, where both the
 * text and its background move toward the accent, missed WCAG AA on 58.9%.
 *
 * The dark and light entries used below come from CALIBRATION_PALETTES and are
 * no longer page themes; they are kept as the two achromatic reference palettes
 * (see fixtures.ts). Only the [data-theme='random'] rules are read back out of
 * globals.css, because they are the only alpha overrides the site still ships.
 *
 * The fix lives in globals.css, not in the generator, because the generator
 * picks colours and these are composites of one. These tests read the alphas
 * back OUT of globals.css so the stylesheet and this file cannot drift apart.
 */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { generate } from '../generate'
import { contrast } from '../contrast'
import type { Rgb } from '../oklch'
import { CALIBRATION_PALETTES } from './fixtures'

const CSS = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8')

/** How a browser composites a translucent colour: non-premultiplied, gamma space. */
const over = (fg: Rgb, bg: Rgb, alpha: number): Rgb =>
  fg.map((c, i) => Math.round(c * alpha + bg[i] * (1 - alpha))) as unknown as Rgb

/**
 * Pull the alpha the random theme applies to a utility out of the stylesheet.
 * Deliberately anchored on [data-theme='random'] with no polarity: a
 * [data-theme='random'][data-polarity='…'] rule is (0,3,1) and would outrank
 * these (0,2,1) rules, which is a mistake this project has already made once.
 */
function randomAlphaFor(utility: string, token: string): number {
  const escaped = utility.replace('/', '\\\\/')
  const re = new RegExp(
    `html\\[data-theme='random'\\][^{]*\\.${escaped}[^{]*\\{[^}]*rgb\\(var\\(--${token}\\)\\s*/\\s*([0-9.]+)\\)`,
  )
  const m = CSS.match(re)
  if (!m) throw new Error(`no random-theme alpha rule found for .${utility}`)
  return Number.parseFloat(m[1])
}

const SEEDS = Number(process.env.PALETTE_SWEEP_SEEDS ?? 2000)

/* Generated ONCE for the whole file, not per test. generate() costs ~0.45ms, so
   five tests each sweeping their own 20,000 seeds took ~10s apiece and blew
   vitest's 5s default timeout under PALETTE_SWEEP_SEEDS=20000 -- the tests were
   correct and merely too slow. One shared pass keeps the exhaustive run honest
   and well inside the limit. */
const palettes = Array.from({ length: SEEDS }, (_, i) => generate(i + 1))

/** Worst value of `f` over every palette, with the seed that produced it. */
function worstOf(f: (p: (typeof palettes)[number]) => number): { value: number; seed: number } {
  let value = Infinity
  let seed = 0
  for (const p of palettes) {
    const v = f(p)
    if (v < value) {
      value = v
      seed = p.seed
    }
  }
  return { value, seed }
}

/** How many palettes fail `predicate`. */
const countFailing = (predicate: (p: (typeof palettes)[number]) => boolean): number =>
  palettes.reduce((n, p) => n + (predicate(p) ? 1 : 0), 0)

describe('border-accent/40 — the 3:1 non-text UI floor', () => {
  const alpha = randomAlphaFor('border-accent/40', 'accent')

  it('is raised above the Tailwind 0.4 for the random theme', () => {
    expect(alpha).toBeGreaterThan(0.4)
  })

  it(`clears 3:1 against bg on every seed at alpha ${alpha}`, () => {
    const { value, seed } = worstOf((p) =>
      contrast(over(p.tokens.accent, p.tokens.bg, alpha), p.tokens.bg),
    )
    expect(value, `worst at seed ${seed}`).toBeGreaterThanOrEqual(3)
  })

  it('would NOT clear 3:1 at the stock 0.4 — this is why the override exists', () => {
    // A negative control, kept so the override cannot be deleted as redundant.
    const failing = countFailing(
      (p) => contrast(over(p.tokens.accent, p.tokens.bg, 0.4), p.tokens.bg) < 3,
    )
    expect(failing).toBeGreaterThan(palettes.length / 2)
  })

  it('is already fine at 0.4 for a hand-picked accent, which is why the gap hid', () => {
    // funky's accent is pure yellow and the dark reference palette's was pure
    // white -- both far enough from bg that 40% alpha still clears the floor.
    // That is why nobody noticed until the accent started being generated.
    for (const name of ['funky', 'dark'] as const) {
      const theme = CALIBRATION_PALETTES[name]
      const c = contrast(over(theme.accent, theme.bg, 0.4), theme.bg)
      expect(c, name).toBeGreaterThanOrEqual(3)
    }
  })

  it('but a hand-picked accent can miss it too, as the light reference shows', () => {
    // The light reference palette's accent is pure BLACK, so 0.4 over white
    // composites to #999999 -- under the floor. It is the same failure mode as
    // the random theme's, with one hand-picked accent instead of a generated
    // one, which is why this palette is worth keeping as a reference.
    //
    // This used to additionally parse the html[data-theme='light'] /40 -> /55
    // nudge out of globals.css. That rule was DELETED along with the light page
    // theme -- it was keyed on the theme, not on data-polarity, so nothing could
    // match it any more. The arithmetic below is the part that was load-bearing,
    // so it stays; the stylesheet assertion had nothing left to assert.
    const { accent, bg } = CALIBRATION_PALETTES.light
    expect(contrast(over(accent, bg, 0.4), bg)).toBeLessThan(3)
    // and the alpha the random theme now applies would have rescued it
    expect(
      contrast(over(accent, bg, randomAlphaFor('border-accent/40', 'accent')), bg),
    ).toBeGreaterThanOrEqual(3)
  })
})

describe('the accent-tinted chip — WCAG AA on small text', () => {
  it('routes bg-accent/10 onto an opaque surface in the random theme', () => {
    expect(CSS).toMatch(
      /html\[data-theme='random'\]\s+\.bg-accent\\\/10\s*\{[^}]*background-color:\s*rgb\(var\(--surface\)\)/,
    )
  })

  it('makes text-accent/80 solid in the random theme', () => {
    expect(CSS).toMatch(
      /html\[data-theme='random'\]\s+\.text-accent\\\/80\s*\{[^}]*color:\s*rgb\(var\(--accent\)\)/,
    )
  })

  it('so the pair reduces to accent-on-surface, which is gated at AA', () => {
    // ACCENT_STAGES solves for this, so it is AA by construction, not by luck.
    const { value, seed } = worstOf((p) => contrast(p.tokens.accent, p.tokens.surface))
    expect(value, `worst at seed ${seed}`).toBeGreaterThanOrEqual(4.5)
  })

  it('the untinted original would have missed AA on most seeds', () => {
    // Negative control: text-accent/80 over bg-accent/10, as Tailwind renders it.
    const failing = countFailing((p) => {
      const chipBg = over(p.tokens.accent, p.tokens.bg, 0.1)
      return contrast(over(p.tokens.accent, chipBg, 0.8), chipBg) < 4.5
    })
    expect(failing).toBeGreaterThan(palettes.length / 4)
  })
})

describe('decorative accent borders', () => {
  it('keeps /30 and success/40 roughly where funky already sits', () => {
    // These outline chips that always carry an icon AND a text label, and they
    // are already under 3:1 in funky itself, so they are not held to the UI
    // floor. The nudge exists only so a random palette is not arbitrarily
    // fainter than funky, whose /30 measures 2.44:1.
    const alpha30 = randomAlphaFor('border-accent/30', 'accent')
    const funky30 = contrast(
      over(CALIBRATION_PALETTES.funky.accent, CALIBRATION_PALETTES.funky.bg, 0.3),
      CALIBRATION_PALETTES.funky.bg,
    )
    const { value } = worstOf((p) =>
      contrast(over(p.tokens.accent, p.tokens.bg, alpha30), p.tokens.bg),
    )
    expect(value).toBeGreaterThan(funky30 - 0.6)
  })
})
