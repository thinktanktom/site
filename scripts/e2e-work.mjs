#!/usr/bin/env node
/**
 * Browser end-to-end checks for /work -- the merged page that replaced
 * /projects, /experience and /contributions on 2026-10-26.
 *
 *   npm run build && node scripts/e2e-work.mjs
 *
 * NOT part of `npm test`: it needs a real browser. Chromium comes from nixpkgs
 * because Playwright's bundled binary cannot run on NixOS. No test dependency
 * is installed; this drives CDP over Node's built-in WebSocket.
 *
 * What it covers that vitest cannot, and why each needs a browser:
 *
 *  - The kind filter is FOUR sr-only radios plus general-sibling CSS, with no
 *    'use client' anywhere on the page. Whether a rule actually hides a row is
 *    a question about computed style, not about markup.
 *  - Because there is no JavaScript, the filter must keep working with scripts
 *    DISABLED. Section 5 asserts exactly that via
 *    Emulation.setScriptExecutionDisabled -- the one check that would catch
 *    someone "modernising" the filter into React state, which would still pass
 *    every other assertion here.
 *  - The lg upstream rail is a grid whose track widths are arithmetic
 *    (1100 - 272 - 48 = 780, the article measure). Only layout can confirm the
 *    spine still measures 780px and that the rail sits beside it rather than
 *    under it.
 *  - Hiding a column has to COLLAPSE the grid. A surviving column that keeps
 *    its 272px sibling track leaves a visible hole, and nothing in the markup
 *    shows that.
 *
 * Traps already paid for elsewhere in scripts/ and reused here: an absolute
 * static root (a relative 'out' serves 404s from another cwd, and the browser
 * renders the 404 body under the right URL, which looks like a broken
 * component); a freshly allocated debug port (other chromium instances on this
 * machine squat fixed ones, and attaching to a stranger's makes every selector
 * return null); detached launch plus process-GROUP kill, because `nix run`
 * makes chromium a grandchild; and polling rather than sleeping, because
 * location.href commits before the body parses.
 */
import { spawn } from 'child_process'
import { createServer } from 'http'
import { readFile, stat } from 'fs/promises'
import { join, extname, dirname, resolve, sep } from 'path'
import { fileURLToPath } from 'url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'out')
const PORT = 8099
const ORIGIN = 'http://127.0.0.1:' + PORT

/* Expected shape, asserted rather than discovered, so a data change that
   silently empties the page fails here instead of rendering a blank spine. */
const EXPECT = { engagements: 15, upstream: 8, writeups: 7 }
/* max-w-article, the measure the rail arithmetic is designed to preserve. */
const ARTICLE = 780

const TYPES = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json',
  '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.txt': 'text/plain',
}

let serverErrors = 0
const server = createServer(async (req, res) => {
  try {
    let rel = decodeURIComponent(req.url.split('?')[0]).replace(/\/+$/, '') || '/'
    let p = join(ROOT, rel)
    const rootAbs = resolve(ROOT)
    const pAbs = resolve(p)
    if (pAbs !== rootAbs && !pAbs.startsWith(rootAbs + sep)) {
      res.writeHead(403); res.end('forbidden'); return
    }
    /* Next's export writes BOTH out/projects.html and out/projects/, and that
       directory has no index.html -- a directory hit must fall back to
       "<dir>.html" or the page looks broken rather than missing. */
    try {
      if ((await stat(p)).isDirectory()) {
        const index = join(p, 'index.html')
        try { await stat(index); p = index } catch { p += '.html' }
      }
    } catch {
      if (!extname(p)) p += '.html'
    }
    const body = await readFile(p)
    res.writeHead(200, { 'content-type': TYPES[extname(p)] || 'application/octet-stream' })
    res.end(body)
  } catch {
    serverErrors += 1
    res.writeHead(404); res.end('nf')
    console.error('  [404] ' + req.url)
  }
})
await new Promise((r) => server.listen(PORT, '127.0.0.1', r))

const freePort = () => new Promise((res) => {
  const s = createServer()
  s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)) })
})

const port = await freePort()
const proc = spawn('nix', ['run', 'nixpkgs#chromium', '--', '--headless=new',
  '--disable-gpu', '--no-sandbox', '--remote-debugging-port=' + port,
  '--force-device-scale-factor=1', '--window-size=1280,900',
  '--user-data-dir=/tmp/claude-e2e-work-' + process.pid, '--no-first-run',
  '--no-default-browser-check', '--disable-session-crashed-bubble', 'about:blank'],
  { stdio: 'ignore', detached: true })

const kill = () => { try { process.kill(-proc.pid, 'SIGKILL') } catch {} }

