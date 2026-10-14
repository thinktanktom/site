/**
 * Contrast of ALPHA-COMPOSITED accent utilities.
 *
 * The gate table in validate.ts bounds pairs of solid tokens. It cannot bound
 * `border-accent/40` or `text-accent/80` on `bg-accent/10`, because those are
 * composites of a token against another token, and an alpha on the accent is
 * only as strong as the accent's own contrast.
 *
 * That gap mattered. funky, dark and light put the accent at 17-21:1 against bg
 * (pure yellow, white or black), so 40% alpha still clears the 3:1 non-text UI
 * floor. A GENERATED accent only has to clear 4.5-6.5:1, so the same 40% landed
 * at 1.72:1 -- under the floor on 78.7% of palettes -- and the accent-tinted
 * chip, where both the text and its background move toward the accent, missed
 * WCAG AA on 58.9%.
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
import { SHIPPING_THEMES } from './fixtures'

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

  it('is already fine at 0.4 in funky and dark, which is why the gap hid', () => {
    // Their accents are pure yellow and pure white, far enough from bg that 40%
    // alpha still clears the floor.
    for (const name of ['funky', 'dark'] as const) {
      const theme = SHIPPING_THEMES[name]
      const c = contrast(over(theme.accent, theme.bg, 0.4), theme.bg)
      expect(c, name).toBeGreaterThanOrEqual(3)
    }
  })

  it('needed a nudge in the light theme too, for the same reason', () => {
    // light's accent is pure BLACK, so 0.4 over white composites to #999999 =
    // 2.85:1 -- under the floor. That is what the pre-existing light /55 rule
    // is for, and it is the same failure mode as the random theme's, just with
    // one hand-picked accent instead of a generated one.
    const { accent, bg } = SHIPPING_THEMES.light
    expect(contrast(over(accent, bg, 0.4), bg)).toBeLessThan(3)

    const m = CSS.match(
      /html\[data-theme='light'\][^{]*\.border-accent\\\/40[^{]*\{[^}]*rgb\(var\(--accent\)\s*\/\s*([0-9.]+)\)/,
    )
    expect(m, 'light theme should carry its own /40 nudge').toBeTruthy()
    const lightAlpha = Number.parseFloat(m![1])
    expect(contrast(over(accent, bg, lightAlpha), bg)).toBeGreaterThanOrEqual(3)
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
    // are already under 3:1 in all three shipping themes, so they are not held
    // to the UI floor. The nudge exists only so a random palette is not
    // arbitrarily fainter than funky, whose /30 measures 2.44:1.
    const alpha30 = randomAlphaFor('border-accent/30', 'accent')
    const funky30 = contrast(
      over(SHIPPING_THEMES.funky.accent, SHIPPING_THEMES.funky.bg, 0.3),
      SHIPPING_THEMES.funky.bg,
    )
    const { value } = worstOf((p) =>
      contrast(over(p.tokens.accent, p.tokens.bg, alpha30), p.tokens.bg),
    )
    expect(value).toBeGreaterThan(funky30 - 0.6)
  })
})
