/**
 * oklch.ts — the colour-space primitives everything else is built on.
 *
 * Three invariants matter here:
 *   1. oklch() can never emit a non-colour (NaN, a channel outside 0..255, a
 *      fraction). Every token on the page comes out of this function.
 *   2. Out-of-gamut requests are answered by *reducing chroma along the hue
 *      ray*, not by clipping channels — clipping shifts hue, which is the whole
 *      reason this module exists.
 *   3. toOklch() inverts oklch() closely enough to be used for calibration.
 */

import { describe, expect, it } from 'vitest'

import { hex, maxChroma, oklch, toOklch, type Rgb } from '../oklch'

/** Smallest angular distance between two hues, in degrees. */
const hueDelta = (a: number, b: number): number => Math.abs(((a - b + 540) % 360) - 180)

const lightnesses = (from: number, to: number, step: number): number[] => {
  const out: number[] = []
  for (let L = from; L <= to + 1e-9; L += step) out.push(Number(L.toFixed(4)))
  return out
}

describe('oklch() never emits a non-colour', () => {
  it('holds across a dense L/C/H sweep, including out-of-gamut chroma', () => {
    // C = 0.3 and 0.4 are outside sRGB at every hue, which is the interesting
    // case: the function must answer with a real colour, not NaN or a clip.
    //
    // Violations are collected rather than asserted inside the loop: a quarter
    // of a million expect() calls costs seconds, and a collected list reports
    // every bad sample instead of only the first.
    const bad: string[] = []
    let samples = 0

    for (const L of lightnesses(0, 1, 0.02)) {
      for (let H = 0; H < 360; H += 5) {
        for (const C of [0, 0.02, 0.05, 0.1, 0.2, 0.3, 0.4]) {
          const rgb = oklch(L, C, H)
          samples++
          const at = `L=${L} C=${C} H=${H}`
          if (rgb.length !== 3) bad.push(`${at}: not a triple`)
          for (const channel of rgb) {
            if (!Number.isFinite(channel)) bad.push(`${at}: non-finite ${channel}`)
            else if (!Number.isInteger(channel)) bad.push(`${at}: fractional ${channel}`)
            else if (channel < 0 || channel > 255) bad.push(`${at}: out of range ${channel}`)
          }
        }
      }
    }

    expect(bad.slice(0, 20)).toEqual([])
    expect(samples).toBeGreaterThan(20_000)
  })

  it('answers the degenerate endpoints', () => {
    expect(oklch(0, 0, 0)).toEqual([0, 0, 0])
    expect(oklch(1, 0, 0)).toEqual([255, 255, 255])
    // Negative and absurd chroma are not expected inputs, but must not produce
    // NaN if a future caller hands them over.
    for (const C of [-0.1, 1, 10]) {
      for (const channel of oklch(0.5, C, 90)) {
        expect(Number.isFinite(channel)).toBe(true)
        expect(channel).toBeGreaterThanOrEqual(0)
        expect(channel).toBeLessThanOrEqual(255)
      }
    }
  })
})

describe('maxChroma()', () => {
  // NOT monotonic in L — max chroma rises then falls as lightness sweeps, and
  // the turning point moves with hue, so only the bounds are assertable.
  it('returns a positive value inside the search range everywhere', () => {
    const bad: string[] = []
    let min = Infinity
    let max = -Infinity

    for (const L of lightnesses(0, 1, 0.01)) {
      for (let H = 0; H < 360; H += 3) {
        const c = maxChroma(L, H)
        const at = `L=${L} H=${H}`
        if (!Number.isFinite(c)) bad.push(`${at}: non-finite`)
        else if (c <= 0) bad.push(`${at}: not positive (${c})`)
        else if (c > 0.45) bad.push(`${at}: above the search ceiling (${c})`)
        min = Math.min(min, c)
        max = Math.max(max, c)
      }
    }

    expect(bad.slice(0, 20)).toEqual([])
    // Sanity on the shape of the range: the widest point of sRGB in OKLCH sits
    // around C=0.32, and the narrowest (the L endpoints) is near zero.
    expect(max).toBeGreaterThan(0.3)
    expect(max).toBeLessThanOrEqual(0.45)
    expect(min).toBeLessThan(0.001)
  })

  it('reduces chroma rather than clipping channels when asked for too much', () => {
    for (const L of lightnesses(0.1, 0.95, 0.05)) {
      for (let H = 0; H < 360; H += 7) {
        const ceiling = maxChroma(L, H)
        const over = oklch(L, ceiling * 1.5, H)

        // Byte-identical to the in-gamut request: proof the excess was taken
        // off the chroma, not off the channels.
        expect(hex(over), `L=${L} H=${H}`).toBe(hex(oklch(L, ceiling, H)))

        // And the hue survived, which channel clipping would not preserve.
        const back = toOklch(over)
        if (back.C > 0.05) {
          expect(hueDelta(back.H, H), `hue drift at L=${L} H=${H}`).toBeLessThan(3)
        }
        expect(back.C, `chroma overshoot at L=${L} H=${H}`).toBeLessThan(ceiling + 0.01)
      }
    }
  })
})

