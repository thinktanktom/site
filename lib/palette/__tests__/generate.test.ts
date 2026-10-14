/**
 * generate.ts — the sweep, determinism, and the pinned known values.
 *
 * The sweep is the test that justifies shipping a randomiser at all: a palette
 * that fails a gate reaches a reader as unreadable text, and there is no human
 * in the loop to catch it.
 *
 * Sweep size is configurable:
 *
 *   npm test                              # 2,000 seeds, ~0.9s (3.2s suite)
 *   PALETTE_SWEEP_SEEDS=20000 npm test    # exhaustive run, ~8.9s (13.4s suite)
 *
 * 2,000 is the default because the suite should stay interactive; 20,000 is the
 * number to run before releasing an engine change (measured 20,000/20,000 pass
 * at engine version 1). The variable also scales the strided high-seed sweep
 * below, to a quarter of the count.
 */

import { describe, expect, it } from 'vitest'

import { generate } from '../generate'
import { HARMONIES, pickHarmony, rng } from '../harmony'
import { hex } from '../oklch'
import { TOKEN_NAMES } from '../tokens'
import { isValid, validate } from '../validate'

const SWEEP_SEEDS = Number(process.env.PALETTE_SWEEP_SEEDS ?? 2000)

describe('every seed produces a palette that passes the gates', () => {
  it(`holds for seeds 1..${SWEEP_SEEDS}`, () => {
    const failures: { seed: number; misses: ReturnType<typeof validate> }[] = []

    for (let seed = 1; seed <= SWEEP_SEEDS; seed++) {
      const { tokens } = generate(seed)
      // checkChroma on: unlike the shipping themes, a *generated* accent that
      // comes out grey is a failure — it would read as a fourth neutral.
      if (!isValid(tokens, { checkChroma: true })) {
        failures.push({ seed, misses: validate(tokens, { checkChroma: true }) })
      }
    }

    // Report every failing seed, not just the first: a systematic gap (e.g. all
    // light-polarity blues) is only visible in the whole list.
    expect(failures.slice(0, 20)).toEqual([])
    expect(failures).toHaveLength(0)
    // Measured at 0.45ms/seed; the timeout is generous enough for a cold,
    // loaded machine and for PALETTE_SWEEP_SEEDS=20000.
  }, Math.max(20_000, SWEEP_SEEDS * 5))

  it('holds for seeds spread across the whole range randomSeed() draws from', () => {
    // The sweep above only walks seeds 1..N, which is a narrow, correlated
    // corner of the 2^31 space a real reader rolls from. This one strides the
    // full range so a failure mode that only appears at large seed values
    // cannot hide. Verified separately against 30,000 genuinely random seeds
    // (30,000/30,000 pass); the strided set is used here so the suite stays
    // deterministic.
    const n = Math.max(500, Math.floor(SWEEP_SEEDS / 4))
    const stride = Math.floor(2_147_483_646 / n)
    const failures: { seed: number; misses: ReturnType<typeof validate> }[] = []

    for (let i = 0; i < n; i++) {
      const seed = 1 + i * stride
      const { tokens } = generate(seed)
      if (!isValid(tokens, { checkChroma: true })) {
        failures.push({ seed, misses: validate(tokens, { checkChroma: true }) })
      }
    }

    expect(failures.slice(0, 20)).toEqual([])
    expect(failures).toHaveLength(0)
  }, 20_000)

  it('emits all nine tokens as integer sRGB triples', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const { tokens, polarity, accentStage, accentChroma, keyHue, accentHue } = generate(seed)
      expect(Object.keys(tokens).sort()).toEqual([...TOKEN_NAMES].sort())
      for (const name of TOKEN_NAMES) {
        const rgb = tokens[name]
        expect(rgb, `${name} for seed ${seed}`).toHaveLength(3)
        for (const channel of rgb) {
          expect(Number.isInteger(channel), `${name} for seed ${seed}`).toBe(true)
          expect(channel).toBeGreaterThanOrEqual(0)
          expect(channel).toBeLessThanOrEqual(255)
        }
      }
      expect(polarity === 'dark' || polarity === 'light').toBe(true)
      expect([1, 2, 3]).toContain(accentStage)
      expect(accentChroma).toBeGreaterThan(0)
      expect(keyHue).toBeGreaterThanOrEqual(0)
      expect(keyHue).toBeLessThan(360)
      expect(accentHue).toBeGreaterThanOrEqual(0)
      expect(accentHue).toBeLessThan(360)
    }
  })

  it('stays in the preferred accent stage, and favours dark polarity', () => {
    // generate.ts claims "95% of seeds never leave stage 1". Measured 19001 of
    // the first 20000 = 95.0%. Asserted loosely: this is a quality signal, and
    // a hard number here would fail on any deliberate retune of the stages.
    //
    // Polarity is checked in the same pass: generating 2,000 palettes twice to
    // count two different things costs a second for nothing.
    const counts = [0, 0, 0]
    let dark = 0
    const n = 2000
    for (let seed = 1; seed <= n; seed++) {
      const p = generate(seed)
      counts[p.accentStage - 1]++
      if (p.polarity === 'dark') dark++
    }

    expect(counts[0] / n).toBeGreaterThan(0.9)
    expect(counts[0] + counts[1] + counts[2]).toBe(n)

    // DARK_PROBABILITY is 0.72; measured 14404/20000 = 72.0%.
    expect(dark / n).toBeGreaterThan(0.65)
    expect(dark / n).toBeLessThan(0.79)
  })
})

