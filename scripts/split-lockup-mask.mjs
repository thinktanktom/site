#!/usr/bin/env node
/*
 * Split the stacked lockup into the mask layers `TrackingLogo` needs.
 *
 * Source:  public/ttt_stacked-tagline_light-primary.svg
 * Writes:  public/ttt_stacked-tagline_face_light-primary.svg   (38 paths)
 *          public/ttt_stacked-tagline_eyeleft_light-primary.svg  (1 path)
 *          public/ttt_stacked-tagline_eyeright_light-primary.svg (1 path)
 *
 * WHY THIS IS STRING SURGERY AND NOT A RE-EMIT. The obvious implementation --
 * extract all 40 <path> elements and write them back out under one <g> -- is
 * WRONG, and wrong in a way that renders: 25 of those paths are the wordmark
 * and the tagline, and they live inside nested <g transform="translate(...)">
 * groups. Their `d` coordinates are meaningless outside those groups. Doing it
 * that way clipped the wordmark and shifted the mark to the right of it.
 * Only the frame (path 37) and the two eyes (38, 39) sit in untransformed
 * canvas space.
 *
 * So the face layer is the original file with two <path> elements DELETED, and
 * each eye layer is one of those elements under a fresh <svg> carrying the same
 * viewBox. Every other byte is untouched -- which is also what lets
 * components/__tests__/lockup-mask-split.test.ts assert reassembly exactly
 * rather than approximately.
 *
 * These files are consumed only as CSS mask alphas, so their own `fill` is
 * never read -- see CLAUDE.md note 7. The ink comes from --accent.
 *
 * Usage: node scripts/split-lockup-mask.mjs [--check]
 *   --check  verify the committed outputs match what this script would write,
 *            and exit non-zero if not. Nothing is written.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC = path.join(ROOT, 'public/ttt_stacked-tagline_light-primary.svg')

/* The reference canvas for the `full logo` role, as held by
   components/logo-roles.ts. Every layer must carry it: the layers are stacked
   in one box at `mask-size: contain`, so a different viewBox on any of them
   would scale that layer differently and the eyes would drift out of their
   sockets. */
const VIEWBOX = '0 0 1920 1080'

/* Eye centres in canvas units, read with getBBox() in a real browser rather
   than parsed out of the path strings -- the paths are relative-cubic, so
   naive number-pairing gives control points, not extents. Kept here because
   the split is what makes them addressable; TrackingLogo holds its own copy
   for the clamp, and the test asserts the two agree. */
export const EYE_CENTRES = {
  left: { cx: 929.9, cy: 293.7 },
  right: { cx: 1049.5, cy: 293.7 },
}

/** the <path> elements, in document order */
function pathElements(svg) {
  return [...svg.matchAll(/<path\b[^>]*><\/path>|<path\b[^>]*\/>/g)].map((m) => m[0])
}

export function splitLockup(svg) {
  const paths = pathElements(svg)
  if (paths.length !== 40) {
    throw new Error(`expected 40 paths in the lockup, found ${paths.length}`)
  }
  /* The eyes are the last two elements in the file, right eye first. Asserted
     by their own geometry rather than by position alone, so a re-export that
     reorders the document fails here instead of silently masking the wrong
     shapes. */
  const [right, left] = paths.slice(-2)
  if (!/M1066\.5,293/.test(right) || !/M930\.1,310\.7/.test(left)) {
    throw new Error('the last two paths are not the eyes -- re-check the export')
  }

  let face = svg
  for (const el of [right, left]) face = face.replace(el, '')

  const wrap = (el) =>
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VIEWBOX}">\n<g>\n${el}\n</g>\n</svg>\n`

  return { face, eyeleft: wrap(left), eyeright: wrap(right) }
}

const OUT = {
  face: 'public/ttt_stacked-tagline_face_light-primary.svg',
  eyeleft: 'public/ttt_stacked-tagline_eyeleft_light-primary.svg',
  eyeright: 'public/ttt_stacked-tagline_eyeright_light-primary.svg',
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const layers = splitLockup(fs.readFileSync(SRC, 'utf8'))
  const check = process.argv.includes('--check')
  let bad = 0

  for (const [key, rel] of Object.entries(OUT)) {
    const file = path.join(ROOT, rel)
    if (check) {
      const have = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null
      if (have !== layers[key]) {
        console.error(`STALE  ${rel}`)
        bad++
      } else {
        console.log(`ok     ${rel}`)
      }
    } else {
      fs.writeFileSync(file, layers[key])
      console.log(`wrote  ${rel}  ${Buffer.byteLength(layers[key])} bytes`)
    }
  }
  if (bad) {
    console.error('\nRun `node scripts/split-lockup-mask.mjs` and commit the result.')
    process.exit(1)
  }
}
