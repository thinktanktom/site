/**
 * The pre-paint handshake.
 *
 * `toCache()` writes the palette cache and the inline script in
 * `src/app/layout.tsx` reads it. Nothing else in the suite covers the seam
 * between them, and it is a seam with no type checking across it: the script is
 * a string of ES5 inside a template literal, matched to the cache shape purely
 * by convention. A rename on either side would ship silently broken.
 *
 * So these tests run the REAL script — extracted from layout.tsx, not a copy —
 * against caches produced by the REAL toCache(), in a sandbox with a fake
 * document and localStorage. If the two ever drift apart, this fails.
 */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import vm from 'node:vm'

import { generate } from '../generate'
import { ENGINE_VERSION, toCache } from '../apply'
import { TOKEN_NAMES } from '../tokens'
import { fakeElement } from './fixtures'

const LAYOUT = join(process.cwd(), 'src/app/layout.tsx')

/** Pull the first inline script out of layout.tsx's dangerouslySetInnerHTML. */
function extractPrePaintScript(): string {
  const src = readFileSync(LAYOUT, 'utf8')
  const m = src.match(/__html: `(\(function\(\)\{[\s\S]*?)`,/)
  if (!m) throw new Error('could not find the pre-paint script in layout.tsx')
  return m[1]
}

type RunResult = {
  theme: string | null
  polarity: string | null
  props: Map<string, string>
  stored: Map<string, string>
}

/** Execute the script with a fake document + the given localStorage contents. */
function run(
  stored: Record<string, string>,
  opts: { throwOnRead?: boolean } = {},
): RunResult {
  const { el, style, attributes } = fakeElement()
  const map = new Map(Object.entries(stored))
  const localStorage = {
    getItem(k: string) {
      if (opts.throwOnRead) throw new Error('privacy mode')
      return map.has(k) ? map.get(k)! : null
    },
    setItem(k: string, v: string) {
      map.set(k, v)
    },
  }

  const context = vm.createContext({
    document: { documentElement: el },
    localStorage,
    JSON,
  })
  vm.runInContext(extractPrePaintScript(), context)

  return {
    theme: attributes.get('data-theme') ?? null,
    polarity: attributes.get('data-polarity') ?? null,
    props: style.props,
    stored: map,
  }
}

describe('the pre-paint script parses and runs', () => {
  it('is valid standalone script source', () => {
    expect(() => new vm.Script(extractPrePaintScript())).not.toThrow()
  })

  it('declares the same nine tokens apply.ts writes, in the same order', () => {
    const script = extractPrePaintScript()
    const m = script.match(/var K=\[([^\]]+)\]/)
    expect(m, 'the script should carry a token list').toBeTruthy()
    const names = m![1].split(',').map((s) => s.trim().replace(/^'|'$/g, ''))
    expect(names).toEqual([...TOKEN_NAMES])
  })

  it('pins the same ENGINE_VERSION as apply.ts', () => {
    const m = extractPrePaintScript().match(/V='([^']*)'/)
    expect(m, 'the script should carry a version stamp').toBeTruthy()
    expect(m![1]).toBe(ENGINE_VERSION)
  })
})

describe('named themes', () => {
  it('falls back to funky with nothing stored', () => {
    const r = run({})
    expect(r.theme).toBe('funky')
    expect(r.props.size).toBe(0)
  })

  it.each(['dark', 'light'])('applies the %s attribute and no inline tokens', (t) => {
    const r = run({ 'ttt-theme': t })
    expect(r.theme).toBe(t)
    expect(r.props.size).toBe(0)
  })

  it.each(['', 'bogus', 'RANDOM', 'funky '])(
    'rejects %o and renders funky',
    (t) => {
      expect(run({ 'ttt-theme': t }).theme).toBe('funky')
    },
  )

  it('survives a localStorage that throws', () => {
    const r = run({ 'ttt-theme': 'dark' }, { throwOnRead: true })
    expect(r.theme).toBe('funky')
    expect(r.props.size).toBe(0)
  })
})