describe('toOklch(oklch(...)) round-trips', () => {
  /**
   * Tolerances are set by 8-bit quantisation, not by the maths.
   *
   * oklch() rounds to integer sRGB bytes, so the inverse can only recover the
   * requested L and C to within half a code value — measured worst case over
   * this grid is dL 0.0018, dC 0.0017, dH 1.6 degrees. The limits below sit at
   * roughly 2x the measured worst case: tight enough to catch a real algebra
   * error (a wrong matrix coefficient moves these by 10x or more), loose enough
   * not to fail on a rounding difference.
   *
   * The grid stays off the extremes on purpose: at L < 0.2 a single byte step
   * is a large fraction of the available range, and hue is meaningless below
   * about C = 0.05, so those regions would only measure rounding.
   */
  it('recovers L, C and H for in-gamut inputs', () => {
    let worst = { dL: 0, dC: 0, dH: 0 }
    let samples = 0

    for (const L of lightnesses(0.25, 0.95, 0.05)) {
      for (let H = 0; H < 360; H += 5) {
        const C = Math.min(maxChroma(L, H) * 0.7, 0.2)
        if (C < 0.05) continue // too grey for hue to mean anything
        const back = toOklch(oklch(L, C, H))
        samples++

        expect(Math.abs(back.L - L), `dL at L=${L} C=${C} H=${H}`).toBeLessThan(0.005)
        expect(Math.abs(back.C - C), `dC at L=${L} C=${C} H=${H}`).toBeLessThan(0.005)
        expect(hueDelta(back.H, H), `dH at L=${L} C=${C} H=${H}`).toBeLessThan(3)

        worst = {
          dL: Math.max(worst.dL, Math.abs(back.L - L)),
          dC: Math.max(worst.dC, Math.abs(back.C - C)),
          dH: Math.max(worst.dH, hueDelta(back.H, H)),
        }
      }
    }

    expect(samples).toBeGreaterThan(500)
    // Guards against the tolerances above being quietly widened: if the real
    // error ever approaches them, this fails first.
    expect(worst.dL).toBeLessThan(0.0025)
    expect(worst.dC).toBeLessThan(0.0025)
    expect(worst.dH).toBeLessThan(2)
  })

  it('returns hue in [0, 360) and C = 0 for greys', () => {
    for (const v of [0, 1, 64, 128, 200, 255]) {
      const grey: Rgb = [v, v, v]
      const { C, H } = toOklch(grey)
      expect(C).toBeLessThan(1e-6)
      expect(H).toBeGreaterThanOrEqual(0)
      expect(H).toBeLessThan(360)
    }
  })

  it('measures funky’s own accent, the number generate.ts is calibrated to', () => {
    // generate.ts states #e8ff00 is L~0.97 C=0.218 and sits at the gamut edge.
    const { L, C, H } = toOklch([232, 255, 0])
    expect(C).toBeCloseTo(0.218, 2)
    expect(C / maxChroma(L, H)).toBeCloseTo(1, 1)
  })
})

describe('hex()', () => {
  it('pads single-digit channels', () => {
    expect(hex([232, 255, 0])).toBe('#e8ff00')
    expect(hex([0, 0, 0])).toBe('#000000')
    expect(hex([13, 16, 18])).toBe('#0d1012')
  })
})
