/**
 * CALIBRATION — the load-bearing test in this suite.
 *
 * The gate table in validate.ts claims to encode *this site's* design rather
 * than a generic WCAG wishlist. The only way to check that claim is to run the
 * three hand-designed palettes through it: if funky, dark or light fails a gate,
 * the gate is wrong, not the palette.
 *
 * Only funky still SHIPS. `dark` and `light` were removed as page themes, so
 * they no longer have a token block in globals.css and there is nothing left to
 * cross-check them against — the stylesheet block at the foot of this file is
 * narrowed to `:root` for that reason. They are kept as REFERENCE palettes
 * because they are the calibration evidence: the two achromatic endpoints that
 * bound the neutral end of the gate table's range. Running them is what shows
 * the gates are not merely tuned to funky. See fixtures.ts.
 *
 * `checkChroma` is deliberately NOT passed. dark and light are achromatic by
 * design (accent is pure #ffffff / #000000), so the chroma floor is a
 * generator-only rule — see the comment on ValidateOptions in validate.ts.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { contrast } from '../contrast'
import { toOklch } from '../oklch'
import { TOKEN_NAMES, type Palette, type TokenName } from '../tokens'
import { CHROMA_FLOOR, GATES, validate } from '../validate'
import { CALIBRATION_PALETTES } from './fixtures'

const PALETTE_NAMES = ['funky', 'dark', 'light'] as const

describe('the three calibration palettes pass the generator gate table', () => {
  for (const name of PALETTE_NAMES) {
    it(`${name} clears every gate`, () => {
      // The failure objects are readable, so assert on them rather than a
      // boolean: a regression prints which pair missed and by how much.
      expect(validate(CALIBRATION_PALETTES[name])).toEqual([])
    })
  }

  it('reports the gate each palette comes closest to missing', () => {
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

    expect(tightest(CALIBRATION_PALETTES.funky)).toBe('border/bg')
    expect(tightest(CALIBRATION_PALETTES.dark)).toBe('grid-dot/bg')
    expect(tightest(CALIBRATION_PALETTES.light)).toBe('grid-dot/bg')

    // muted/surface is the tightest *informational text* pair, which is the
    // claim validate.ts actually makes; the two window gates sit closer to
    // their bounds but a divider being slightly off is not a legibility bug.
    expect(
      contrast(CALIBRATION_PALETTES.funky.muted, CALIBRATION_PALETTES.funky.surface),
    ).toBeCloseTo(4.78, 2)
  })
})

describe('the chroma floor is generator-only', () => {
  it('passes funky, whose accent is a real hue', () => {
    expect(validate(CALIBRATION_PALETTES.funky, { checkChroma: true })).toEqual([])
    expect(toOklch(CALIBRATION_PALETTES.funky.accent).C).toBeGreaterThan(CHROMA_FLOOR)
  })

  for (const name of ['dark', 'light'] as const) {
    it(`fails ${name}, which is achromatic on purpose`, () => {
      // Documents *why* the calibration test above must not pass checkChroma,
      // and why these two palettes are still worth keeping: they are the reason
      // "the accent must not collapse into the text" is a chroma FLOOR and not a
      // contrast gate — as a contrast gate it would reject them outright.
      expect(toOklch(CALIBRATION_PALETTES[name].accent).C).toBeCloseTo(0, 6)
      expect(validate(CALIBRATION_PALETTES[name], { checkChroma: true })).toEqual([
        { pair: 'accent chroma', value: 0, min: CHROMA_FLOOR, max: Infinity },
      ])
    })
  }
})

describe('the funky fixture matches the shipping stylesheet', () => {
  // The calibration table is only evidence if it is the same table the site
  // ships. Parsed, not imported, because globals.css is not a module.
  //
  // funky only: it is the one palette here that still has a token block. dark
  // and light are reference palettes with no stylesheet to agree with, so the
  // describe() blocks above are the whole of what keeps them honest.
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

  it('funky', () => {
    const parsed = parse(':root {')
    // Every token present, so a renamed token cannot pass by being absent.
    expect(Object.keys(parsed).sort()).toEqual([...TOKEN_NAMES].sort())
    for (const token of TOKEN_NAMES) {
      expect(parsed[token], `--${token} in funky`).toEqual([
        ...CALIBRATION_PALETTES.funky[token],
      ])
    }
  })

  it('carries no token block for the removed dark and light themes', () => {
    // The removal itself, asserted. A reinstated block would outrank :root for
    // anyone whose stored ttt-theme is still a stale 'dark' or 'light'.
    expect(css).not.toContain("html[data-theme='dark']")
    expect(css).not.toContain("html[data-theme='light']")
  })
})
