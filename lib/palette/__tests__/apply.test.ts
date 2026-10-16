/**
 * apply.ts — the DOM and localStorage side.
 *
 * Tested against a hand-rolled fake element and a fake Storage rather than
 * jsdom or happy-dom. apply.ts uses three members of CSSStyleDeclaration and
 * four of Storage, so a real DOM implementation would add megabytes of
 * dependency to test nothing extra — and the fake makes the *exact set* of
 * written properties assertable, which is the clearPalette invariant.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  applyPalette,
  clearPalette,
  ENGINE_VERSION,
  PALETTE_KEY,
  persistPalette,
  randomSeed,
  readSeed,
  SEED_KEY,
  THEME_KEY,
  toCache,
  VERSION_KEY,
} from '../apply'
import { generate } from '../generate'
import { TOKEN_NAMES } from '../tokens'
import { fakeElement, memoryStorage, CALIBRATION_PALETTES, throwingStorage } from './fixtures'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('applyPalette', () => {
  it('writes the nine tokens plus color-scheme, and nothing else', () => {
    const { el, style } = fakeElement()
    applyPalette(CALIBRATION_PALETTES.funky, 'dark', el)

    expect(Array.from(style.props.keys()).sort()).toEqual(
      [...TOKEN_NAMES.map((n) => `--${n}`), 'color-scheme'].sort(),
    )
    expect(style.props.size).toBe(TOKEN_NAMES.length + 1)
  })

  it('publishes the polarity as a data-polarity attribute too', () => {
    // CSS cannot branch on a generated colour, so the Shiki token set and the
    // light-polarity border nudges in globals.css select on this attribute.
    // It is part of what applyPalette sets, which means clearPalette owes it a
    // removal — see the clearPalette block below.
    const { el, attributes } = fakeElement()
    applyPalette(CALIBRATION_PALETTES.light, 'light', el)
    expect(Array.from(attributes.entries())).toEqual([['data-polarity', 'light']])

    applyPalette(CALIBRATION_PALETTES.funky, 'dark', el)
    expect(attributes.get('data-polarity')).toBe('dark')
  })

  it('writes values as space-separated channel triples', () => {
    const { el, style } = fakeElement()
    applyPalette(CALIBRATION_PALETTES.funky, 'dark', el)

    // The channel-triple form is load-bearing: globals.css consumes the tokens
    // as rgb(var(--accent) / <alpha-value>), so a "rgb(...)" or hex string here
    // would break every opacity modifier on the site.
    expect(style.getPropertyValue('--accent')).toBe('232 255 0')
    expect(style.getPropertyValue('--bg')).toBe('10 10 10')
    expect(style.getPropertyValue('--accent-dim')).toBe('184 204 0')
    for (const name of TOKEN_NAMES) {
      expect(style.getPropertyValue(`--${name}`)).toMatch(/^\d{1,3} \d{1,3} \d{1,3}$/)
    }
  })

  it('writes the polarity as color-scheme', () => {
    const dark = fakeElement()
    applyPalette(CALIBRATION_PALETTES.dark, 'dark', dark.el)
    expect(dark.style.getPropertyValue('color-scheme')).toBe('dark')

    const light = fakeElement()
    applyPalette(CALIBRATION_PALETTES.light, 'light', light.el)
    expect(light.style.getPropertyValue('color-scheme')).toBe('light')
  })

  it('overwrites a previously applied palette in place', () => {
    const { el, style } = fakeElement()
    applyPalette(CALIBRATION_PALETTES.funky, 'dark', el)
    applyPalette(CALIBRATION_PALETTES.light, 'light', el)
    expect(style.props.size).toBe(TOKEN_NAMES.length + 1)
    expect(style.getPropertyValue('--bg')).toBe('255 255 255')
    expect(style.getPropertyValue('color-scheme')).toBe('light')
  })

  it('works with a generated palette', () => {
    const { el, style } = fakeElement()
    const p = generate(777)
    applyPalette(p.tokens, p.polarity, el)
    expect(style.getPropertyValue('--accent')).toBe('40 158 247')
    expect(style.getPropertyValue('color-scheme')).toBe('dark')
  })
})

describe('clearPalette', () => {
  it('removes every property applyPalette set', () => {
    // This is the one that matters: inline styles beat the stylesheet, so a
    // single leftover property pins the default theme to the last random
    // palette for the rest of the session.
    const { el, style, attributes } = fakeElement()
    applyPalette(CALIBRATION_PALETTES.funky, 'dark', el)
    clearPalette(el)
    expect(Array.from(style.props.keys())).toEqual([])
    expect(Array.from(attributes.keys())).toEqual([])
  })

  it('leaves unrelated inline properties and attributes alone', () => {
    const { el, style, attributes } = fakeElement()
    style.setProperty('--not-a-theme-token', 'keep me')
    style.setProperty('background-color', 'red')
    attributes.set('data-theme', 'random')
    applyPalette(CALIBRATION_PALETTES.funky, 'dark', el)
    clearPalette(el)
    expect(Array.from(style.props.keys()).sort()).toEqual(['--not-a-theme-token', 'background-color'])
    // data-theme is the theme system's own attribute; clearPalette must not
    // take it with it, or switching away from random would unset the theme.
    expect(Array.from(attributes.entries())).toEqual([['data-theme', 'random']])
  })

  it('is a no-op on an element that was never painted', () => {
    const { el, style, attributes } = fakeElement()
    expect(() => clearPalette(el)).not.toThrow()
    expect(style.props.size).toBe(0)
    expect(attributes.size).toBe(0)
  })
})

describe('toCache', () => {
  it('round-trips through JSON back to the same channel values', () => {
    const p = generate(777)
    const cached = toCache(p)

    expect(cached.polarity).toBe('dark')
    expect(Object.keys(cached).sort()).toEqual([...TOKEN_NAMES, 'polarity'].sort())

    const revived = JSON.parse(JSON.stringify(cached)) as Record<string, string>
    for (const name of TOKEN_NAMES) {
      const channels = revived[name].split(' ').map(Number)
      expect(channels, name).toEqual([...p.tokens[name]])
    }
    expect(revived.polarity).toBe(p.polarity)
  })

  it('produces exactly the strings applyPalette would write', () => {
    // The cache exists so the pre-paint script can set the same properties
    // without running the engine; if the two forms diverge, the restored
    // palette is not the one the seed generates.
    const p = generate(31337)
    const cached = toCache(p)
    const { el, style } = fakeElement()
    applyPalette(p.tokens, p.polarity, el)
    for (const name of TOKEN_NAMES) {
      expect(cached[name], name).toBe(style.getPropertyValue(`--${name}`))
    }
    expect(cached.polarity).toBe(style.getPropertyValue('color-scheme'))
  })
})

describe('persistPalette / readSeed with a working localStorage', () => {
  it('writes the seed, the cache and the version stamp', () => {
    const store = memoryStorage()
    vi.stubGlobal('localStorage', store)
    const p = generate(2048)

    persistPalette(p)

    expect(store.getItem(THEME_KEY)).toBe('random')
    expect(store.getItem(SEED_KEY)).toBe('2048')
    expect(store.getItem(VERSION_KEY)).toBe(ENGINE_VERSION)
    expect(JSON.parse(store.getItem(PALETTE_KEY) as string)).toEqual(toCache(p))
    expect(readSeed()).toBe(2048)
  })

  it('rejects a stored seed that is absent, unparseable or out of range', () => {
    const store = memoryStorage()
    vi.stubGlobal('localStorage', store)

    expect(readSeed()).toBeNull() // absent
    for (const raw of ['', 'banana', '0', '-5', 'NaN', 'Infinity']) {
      store.setItem(SEED_KEY, raw)
      expect(readSeed(), `raw=${JSON.stringify(raw)}`).toBeNull()
    }
    // Leniently accepted, and harmless: generate() coerces with >>> 0.
    store.setItem(SEED_KEY, '42abc')
    expect(readSeed()).toBe(42)
  })
})

describe('the storage helpers survive a hostile localStorage', () => {
  it('persistPalette does not throw when every write throws', () => {
    vi.stubGlobal('localStorage', throwingStorage())
    // A palette that cannot be persisted must still apply for this session,
    // so a privacy-mode throw cannot be allowed to propagate.
    expect(() => persistPalette(generate(777))).not.toThrow()
  })

  it('readSeed returns null when the read throws', () => {
    vi.stubGlobal('localStorage', throwingStorage())
    expect(readSeed()).toBeNull()
  })

  it('both are safe when localStorage does not exist at all', () => {
    // The reference itself is inside the try block, so a bare ReferenceError
    // (SSR, a non-DOM test runner, a worker) is handled too.
    vi.stubGlobal('localStorage', undefined)
    expect(() => persistPalette(generate(1))).not.toThrow()
    expect(readSeed()).toBeNull()
  })

  it('survives a localStorage that throws only on the later writes', () => {
    // The realistic quota case: the first setItem succeeds, a later one blows
    // up. Nothing should escape, and the keys written before the throw are
    // still only ever read back through the version stamp.
    let calls = 0
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {
        if (++calls >= 3) throw new Error('QuotaExceededError')
      },
      removeItem: () => undefined,
      clear: () => undefined,
      key: () => null,
      length: 0,
    })
    expect(() => persistPalette(generate(5))).not.toThrow()
    expect(calls).toBe(3)
  })
})

describe('randomSeed', () => {
  it('stays inside the range readSeed will accept', () => {
    for (const r of [0, 0.5, 0.9999999999]) {
      vi.spyOn(Math, 'random').mockReturnValue(r)
      const seed = randomSeed()
      expect(Number.isInteger(seed)).toBe(true)
      expect(seed).toBeGreaterThan(0)
      expect(seed).toBeLessThanOrEqual(2_147_483_647)
    }
  })

  it('produces seeds generate() accepts', () => {
    vi.restoreAllMocks()
    for (let i = 0; i < 50; i++) {
      expect(() => generate(randomSeed())).not.toThrow()
    }
  })
})