describe('determinism', () => {
  it('returns byte-identical output for the same seed', () => {
    for (const seed of [1, 777, 2048, 31337, 2_147_483_647]) {
      const a = generate(seed)
      const b = generate(seed)
      // Deep equality over the whole result, not just the tokens: keyHue,
      // harmony and stage are part of what a shared seed has to reproduce.
      expect(b).toEqual(a)
      // Not the same object, so the equality above is about values.
      expect(b).not.toBe(a)
    }
  })

  it('is unaffected by interleaving other generate() calls', () => {
    // Catches any module-level RNG state leaking between palettes.
    const alone = generate(4242)
    generate(1)
    generate(99)
    expect(generate(4242)).toEqual(alone)
  })

  it('generally produces different palettes for different seeds', () => {
    // "Generally", not "always": the engine quantises to 8-bit sRGB, so two
    // seeds whose key hues land within a fraction of a degree of each other
    // can collide exactly. Measured 13 collisions in the first 20,000 seeds
    // (0.065%) — e.g. seeds 1340 and 2577, whose key hues are 207.29 and
    // 207.55. That is a property of byte quantisation, not a bug, so this
    // asserts a rate rather than uniqueness.
    const seen = new Set<string>()
    const n = 1000
    for (let seed = 1; seed <= n; seed++) seen.add(JSON.stringify(generate(seed).tokens))
    expect(seen.size).toBeGreaterThan(n * 0.99)

    // And two specific unrelated seeds must differ, as a floor on the above.
    expect(generate(777).tokens).not.toEqual(generate(778).tokens)
  })
})

describe('known-value regression', () => {
  /**
   * Pinned so a refactor cannot silently change the palettes readers see. A
   * change here is not necessarily wrong, but it means ENGINE_VERSION in
   * apply.ts must be bumped, or cached palettes will disagree with the seeds
   * that are supposed to produce them.
   */
  it('seed 777', () => {
    const p = generate(777)
    const asHex = Object.fromEntries(TOKEN_NAMES.map((n) => [n, hex(p.tokens[n])]))
    expect(asHex).toEqual({
      bg: '#0d1012',
      surface: '#14171a',
      border: '#262a2e',
      text: '#dbdddf',
      muted: '#82888d',
      accent: '#289ef7',
      'accent-dim': '#1f83cd',
      'grid-dot': '#1f2327',
      success: '#299c56',
    })
    expect(p.polarity).toBe('dark')
    expect(p.harmony).toBe('mono')
    expect(p.accentStage).toBe(1)
    expect(p.keyHue).toBeCloseTo(247.0963, 4)
    expect(p.accentHue).toBeCloseTo(p.keyHue, 10)
  })

  it('seed 2048', () => {
    const p = generate(2048)
    expect(p.tokens.accent).toEqual([109, 40, 216])
    expect(hex(p.tokens.accent)).toBe('#6d28d8')
    expect(p.polarity).toBe('light')
  })
})

describe('harmony', () => {
  it('rng(seed) is reproducible and stays in [0, 1)', () => {
    const first = Array.from({ length: 8 }, rng(12345))
    const again = Array.from({ length: 8 }, rng(12345))
    expect(again).toEqual(first)
    for (const x of first) {
      expect(x).toBeGreaterThanOrEqual(0)
      expect(x).toBeLessThan(1)
    }
  })

  it('pickHarmony respects the declared weights', () => {
    const next = rng(99)
    const counts = new Map<string, number>()
    const n = 60_000
    for (let i = 0; i < n; i++) {
      const h = pickHarmony(next)
      counts.set(h.name, (counts.get(h.name) ?? 0) + 1)
    }
    const total = HARMONIES.reduce((sum, h) => sum + h.weight, 0)
    for (const h of HARMONIES) {
      // +/-10% of the expected share: wide enough that this is a wiring test
      // (a weight typo or an off-by-one in the cumulative walk), not a test of
      // the PRNG's statistical quality.
      const expected = (n * h.weight) / total
      expect(counts.get(h.name) ?? 0, h.name).toBeGreaterThan(expected * 0.9)
      expect(counts.get(h.name) ?? 0, h.name).toBeLessThan(expected * 1.1)
    }
  })

  it('offsets the accent hue by the chosen harmony interval', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const { keyHue, accentHue, harmony } = generate(seed)
      const offset = HARMONIES.find((h) => h.name === harmony)?.offset
      expect(offset, `unknown harmony ${harmony}`).not.toBeUndefined()
      const expected = (((keyHue + (offset as number)) % 360) + 360) % 360
      expect(accentHue).toBeCloseTo(expected, 9)
    }
  })
})
