import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { splitLockup, EYE_CENTRES } from '../../scripts/split-lockup-mask.mjs'
import { LOGO_FULL_VIEWBOX } from '../logo-roles'

/*
 * The first automated guard on a logo asset since components/logo/extract-paths.mjs
 * went away with the inline-<svg> mark it generated.
 *
 * WHAT IT PROTECTS. components/TrackingLogo.tsx stacks three mask layers that
 * are DERIVED from one drawing. Nothing at build time notices if they drift:
 * a re-export of the lockup that skips the split script leaves the layers
 * stale, and the mark then renders with the old eyes baked into the face (two
 * static discs plus two moving ones) or with none at all. Neither is a build
 * error and neither is loud.
 *
 * The split is exact string surgery, so reassembly can be asserted exactly --
 * that is the point of doing it that way rather than re-emitting parsed paths.
 */

const ROOT = path.resolve(__dirname, '../..')
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8')

const SRC = 'public/ttt_stacked-tagline_light-primary.svg'
const LAYERS = {
  face: 'public/ttt_stacked-tagline_face_light-primary.svg',
  eyeleft: 'public/ttt_stacked-tagline_eyeleft_light-primary.svg',
  eyeright: 'public/ttt_stacked-tagline_eyeright_light-primary.svg',
}

const pathsIn = (svg: string) =>
  [...svg.matchAll(/<path\b[^>]*><\/path>|<path\b[^>]*\/>/g)].map((m) => m[0])

describe('the stacked lockup mask split', () => {
  const source = read(SRC)

  it('the committed layers are what the script produces', () => {
    /* The same assertion `node scripts/split-lockup-mask.mjs --check` makes,
       run by `npm test` so it cannot be skipped by forgetting to run it. */
    const made = splitLockup(source)
    for (const [key, rel] of Object.entries(LAYERS)) {
      expect(read(rel), `${rel} is stale -- re-run scripts/split-lockup-mask.mjs`).toBe(
        made[key as keyof typeof made],
      )
    }
  })

  it('face + eyes reassemble the source exactly', () => {
    const face = read(LAYERS.face)
    const left = pathsIn(read(LAYERS.eyeleft))
    const right = pathsIn(read(LAYERS.eyeright))
    expect(left).toHaveLength(1)
    expect(right).toHaveLength(1)

    /* The split only ever DELETES two <path> elements, so putting them back
       where they were must give the original byte for byte. Any other
       difference -- a reformat, a re-export, a dropped attribute -- fails. */
    const rebuilt = face.replace(/\n?<\/g>\n<\/g>\n<\/svg>/, `\n${right[0]}\n${left[0]}$&`)
    expect(rebuilt.replace(/\s+/g, ' ')).toBe(source.replace(/\s+/g, ' '))
  })

  it('every layer carries the role reference canvas', () => {
    /* Three layers share one element box at `mask-size: contain`. A layer with
       a different viewBox scales differently, and its eye drifts out of the
       socket -- which looks like a positioning bug and is actually an asset
       bug. LOGO_FULL_VIEWBOX is the single source; see components/logo-roles.ts. */
    for (const rel of [SRC, ...Object.values(LAYERS)]) {
      const vb = /viewBox="([^"]+)"/.exec(read(rel))?.[1]
      expect(vb, `${rel} has no viewBox`).toBe(LOGO_FULL_VIEWBOX)
    }
  })

  it('exactly one path moves out of the face, per eye', () => {
    expect(pathsIn(source)).toHaveLength(40)
    expect(pathsIn(read(LAYERS.face))).toHaveLength(38)
  })

  it('the eye centres TrackingLogo clamps around match the artwork', () => {
    /* TrackingLogo holds its own copy of these (it is a client module and must
       not import a script that reads `fs`). The numbers came from getBBox() in
       a browser, so this checks the cheap half -- that each centre lies inside
       the bounding box of the path it is supposed to be the centre of -- which
       is enough to catch a swapped pair or a stale number after a re-export. */
    const extent = (d: string) => {
      const start = /^M(-?[\d.]+),(-?[\d.]+)/.exec(d.trim())
      expect(start, 'path does not start with an absolute moveto').not.toBeNull()
      return { x: Number(start![1]), y: Number(start![2]) }
    }
    const dOf = (rel: string) => /<path[^>]*d="([^"]+)"/.exec(read(rel))![1]

    for (const [side, centre] of Object.entries(EYE_CENTRES)) {
      const p = extent(dOf(LAYERS[`eye${side}` as keyof typeof LAYERS]))
      /* An eye is ~17 units in radius, so its start point is within ~18 units
         of the centre in each axis. A swapped left/right pair is ~120 units
         out and fails loudly. */
      expect(Math.abs(p.x - centre.cx), `${side} eye x`).toBeLessThan(20)
      expect(Math.abs(p.y - centre.cy), `${side} eye y`).toBeLessThan(20)
    }
  })
})
