/**
 * WCAG 2.1 contrast, plus the two solvers the generator uses instead of
 * sampling-and-rejecting.
 *
 * Solving matters: a reject-and-retry loop can fail to terminate, and it
 * silently biases the hue distribution toward whatever happens to pass. Both
 * solvers below are monotonic searches, so they converge on every input.
 */

import { oklch, type Rgb } from './oklch'

const decode = (c: number): number => {
  const s = c / 255
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
}

/** WCAG 2.1 relative luminance. */
export const luminance = ([r, g, b]: Rgb): number =>
  0.2126 * decode(r) + 0.7152 * decode(g) + 0.0722 * decode(b)

/** WCAG 2.1 contrast ratio, 1..21. Order-independent. */
export function contrast(a: Rgb, b: Rgb): number {
  const x = luminance(a)
  const y = luminance(b)
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}

/** Chroma as a function of lightness — lets a solver keep the hue cast curve. */
export type ChromaAt = (L: number) => number

/**
 * Bisect lightness in one half of the range for the point that hits `target`
 * contrast against `ref`.
 *
 * `lightward` picks the half: true searches [0.5, 1] for a colour lighter than
 * `ref`, false searches [0, 0.5] for a darker one. Contrast is monotonic in L
 * on each side of `ref`, which is what makes the bisection valid — and also why
 * this cannot be used for colours that sit very close to `ref` (see solveNear).
 */
export function solveL(
  target: number,
  ref: Rgb,
  H: number,
  chromaAt: ChromaAt,
  lightward: boolean,
): number {
  let lo = lightward ? 0.5 : 0
  let hi = lightward ? 1 : 0.5

  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2
    const cr = contrast(oklch(mid, chromaAt(mid), H), ref)
    // contrast rises as we move away from ref
    if (cr < target) {
      if (lightward) lo = mid
      else hi = mid
    } else {
      if (lightward) hi = mid
      else lo = mid
    }
  }

  return lightward ? hi : lo
}

/**
 * Walk lightness away from `refL` in small steps until contrast against `ref`
 * reaches `target`.
 *
 * For border and grid-dot, which sit a hair off the background. solveL bisects
 * a fixed half-range and cannot express "just above 0.98", which is exactly
 * where a light-polarity background lives — using it there pushed grid-dot out
 * of its contrast window.
 */
export function solveNear(
  target: number,
  ref: Rgb,
  refL: number,
  H: number,
  chromaAt: ChromaAt,
  up: boolean,
): number {
  for (let i = 1; i <= 90; i++) {
    const L = Math.max(0, Math.min(1, refL + (up ? i : -i) * 0.004))
    if (contrast(oklch(L, chromaAt(L), H), ref) >= target) return L
  }
  return Math.max(0, Math.min(1, refL + (up ? 0.36 : -0.36)))
}