let target
for (let i = 0; i < 80; i++) {
  await new Promise((r) => setTimeout(r, 500))
  try {
    const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
    target = list.find((t) => t.type === 'page')
    if (target?.webSocketDebuggerUrl) break
  } catch {}
}
if (!target) { kill(); server.close(); throw new Error('chromium never exposed a target on port ' + port) }

const ws = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j })
let msgId = 0
const pending = new Map()
ws.onmessage = (e) => {
  const m = JSON.parse(e.data)
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) }
}
const send = (method, params = {}) => new Promise((r) => {
  const i = ++msgId; pending.set(i, r)
  ws.send(JSON.stringify({ id: i, method, params }))
})
const evalJs = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
  if (r.result?.exceptionDetails) {
    throw new Error('page threw: ' + JSON.stringify(r.result.exceptionDetails.exception?.description || r.result.exceptionDetails))
  }
  return r.result?.result?.value
}

await send('Page.enable')
await send('Runtime.enable')

async function viewport(width, height) {
  await send('Emulation.setDeviceMetricsOverride', {
    width, height, deviceScaleFactor: 1, mobile: width < 600,
  })
}

async function goto(url) {
  await send('Page.navigate', { url })
  /* Poll: a navigation commits before the body parses, so a sleep here either
     wastes time or reads a half-built document. */
  for (let i = 0; i < 80; i++) {
    await new Promise((r) => setTimeout(r, 150))
    const ok = await evalJs(
      `document.readyState === 'complete' && location.href.indexOf(${JSON.stringify(url)}) === 0 && !!document.querySelector('.work-layout')`,
    )
    if (ok) break
  }
  /* Space Mono's tracked uppercase metrics are load-bearing for the width
     assertions; a fallback face would understate them. */
  await evalJs('document.fonts.ready')
  await new Promise((r) => setTimeout(r, 250))
  const href = await evalJs('location.href')
  if (!href.startsWith(url)) throw new Error(`expected ${url}, got ${href}`)
}

let passed = 0
const failures = []
function check(name, ok, detail = '') {
  if (ok) { passed += 1; console.log(`  ✓ ${name}${detail ? ' — ' + detail : ''}`) }
  else { failures.push(name); console.log(`  ✗ ${name}${detail ? ' — ' + detail : ''}`) }
}

/* One probe used by every section. Visibility is read from offsetParent rather
   than from a class list, so it reports what the CSS actually did. */
const PROBE = `(() => {
  const vis = (el) => !!el && !!el.offsetParent;
  const rows = [...document.querySelectorAll('.work-spine > li')];
  const rail = document.querySelector('.work-rail');
  /* Direct children only. '.work-rail li' also matches the PR items INSIDE
     each cluster's <details>, which reported 18 rows for 8 clusters and made
     every count assertion here fail against a correct page. */
  const railRows = [...document.querySelectorAll('.work-rail > ol > li')];
  const spine = document.querySelector('.work-spine');
  const layout = document.querySelector('.work-layout');
  const r = (el) => { if (!el) return null; const b = el.getBoundingClientRect();
    return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), bottom: Math.round(b.bottom) }; };
  const pills = [...document.querySelectorAll('.work-pill')].map((p) => {
    const cs = getComputedStyle(p);
    return { label: p.textContent.trim(), bg: cs.backgroundColor, color: cs.color };
  });
  const d = document.documentElement;
  return JSON.stringify({
    cssWidth: innerWidth,
    spineRows: rows.length,
    spineVisible: rows.filter(vis).length,
    writeupVisible: rows.filter((el) => vis(el) && el.hasAttribute('data-writeup')).length,
    railVisible: vis(rail),
    railRows: railRows.length,
    railRowsVisible: railRows.filter(vis).length,
    spineBox: vis(spine) ? r(spine) : null,
    railBox: vis(rail) ? r(rail) : null,
    layoutCols: layout ? getComputedStyle(layout).gridTemplateColumns : null,
    layoutDisplay: layout ? getComputedStyle(layout).display : null,
    docOverflows: d.scrollWidth > d.clientWidth + 1,
    docScrollWidth: d.scrollWidth,
    pills,
    radios: [...document.querySelectorAll('.work-filter input[type=radio]')].map((i) => ({ id: i.id, checked: i.checked })),
  });
})()`

const probe = async () => JSON.parse(await evalJs(PROBE))

/* The pills carry `transition-colors duration-200`, so a measurement taken
   straight after the click reads a colour MID-TRANSITION -- the first run of
   this harness sampled the pressed pill at rgba(255,255,255,0.863) and the
   outgoing one at 0.09, and reported a correct page as broken. Same class of
   trap as the smooth-scroll one documented in CLAUDE.md: poll until the value
   holds, rather than guessing a delay. */
