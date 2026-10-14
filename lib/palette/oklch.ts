/**
 * OKLCH <-> sRGB, after Björn Ottosson's oklab.
 *
 * Why OKLCH and not HSL: OKLCH is perceptually uniform, so a single lightness
 * ramp looks like the same ramp at every hue. In HSL, `50%` lightness at yellow
 * and at blue look nothing alike, which makes a generated palette accidentally
 * glaring at some hues and muddy at others. Everything in this module exists to
 * let the generator reason about "lighter" and "more colourful" independently.
 */

/** 0-255 per channel. */
export type Rgb = readonly [number, number, number]

/** sRGB gamma encode (linear light -> display value). */
const encode = (c: number): number =>
  c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055

/** sRGB gamma decode (display value -> linear light). */
const decode = (c: number): number => {
  const s = c / 255
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
}

function oklchToLinear(L: number, C: number, hDeg: number): [number, number, number] {
  const h = (hDeg * Math.PI) / 180
  const a = C * Math.cos(h)
  const b = C * Math.sin(h)

  const l_ = L + 0.3963377774 * a + 0.2158037573 * b
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b
  const s_ = L - 0.0894841775 * a - 1.291485548 * b

  const l = l_ * l_ * l_
  const m = m_ * m_ * m_
  const s = s_ * s_ * s_

  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
}

const inGamut = (rgb: readonly number[]): boolean =>
  rgb.every((v) => v >= -0.0001 && v <= 1.0001)

/**
 * The largest chroma that still fits inside sRGB at this lightness and hue.
 *
 * This is the real constraint the generator negotiates with, and it is wildly
 * hue-dependent: at L=0.85 green reaches C=0.234 while violet tops out at
 * C=0.074. It is also why a vivid *dark* cyan does not exist — max chroma at
 * hue 218 falls monotonically as lightness drops.
 */
export function maxChroma(L: number, H: number): number {
  let lo = 0
  let hi = 0.45
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2
    if (inGamut(oklchToLinear(L, mid, H))) lo = mid
    else hi = mid
  }
  return lo
}

/**
 * OKLCH -> sRGB bytes, reducing chroma until the colour fits the gamut.
 *
 * Chroma is reduced along the hue ray rather than clipping RGB channels:
 * clipping shifts hue (a clipped vivid blue drifts purple), so backing off
 * chroma is what preserves the hue actually asked for.
 */
export function oklch(L: number, C: number, H: number): Rgb {
  const c = Math.min(C, maxChroma(L, H))
  const [r, g, b] = oklchToLinear(L, c, H)
  return [r, g, b].map((v) =>
    Math.round(Math.max(0, Math.min(1, encode(v))) * 255),
  ) as unknown as Rgb
}

/** sRGB bytes -> OKLCH. Used to calibrate the generator against brand colours. */
export function toOklch([r, g, b]: Rgb): { L: number; C: number; H: number } {
  const R = decode(r)
  const G = decode(g)
  const B = decode(b)

  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B)
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B)
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B)

  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s

  const C = Math.hypot(a, bb)
  let H = (Math.atan2(bb, a) * 180) / Math.PI
  if (H < 0) H += 360

  return { L, C, H }
}

/** `[232, 255, 0]` -> `"#e8ff00"`. Diagnostics and tests only. */
export const hex = ([r, g, b]: Rgb): string =>
  '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')
