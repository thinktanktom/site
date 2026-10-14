/**
 * Shared fixtures. Not a test file — vitest only collects `*.test.ts`.
 */

import type { Palette, TokenName } from '../tokens'

/** A palette literal with the token names spelled out, typed as a Palette. */
export const palette = (p: Record<TokenName, readonly [number, number, number]>): Palette => p

/**
 * The three shipping themes, transcribed from src/app/globals.css.
 *
 * Hardcoded on purpose: this is the calibration reference, so it must not be
 * derived from the same stylesheet it is checking. `calibration.test.ts` also
 * parses globals.css and asserts the two agree, which catches a drift in either
 * direction.
 */
export const SHIPPING_THEMES: Record<'funky' | 'dark' | 'light', Palette> = {
  funky: palette({
    bg: [10, 10, 10],
    surface: [17, 17, 17],
    border: [34, 34, 34],
    text: [240, 240, 240],
    muted: [128, 128, 128],
    accent: [232, 255, 0],
    'accent-dim': [184, 204, 0],
    'grid-dot': [30, 30, 30],
    success: [74, 222, 128],
  }),
  dark: palette({
    bg: [0, 0, 0],
    surface: [15, 15, 15],
    border: [42, 42, 42],
    text: [224, 224, 224],
    muted: [138, 138, 138],
    accent: [255, 255, 255],
    'accent-dim': [189, 189, 189],
    'grid-dot': [36, 36, 36],
    success: [184, 184, 184],
  }),
  light: palette({
    bg: [255, 255, 255],
    surface: [244, 244, 244],
    border: [212, 212, 212],
    text: [31, 31, 31],
    muted: [107, 107, 107],
    accent: [0, 0, 0],
    'accent-dim': [61, 61, 61],
    'grid-dot': [220, 220, 220],
    success: [69, 69, 69],
  }),
}

/**
 * A hand-rolled stand-in for an element: its inline style map and its
 * attributes.
 *
 * Deliberately not jsdom or happy-dom: apply.ts touches three members of
 * CSSStyleDeclaration (setProperty, removeProperty, getPropertyValue) and two
 * of Element (setAttribute, removeAttribute), so a short fake tests the same
 * behaviour without a multi-megabyte dependency — and it lets the test assert
 * on the *exact set* of properties and attributes written, which is the
 * invariant that matters for clearPalette.
 */
export type FakeStyle = {
  readonly props: Map<string, string>
  setProperty(name: string, value: string): void
  removeProperty(name: string): string
  getPropertyValue(name: string): string
}

export function fakeElement(): {
  el: HTMLElement
  style: FakeStyle
  attributes: Map<string, string>
} {
  const props = new Map<string, string>()
  const attributes = new Map<string, string>()
  const style: FakeStyle = {
    props,
    setProperty(name, value) {
      props.set(name, value)
    },
    removeProperty(name) {
      const old = props.get(name) ?? ''
      props.delete(name)
      return old
    },
    getPropertyValue(name) {
      return props.get(name) ?? ''
    },
  }
  const el = {
    style,
    setAttribute: (name: string, value: string) => void attributes.set(name, value),
    removeAttribute: (name: string) => void attributes.delete(name),
    getAttribute: (name: string) => attributes.get(name) ?? null,
    hasAttribute: (name: string) => attributes.has(name),
  }
  return { el: el as unknown as HTMLElement, style, attributes }
}

/** An in-memory localStorage good enough for the four keys apply.ts writes. */
export function memoryStorage(): Storage & { map: Map<string, string> } {
  const map = new Map<string, string>()
  return {
    map,
    get length() {
      return map.size
    },
    clear: () => map.clear(),
    getItem: (k: string) => (map.has(k) ? (map.get(k) as string) : null),
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    removeItem: (k: string) => void map.delete(k),
    setItem: (k: string, v: string) => void map.set(k, String(v)),
  } as Storage & { map: Map<string, string> }
}

/** A localStorage that throws on every access, as privacy modes do. */
export function throwingStorage(): Storage {
  const boom = (): never => {
    throw new Error('SecurityError: localStorage is disabled')
  }
  return {
    get length(): number {
      return boom()
    },
    clear: boom,
    getItem: boom,
    key: boom,
    removeItem: boom,
    setItem: boom,
  } as unknown as Storage
}