async function settle() {
  let last = null
  let stable = 0
  for (let i = 0; i < 40; i++) {
    const now = await evalJs(
      `[...document.querySelectorAll('.work-pill')].map((p) => getComputedStyle(p).backgroundColor + '|' + getComputedStyle(p).color).join(',')`,
    )
    stable = now === last ? stable + 1 : 0
    last = now
    if (stable >= 3) return
    await new Promise((r) => setTimeout(r, 50))
  }
}

const pick = async (id) => {
  /* Click the LABEL, not the radio: the radio is sr-only and the label is the
     real hit target, so this exercises the same path a reader does. */
  await evalJs(`document.querySelector('label[for="${id}"]').click()`)
  await settle()
}

try {
  console.log('\n1. The page renders both halves at lg')
  await viewport(1280, 900)
  await goto(ORIGIN + '/work')
  let p = await probe()
  check('the spine holds every engagement and nothing else',
    p.spineRows === EXPECT.engagements && p.spineVisible === EXPECT.engagements,
    `rows=${p.spineRows} visible=${p.spineVisible} expected=${EXPECT.engagements}`)
  check('the rail holds every upstream cluster',
    p.railVisible && p.railRows === EXPECT.upstream && p.railRowsVisible === EXPECT.upstream,
    `rows=${p.railRows} visible=${p.railRowsVisible} expected=${EXPECT.upstream}`)
  check('exactly the writeup-bearing engagements carry data-writeup',
    p.writeupVisible === EXPECT.writeups,
    `${p.writeupVisible} of ${EXPECT.writeups}`)
  check('"All" is the default selection',
    p.radios.find((r) => r.id === 'wf-all')?.checked === true,
    p.radios.filter((r) => r.checked).map((r) => r.id).join(',') || 'none')

  console.log('\n2. The rail is beside the spine, and the measure survives')
  check('the layout is a two-column grid at lg',
    p.layoutDisplay === 'grid' && /\s/.test(p.layoutCols.trim()),
    `display=${p.layoutDisplay} cols=${p.layoutCols}`)
  check('the rail sits to the RIGHT of the spine, not under it',
    p.railBox && p.spineBox && p.railBox.x >= p.spineBox.x + p.spineBox.w &&
      Math.abs(p.railBox.y - p.spineBox.y) < 80,
    `spine x=${p.spineBox?.x} w=${p.spineBox?.w} | rail x=${p.railBox?.x} y-delta=${p.railBox && p.spineBox ? p.railBox.y - p.spineBox.y : '?'}`)
  /* The whole point of 1100 - 17rem - 3rem: adding a rail must not narrow the
     reading column. Tolerance is a pixel or two of rounding, not a range. */
  check(`the spine still measures the article width (${ARTICLE}px)`,
    p.spineBox && Math.abs(p.spineBox.w - ARTICLE) <= 2,
    `${p.spineBox?.w}px`)

  console.log('\n3. Each filter shows exactly its own set, and collapses the grid')
  await pick('wf-built')
  p = await probe()
  check('"Built" shows only writeup-bearing rows',
    p.spineVisible === EXPECT.writeups && p.writeupVisible === EXPECT.writeups,
    `visible=${p.spineVisible} writeups=${p.writeupVisible}`)
  check('"Built" hides the rail',
    p.railVisible === false, `railVisible=${p.railVisible}`)
  check('"Built" collapses the grid to one track',
    p.layoutCols.trim().split(/\s+/).length === 1,
    `cols=${p.layoutCols}`)

  await pick('wf-roles')
  p = await probe()
  check('"Roles" shows every engagement',
    p.spineVisible === EXPECT.engagements, `visible=${p.spineVisible}`)
  check('"Roles" hides the rail', p.railVisible === false, `railVisible=${p.railVisible}`)
  check('"Roles" collapses the grid to one track',
    p.layoutCols.trim().split(/\s+/).length === 1, `cols=${p.layoutCols}`)

  await pick('wf-upstream')
  p = await probe()
  check('"Upstream" hides the spine entirely',
    p.spineBox === null && p.spineVisible === 0,
    `spineBox=${JSON.stringify(p.spineBox)} visible=${p.spineVisible}`)
  check('"Upstream" keeps every cluster visible',
    p.railVisible && p.railRowsVisible === EXPECT.upstream, `visible=${p.railRowsVisible}`)
  check('"Upstream" caps its single track rather than stretching to 1100px',
    p.layoutCols.trim().split(/\s+/).length === 1 && p.railBox.w <= 780,
    `cols=${p.layoutCols} railWidth=${p.railBox?.w}`)

  await pick('wf-all')
  p = await probe()
  check('"All" restores both columns',
    p.spineVisible === EXPECT.engagements && p.railRowsVisible === EXPECT.upstream,
    `spine=${p.spineVisible} rail=${p.railRowsVisible}`)

  console.log('\n4. The pressed pill comes from CSS, keyed on :checked')
  const bg = (label) => p.pills.find((x) => x.label.startsWith(label))
  check('exactly one pill is painted as pressed',
    p.pills.filter((x) => x.bg === 'rgb(255, 255, 255)').length === 1,
    p.pills.map((x) => `${x.label.split(' ')[0]}=${x.bg}`).join(' '))
  check('the pressed pill is the selected one, and it INVERTS rather than tints',
    bg('All')?.bg === 'rgb(255, 255, 255)' && bg('All')?.color === 'rgb(0, 0, 0)',
    `All bg=${bg('All')?.bg} color=${bg('All')?.color}`)

  console.log('\n5. The filter works with JavaScript DISABLED')
  /* The load-bearing one. The page ships no client component for this, and a
     rewrite into React state would pass every check above and fail only here.
     Script execution is disabled BEFORE the navigation so no hydration runs. */
  await send('Emulation.setScriptExecutionDisabled', { value: true })
  await send('Page.navigate', { url: ORIGIN + '/work' })
  await new Promise((r) => setTimeout(r, 1200))
  const noJs = JSON.parse(await (async () => {
    /* Runtime.evaluate still works with page scripts disabled, so the probe
       itself is unaffected -- only the page's own JS is suppressed. */
    const r = await send('Runtime.evaluate', { expression: PROBE, returnByValue: true })
    return r.result?.result?.value
  })())
  check('the page renders with no JS at all',
    noJs.spineRows === EXPECT.engagements && noJs.railRows === EXPECT.upstream,
    `spine=${noJs.spineRows} rail=${noJs.railRows}`)
  /* Check the radio by label-click equivalent: with JS off we cannot call
     .click(), so drive it the way a keyboard/mouse user would -- CDP input. */
  const label = await send('Runtime.evaluate', {
    expression: `(() => { const b = document.querySelector('label[for="wf-upstream"]').getBoundingClientRect();
      return JSON.stringify({ x: Math.round(b.x + b.width / 2), y: Math.round(b.y + b.height / 2) }); })()`,
    returnByValue: true,
  })
  const at = JSON.parse(label.result?.result?.value)
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: at.x, y: at.y, button: 'left', clickCount: 1 })
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: at.x, y: at.y, button: 'left', clickCount: 1 })
  await new Promise((r) => setTimeout(r, 200))
  const noJsAfter = JSON.parse((await send('Runtime.evaluate', { expression: PROBE, returnByValue: true })).result?.result?.value)
  check('a real click filters the page with JS off',
    noJsAfter.spineVisible === 0 && noJsAfter.railRowsVisible === EXPECT.upstream,
    `spine=${noJsAfter.spineVisible} rail=${noJsAfter.railRowsVisible}`)
  await send('Emulation.setScriptExecutionDisabled', { value: false })

  console.log('\n6. Mobile: the rail stacks under the spine, nothing overflows')
  for (const [w, h] of [[375, 812], [390, 844]]) {
    await viewport(w, h)
    await goto(ORIGIN + '/work')
    const m = await probe()
    check(`${w}px: the emulated width actually applied`,
      m.cssWidth === w, `cssWidth=${m.cssWidth}`)
    check(`${w}px: no horizontal overflow`,
      m.docOverflows === false, `scrollWidth=${m.docScrollWidth} vs ${w}`)
    check(`${w}px: the layout is NOT a grid`,
      m.layoutDisplay !== 'grid', `display=${m.layoutDisplay}`)
    check(`${w}px: the rail follows the spine rather than sitting beside it`,
      m.railBox && m.spineBox && m.railBox.y >= m.spineBox.bottom,
      `spine bottom=${m.spineBox?.bottom} rail y=${m.railBox?.y}`)
    check(`${w}px: both halves are still fully present`,
      m.spineVisible === EXPECT.engagements && m.railRowsVisible === EXPECT.upstream,
      `spine=${m.spineVisible} rail=${m.railRowsVisible}`)
  }

  check('the static server served no 404s', serverErrors === 0, `${serverErrors} 404s`)
} finally {
  kill()
  server.close()
}

console.log(`\n${passed} passed, ${failures.length} failed`)
if (failures.length) {
  console.log('failed:\n  - ' + failures.join('\n  - '))
  process.exit(1)
}
process.exit(0)