describe('the random cache handshake', () => {
  /* The point of this block: the cache is always built by the real producer. */
  const cacheFor = (seed: number) => ({
    'ttt-theme': 'random',
    'ttt-seed': String(seed),
    'ttt-palette': JSON.stringify(toCache(generate(seed))),
    'ttt-palette-v': ENGINE_VERSION,
  })

  it.each([777, 2048, 1, 31337])(
    'restores seed %i exactly as the engine generated it',
    (seed) => {
      const palette = generate(seed)
      const r = run(cacheFor(seed))

      expect(r.theme).toBe('random')
      expect(r.polarity).toBe(palette.polarity)
      expect(r.props.get('color-scheme')).toBe(palette.polarity)

      // every token, byte for byte, in the "R G B" form Tailwind needs
      for (const name of TOKEN_NAMES) {
        expect(r.props.get(`--${name}`), name).toBe(
          palette.tokens[name].join(' '),
        )
      }
      // nine tokens plus color-scheme, nothing else
      expect(r.props.size).toBe(TOKEN_NAMES.length + 1)
    },
  )

  it('refuses a cache stamped with a different engine version', () => {
    const r = run({ ...cacheFor(777), 'ttt-palette-v': '99' })
    expect(r.theme).toBe('funky')
    expect(r.props.size).toBe(0)
    expect(r.polarity).toBeNull()
  })

  it('refuses a cache with no version stamp at all', () => {
    const c = cacheFor(777)
    delete (c as Record<string, string>)['ttt-palette-v']
    expect(run(c).theme).toBe('funky')
  })

  it('refuses a partial cache rather than painting half a palette', () => {
    const full = toCache(generate(777)) as unknown as Record<string, string>
    for (const missing of TOKEN_NAMES) {
      const partial: Record<string, string> = { ...full }
      delete partial[missing]
      const r = run({
        'ttt-theme': 'random',
        'ttt-palette': JSON.stringify(partial),
        'ttt-palette-v': ENGINE_VERSION,
      })
      expect(r.theme, `missing --${missing}`).toBe('funky')
      expect(r.props.size, `missing --${missing}`).toBe(0)
    }
  })

  it.each(['not json', '', 'null', '[]', '{'])(
    'refuses malformed cache %o',
    (body) => {
      const r = run({
        'ttt-theme': 'random',
        'ttt-palette': body,
        'ttt-palette-v': ENGINE_VERSION,
      })
      expect(r.theme).toBe('funky')
      expect(r.props.size).toBe(0)
    },
  )

  it('treats an unknown polarity as dark rather than emitting it verbatim', () => {
    const c = toCache(generate(777)) as unknown as Record<string, string>
    const r = run({
      'ttt-theme': 'random',
      'ttt-palette': JSON.stringify({ ...c, polarity: 'sideways' }),
      'ttt-palette-v': ENGINE_VERSION,
    })
    expect(r.theme).toBe('random')
    expect(r.polarity).toBe('dark')
    expect(r.props.get('color-scheme')).toBe('dark')
  })

  /* Values, not just keys. Checking only that each key was PRESENT let a value
     CSSOM refuses through: setProperty silently drops anything with a top-level
     semicolon, so some tokens went unset while data-theme was still set to
     random -- and the recovery path keys off data-theme, so it could not see
     that state and the broken palette survived reloads. Reproduced in a browser
     as black text on a near-black background. */
  it.each([
    ['a declaration-escape attempt', 'red; background:url(http://evil/x)'],
    ['a var() self-reference', 'var(--text)'],
    ['a rule-close attempt', '}html{display:none}'],
    ['too few channels', '10 20'],
    ['too many channels', '10 20 30 40'],
    ['a four-digit channel', '10 20 3000'],
    ['a float channel', '10.5 20 30'],
    ['a named colour', 'rebeccapurple'],
    ['a hex colour', '#ff0000'],
    ['an empty value', ''],
    ['leading whitespace', ' 10 20 30'],
  ])('refuses %s in any token and paints nothing', (_label, bad) => {
    const good = toCache(generate(777)) as unknown as Record<string, string>
    for (const name of TOKEN_NAMES) {
      const r = run({
        'ttt-theme': 'random',
        'ttt-palette': JSON.stringify({ ...good, [name]: bad }),
        'ttt-palette-v': ENGINE_VERSION,
      })
      expect(r.theme, `--${name} = ${JSON.stringify(bad)}`).toBe('funky')
      // partial application is the specific failure being prevented
      expect(r.props.size, `--${name} = ${JSON.stringify(bad)}`).toBe(0)
    }
  })

  it('still accepts every value the real toCache() produces', () => {
    // The flip side: the validator must not be so strict it rejects the
    // producer. Channels are 0-255 integers, so "0 0 0" and "255 255 255" are
    // both legal and must pass.
    for (const seed of [1, 777, 2048, 31337, 99999]) {
      const r = run({
        'ttt-theme': 'random',
        'ttt-palette': JSON.stringify(toCache(generate(seed))),
        'ttt-palette-v': ENGINE_VERSION,
      })
      expect(r.theme, `seed ${seed}`).toBe('random')
      expect(r.props.size, `seed ${seed}`).toBe(TOKEN_NAMES.length + 1)
    }
  })

  it('applies a light-polarity palette as light', () => {
    // seed 2048 is light; assert the fixture still is, so the test stays honest
    const palette = generate(2048)
    expect(palette.polarity).toBe('light')
    expect(run(cacheFor(2048)).polarity).toBe('light')
  })
})
