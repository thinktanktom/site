/**
 * The seeded randomness: a PRNG, and the harmony intervals that relate the
 * accent hue to the neutral hue.
 *
 * The intervals are the reason a palette reads as chosen rather than sampled.
 * An accent at exactly the neutral hue is always safe but monotonous; an accent
 * at an unrelated random hue is a collision. A *named* interval is what makes
 * the pair look intentional.
 */

/** mulberry32 — small, fast, and good enough that a seed reproduces a palette. */
export function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export type HarmonyName =
  | 'mono'
  | 'analogous+'
  | 'analogous-'
  | 'split+'
  | 'split-'
  | 'complement'

export type Harmony = { name: HarmonyName; offset: number; weight: number }

/** Weighted toward the cohesive end: mono and analogous outnumber complement. */
export const HARMONIES: readonly Harmony[] = [
  { name: 'mono', offset: 0, weight: 3 },
  { name: 'analogous+', offset: 32, weight: 3 },
  { name: 'analogous-', offset: -32, weight: 3 },
  { name: 'split+', offset: 152, weight: 2 },
  { name: 'split-', offset: -152, weight: 2 },
  { name: 'complement', offset: 180, weight: 2 },
]

export function pickHarmony(next: () => number): Harmony {
  const total = HARMONIES.reduce((sum, h) => sum + h.weight, 0)
  let x = next() * total
  for (const h of HARMONIES) {
    x -= h.weight
    if (x <= 0) return h
  }
  return HARMONIES[0]
}
