#!/usr/bin/env node
/*
 * Regenerates components/logo/paths.ts from the single-fill mono exports in
 * public/. Run from the repo root:
 *
 *     node components/logo/extract-paths.mjs
 *
 * Why a script and not a hand-copy: the stacked mark is 40 paths and ~28KB of
 * path data. Transcribing that by hand is how a silent geometry bug gets in.
 *
 * Source of truth is the *_light-primary.svg set, for two reasons: they are
 * already single-fill (so every path can take `currentColor` without losing a
 * second or third ink) and their viewBoxes are already normalised to funky's
 * canvas. The generator asserts the viewBox against the funky master's canvas
 * and refuses to write if a tight crop has snuck back in — see the INVARIANT
 * note in components/ThemedLogo.tsx for what that bug cost last time.
 *
 * The exports contain nothing but <g> and <path>, and every <g> transform is a
 * pure translate(x, y), so the group tree is flattened into one path list with
 * the ancestor translates summed. That is exact (translate composition is
 * addition) and drops ~120 structural <g> elements from the rendered DOM. The
 * script re-verifies both facts and throws if either stops holding.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '..', '..')

/* role key -> { file: the single-fill mono export to lift geometry from,
                 master: funky's asset, whose canvas every variant must share } */
const ROLES = {
  icon: {
    file: 'ttt_icon_light-primary.svg',
    master: 'ttt_icon.svg',
  },
  wordmark: {
    file: 'ttt_horizontal_light-primary.svg',
    master: 'ttt_side_no_byline_logo.svg',
  },
  logoFull: {
    file: 'ttt_stacked-tagline_light-primary.svg',
    master: 'ttt_logo_full.svg',
  },
}

const TAG = /<(\/?)([a-zA-Z][\w:-]*)((?:\s+[\w:.-]+\s*=\s*"[^"]*")*)\s*(\/?)>/g
const ATTR = /([\w:.-]+)\s*=\s*"([^"]*)"/g
const TRANSLATE = /^translate\(\s*(-?[\d.]+)(?:\s*[, ]\s*(-?[\d.]+))?\s*\)$/

function attrs(raw) {
  const out = {}
  for (const m of raw.matchAll(ATTR)) out[m[1]] = m[2]
  return out
}

/** round away float-addition noise without losing real precision */
const trim = (n) => Number(n.toFixed(6))

function extract(svg, file) {
  const root = /<svg\b([^>]*)>/.exec(svg)
  if (!root) throw new Error(`${file}: no <svg> element`)
  const viewBox = attrs(root[1]).viewBox
  if (!viewBox) throw new Error(`${file}: <svg> has no viewBox`)

  const paths = []
  /* stack of cumulative [dx, dy] offsets; index 0 is the <svg> itself */
  const stack = [[0, 0]]

  for (const m of svg.matchAll(TAG)) {
    const [, close, tag, raw, selfClose] = m
    if (tag === 'svg') continue
    if (close) {
      if (stack.length > 1) stack.pop()
      continue
    }
    const a = attrs(raw)
    if (tag === 'g') {
      const [dx, dy] = stack[stack.length - 1]
      let next = [dx, dy]
      if (a.transform) {
        const t = TRANSLATE.exec(a.transform.trim())
        if (!t) {
          throw new Error(
            `${file}: <g> carries a non-translate transform (${a.transform}). ` +
              `The flattening in this script is only valid for pure translates — ` +
              `teach it the new transform or keep the group tree instead.`
          )
        }
        next = [trim(dx + Number(t[1])), trim(dy + Number(t[2] ?? 0))]
      }
      if (!selfClose) stack.push(next)
      continue
    }
    if (tag === 'path') {
      if (!a.d) throw new Error(`${file}: <path> with no d`)
      const [dx, dy] = stack[stack.length - 1]
      paths.push({
        d: a.d.replace(/\s+/g, ' ').trim(),
        ...(dx || dy ? { transform: `translate(${dx} ${dy})` } : {}),
      })
      if (!selfClose) stack.push([dx, dy])
      continue
    }
    throw new Error(
      `${file}: unexpected <${tag}>. This extractor only understands <g> and ` +
        `<path>; anything else (style, defs, clipPath, use, text) needs handling ` +
        `before its geometry can be trusted inline.`
    )
  }
  return { viewBox, paths }
}

const readViewBox = (file) => {
  const svg = /<svg\b([^>]*)>/.exec(readFileSync(resolve(repoRoot, 'public', file), 'utf8'))
  if (!svg) throw new Error(`${file}: no <svg> element`)
  const vb = attrs(svg[1]).viewBox
  if (!vb) throw new Error(`${file}: <svg> has no viewBox`)
  return vb.trim().replace(/\s+/g, ' ')
}

const marks = {}
for (const [role, { file, master }] of Object.entries(ROLES)) {
  const expected = readViewBox(master)
  const { viewBox, paths } = extract(readFileSync(resolve(repoRoot, 'public', file), 'utf8'), file)
  if (viewBox.trim().replace(/\s+/g, ' ') !== expected) {
    throw new Error(
      `${file}: viewBox is "${viewBox}" but every variant of the "${role}" role ` +
        `must carry funky's canvas, and ${master} says that is "${expected}". ` +
        `A tight crop here is the old bug that reflowed /about by 45.83px — ` +
        `re-export the asset, do not widen this check.`
    )
  }
  if (paths.length === 0) throw new Error(`${file}: no paths extracted`)
  marks[role] = { viewBox, paths }
  process.stderr.write(
    `${role.padEnd(9)} ${file}  viewBox="${viewBox}" (matches ${master})  ${paths.length} paths\n`
  )
}

const body = Object.entries(marks)
  .map(([role, mark]) => {
    const paths = mark.paths
      .map(
        (p) =>
          `    {\n      d: ${JSON.stringify(p.d)},` +
          (p.transform ? `\n      transform: ${JSON.stringify(p.transform)},` : '') +
          `\n    },`
      )
      .join('\n')
    const name = role.replace(/[A-Z]/g, (c) => `_${c}`).toUpperCase()
    return (
      `/* ${ROLES[role].file} — ${mark.paths.length} paths */\n` +
      `export const ${name}_MARK: LogoMark = {\n` +
      `  viewBox: ${JSON.stringify(mark.viewBox)},\n` +
      `  paths: [\n${paths}\n  ],\n}\n`
    )
  })
  .join('\n')

const header = `/*
 * GENERATED FILE — do not edit by hand.
 *
 *   node components/logo/extract-paths.mjs
 *
 * Geometry for the inline, \`currentColor\` logo marks, lifted from the
 * single-fill mono exports in public/ (listed per mark below). Each mark's
 * viewBox is funky's canvas, which is what keeps the inline variant's element
 * box identical to the three <Image> variants — see the INVARIANT note in
 * components/ThemedLogo.tsx before changing anything here.
 *
 * The source files nest their paths in <g transform="translate(…)"> groups.
 * Those are flattened: each path carries the sum of its ancestors' translates,
 * so the coordinates below are not literally the ones in the file, but the
 * rendered geometry is.
 */

export type LogoPath = {
  d: string
  /* flattened ancestor translate, omitted when it is the identity */
  transform?: string
}

export type LogoMark = {
  viewBox: string
  paths: LogoPath[]
}

`

writeFileSync(resolve(here, 'paths.ts'), header + body)
process.stderr.write(`wrote components/logo/paths.ts\n`)
