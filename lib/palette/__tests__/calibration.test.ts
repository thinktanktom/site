/**
 * CALIBRATION — the load-bearing test in this suite.
 *
 * The gate table in validate.ts claims to encode *this site's* design rather
 * than a generic WCAG wishlist. The only way to check that claim is to run the
 * three hand-designed shipping themes through it: if funky, dark or light fails
 * a gate, the gate is wrong, not the theme.
 *
 * `checkChroma` is deliberately NOT passed. dark and light are achromatic by
 * design (accent is pure #ffffff / #000000, C = 0.000), so the chroma floor is
 * a generator-only rule — see the comment on ValidateOptions in validate.ts.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { contrast } from '../contrast'
import { toOklch } from '../oklch'
import { TOKEN_NAMES, type Palette, type TokenName } from '../tokens'
import { CHROMA_FLOOR, GATES, validate } from '../validate'
import { SHIPPING_THEMES } from './fixtures'

const THEME_NAMES = ['funky', 'dark', 'light'] as const

describe('the three shipping themes pass the generator gate table', () => {
  for (const name of THEME_NAMES) {
    it(`${name} clears every gate`, () => {
      // The failure objects are readable, so assert on them rather than a
      // boolean: a regression prints which pair missed and by how much.
      expect(validate(SHIPPING_THEMES[name])).toEqual([])
    })
  }

  it('reports the gate each theme comes closest to missing', () => {
    // Not an assertion about a number — it pins the *identity* of the binding
    // constraint. validate.ts says muted/surface is the tightest pair on the
    // site; if that stops being true the comments there are stale.
    const tightest = (tokens: Palette): string => {
      let best = { pair: '', slack: Infinity }
      for (const gate of GATES) {
        const value = contrast(tokens[gate.a], tokens[gate.b])
        const slack = Math.min(
          value - gate.min,
          gate.max === Infinity ? Infinity : gate.max - value,
        )
        if (slack < best.slack) best = { pair: `${gate.a}/${gate.b}`, slack }
      }
      return best.pair
    }

    expect(tightest(SHIPPING_THEMES.funky)).toBe('border/bg')
    expect(tightest(SHIPPING_THEMES.dark)).toBe('grid-dot/bg')
    expect(tightest(SHIPPING_THEMES.light)).toBe('grid-dot/bg')

    // muted/surface is the tightest *informational text* pair, which is the
    // claim validate.ts actually makes; the two window gates sit closer to
    // their bounds but a divider being slightly off is not a legibility bug.
    expect(contrast(SHIPPING_THEMES.funky.muted, SHIPPING_THEMES.funky.surface)).toBeCloseTo(4.78, 2)
  })
})

describe('the chroma floor is generator-only', () => {
  it('passes funky, whose accent is a real hue', () => {
    expect(validate(SHIPPING_THEMES.funky, { checkChroma: true })).toEqual([])
    expect(toOklch(SHIPPING_THEMES.funky.accent).C).toBeGreaterThan(CHROMA_FLOOR)
  })

  for (const name of ['dark', 'light'] as const) {
    it(`fails ${name}, which is achromatic on purpose`, () => {
      // Documents *why* the calibration test above must not pass checkChroma.
      expect(toOklch(SHIPPING_THEMES[name].accent).C).toBeCloseTo(0, 6)
      expect(validate(SHIPPING_THEMES[name], { checkChroma: true })).toEqual([
        { pair: 'accent chroma', value: 0, min: CHROMA_FLOOR, max: Infinity },
      ])
    })
  }
})

describe('the fixtures match the shipping stylesheet', () => {
  // The calibration table is only evidence if it is the same table the site
  // ships. Parsed, not imported, because globals.css is not a module.
  const css = readFileSync(
    fileURLToPath(new URL('../../../src/app/globals.css', import.meta.url)),
    'utf8',
  )

  const block = (selector: string): string => {
    const at = css.indexOf(selector)
    expect(at, `selector ${selector} not found in globals.css`).toBeGreaterThanOrEqual(0)
    const open = css.indexOf('{', at)
    const close = css.indexOf('}', open)
    return css.slice(open + 1, close)
  }

  const parse = (selector: string): Partial<Record<TokenName, number[]>> => {
    const out: Partial<Record<TokenName, number[]>> = {}
    for (const name of TOKEN_NAMES) {
      const m = new RegExp(`--${name}:\\s*(\\d+)\\s+(\\d+)\\s+(\\d+)\\s*;`).exec(block(selector))
      if (m) out[name] = [Number(m[1]), Number(m[2]), Number(m[3])]
    }
    return out
  }

  const SELECTORS: Record<(typeof THEME_NAMES)[number], string> = {
    funky: ':root {',
    dark: "html[data-theme='dark']",
    light: "html[data-theme='light']",
  }

  for (const name of THEME_NAMES) {
    it(`${name}`, () => {
      const parsed = parse(SELECTORS[name])
      // Every token present, so a renamed token cannot pass by being absent.
      expect(Object.keys(parsed).sort()).toEqual([...TOKEN_NAMES].sort())
      for (const token of TOKEN_NAMES) {
        expect(parsed[token], `--${token} in ${name}`).toEqual([...SHIPPING_THEMES[name][token]])
      }
    })
  }
})
