/**
 * The palette engine: plug-and-play, and deliberately so.
 *
 * Nothing in this module touches React or the DOM and it has no dependencies,
 * so it can be lifted into another project whole. The DOM side — writing the
 * tokens onto an element, the localStorage cache — lives in ./apply.
 */

export { oklch, maxChroma, toOklch, hex, type Rgb } from './oklch'
export { contrast, luminance, solveL, solveNear, type ChromaAt } from './contrast'
export { rng, pickHarmony, HARMONIES, type Harmony, type HarmonyName } from './harmony'
export { TOKEN_NAMES, type TokenName, type Palette, type Polarity } from './tokens'
export { generate, CHROMA_CEIL, type GeneratedPalette } from './generate'
export {
  validate,
  isValid,
  GATES,
  CHROMA_FLOOR,
  type Gate,
  type Failure,
  type ValidateOptions,
} from './validate'
