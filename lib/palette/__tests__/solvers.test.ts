/**
 * The contrast solvers, tested directly.
 *
 * They were previously covered only transitively through generate(), which hid
 * a real defect: solveL bracketed its bisection at a hardcoded 0.5 rather than
 * at the reference colour's own lightness, so a darkward search could never
 * return more than 0.5 however much room existed below. A light palette's
 * accent sits at L 0.46-0.55, at or above that cap, so accent-dim was pinned
 * and the hover state became imperceptible.
 *
 * These also pin the documented PRECONDITION, because both solvers return a
 * bound rather than throwing when a target is unreachable on the side asked
 * for. That is survivable only as long as every caller searches away from a
 * reference at a lightness extreme, so it is written down and tested here.
 */

import { describe, expect, it } from 'vitest'

import { contrast, solveL, solveNear } from '../contrast'
import { maxChroma, oklch, toOklch, type Rgb } from '../oklch'

const NEAR_WHITE: Rgb = [248, 248, 248]
const NEAR_BLACK: Rgb = [13, 16, 18]
const flat = (c: number) => () => c

describe('solveL brackets at the reference lightness, not at 0.5', () => {
  it('can return a lightness above 0.5 when searching down from near-white', () => {
    // The regression test for the 0.5 cap. Against a near-white reference the
    // 4.7:1 boundary genuinely sits above 0.5, and the old code could not
    // express it.
    const H = 290
    const chromaAt = (L: number) => Math.min(0.15, maxChroma(L, H) * 0.92)
    const L = solveL(4.7, NEAR_WHITE, H, chromaAt, false)

    expect(L).toBeGreaterThan(0.5)
    expect(contrast(oklch(L, chromaAt(L), H), NEAR_WHITE)).toBeGreaterThanOrEqual(4.65)
  })

  it('returns a lightness meeting the target, searching up from near-black', () => {
    const H = 247
    const L = solveL(14, NEAR_BLACK, H, flat(0.01), true)
    expect(contrast(oklch(L, 0.01, H), NEAR_BLACK)).toBeGreaterThanOrEqual(13.9)
  })

  it('stays inside [0, 1] and on the requested side of the reference', () => {
    const refL = toOklch(NEAR_BLACK).L
    for (const target of [3, 4.5, 7, 14, 20]) {
      const up = solveL(target, NEAR_BLACK, 120, flat(0.05), true)
      expect(up).toBeGreaterThanOrEqual(refL - 1e-9)
      expect(up).toBeLessThanOrEqual(1)
    }
    const whiteL = toOklch(NEAR_WHITE).L
    for (const target of [3, 4.5, 7, 14]) {
      const down = solveL(target, NEAR_WHITE, 120, flat(0.05), false)
      expect(down).toBeGreaterThanOrEqual(0)
      expect(down).toBeLessThanOrEqual(whiteL + 1e-9)
    }
  })

  it('is monotonic: a higher target never returns a less contrasty colour', () => {
    let previous = 0
    for (const target of [2, 3, 4.5, 7, 10, 14, 18]) {
      const L = solveL(target, NEAR_BLACK, 200, flat(0.02), true)
      const got = contrast(oklch(L, 0.02, 200), NEAR_BLACK)
      expect(got).toBeGreaterThanOrEqual(previous - 0.01)
      previous = got
    }
  })

  it('PRECONDITION: an unreachable side returns a bound, it does not throw', () => {
    // Nothing is lighter than white, so this cannot reach 4.5 and returns L=1
    // at 1.0:1. Documented, not fixed: generate() always searches away from a
    // bg that sits at a lightness extreme, so no caller can hit it. A future
    // retune of bgL would, which is the whole reason this is written down.
    const L = solveL(4.5, [255, 255, 255], 40, flat(0.1), true)
    expect(L).toBeCloseTo(1, 6)
    expect(contrast(oklch(L, 0.1, 40), [255, 255, 255])).toBeLessThan(1.1)
  })
})

describe('solveNear walks away from a reference it sits close to', () => {
  it('lands at or just past the target for a near-black background', () => {
    const refL = toOklch(NEAR_BLACK).L
    for (const target of [1.2, 1.32, 1.6, 2]) {
      const L = solveNear(target, NEAR_BLACK, refL, 247, flat(0.005), true)
      expect(contrast(oklch(L, 0.005, 247), NEAR_BLACK)).toBeGreaterThanOrEqual(target - 0.02)
    }
  })

  it('works downward from a near-white background', () => {
    // This is the case solveL cannot express at all: a colour just below 0.98.
    const refL = toOklch(NEAR_WHITE).L
    for (const target of [1.2, 1.32]) {
      const L = solveNear(target, NEAR_WHITE, refL, 290, flat(0.005), false)
      expect(L).toBeLessThan(refL)
      expect(contrast(oklch(L, 0.005, 290), NEAR_WHITE)).toBeGreaterThanOrEqual(target - 0.02)
    }
  })

  it('does not overshoot: the step is fine enough to stay inside a window', () => {
    // border and grid-dot are gated as windows, so the solver must not sail
    // past the ceiling on the way to the floor.
    const refL = toOklch(NEAR_BLACK).L
    const L = solveNear(1.32, NEAR_BLACK, refL, 247, flat(0.005), true)
    expect(contrast(oklch(L, 0.005, 247), NEAR_BLACK)).toBeLessThan(2.0)
  })

  it('PRECONDITION: an unreachable target falls back rather than looping', () => {
    // 90 steps of 0.004 is 0.36 of lightness; asking for 21:1 across that
    // distance is impossible, so it returns the fallback bound.
    const refL = toOklch(NEAR_BLACK).L
    const L = solveNear(21, NEAR_BLACK, refL, 247, flat(0.005), true)
    expect(L).toBeCloseTo(Math.min(1, refL + 0.36), 6)
  })
})
