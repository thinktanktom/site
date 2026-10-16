#!/usr/bin/env node
/**
 * Browser end-to-end checks for the random palette theme.
 *
 * NOT part of `npm test` -- it needs a real browser, and vitest covers the
 * engine. Run it against a built static export when touching the theme system,
 * the pre-paint script, or the logo marks:
 *
 *   npm run build && node scripts/e2e-palette.mjs
 *
 * Chromium comes from nixpkgs because Playwright's bundled binary cannot run on
 * NixOS (generic dynamically-linked ELF, hits the stub-ld error). No test
 * dependency is installed; this drives CDP over Node's built-in WebSocket.
 *
 * The site has TWO themes: funky (the default, held by :root) and random. The
 * switcher is therefore two buttons, funky first and the dice LAST -- pick(0)
 * and b[b.length - 1] below rely on exactly that.
 *
 * What it covers that vitest cannot: that the palette is actually PAINTED, that
 * a reload restores it before first paint, that switching back to funky removes
 * the inline custom properties (inline styles beat the stylesheet, so a leftover
 * would pin funky to the last random palette), that the masked logo mark's ink
 * follows --accent, that a stale cache recovers from the seed with React state
 * in step, and that the nav does not overflow.
 *
 * It also pins the dice's two-state action (section 7b): the press that enters
 * random RESTORES the reader's last palette, and every press after that ROLLS.
 * vitest cannot reach that -- it lives in a click handler in a client component
 * that reads both the live DOM attribute and localStorage, and the thing worth
 * proving is that the restored palette is the same one that was PAINTED before,
 * which needs a browser.
 */
import { spawn } from 'child_process'

import { createServer } from 'http'
import { readFile, stat } from 'fs/promises'
import { readFileSync } from 'fs'
import { join, extname, dirname } from 'path'
import { fileURLToPath } from 'url'

/* Chromium launch helper.
   Two hazards learned the hard way:
   1. spawn('nix',['run',...]) means the chromium we care about is a GRANDCHILD;
      killing the nix wrapper leaves it alive, holding its debug port. Launch
      detached and kill the whole process GROUP.
   2. A fixed debug port collides with other chromium instances on this machine
      (another session was squatting 9224, so we attached to its about:blank and
      every selector came back null). Allocate a free port per run and verify
      the browser we attached to is the one we launched. */
import { createServer as _cs } from 'http'
async function freePort() {
  return await new Promise((res) => {
    const s = _cs(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)) })
  })
}
async function launchChrome(width, height) {
  const port = await freePort()
  const profile = '/tmp/claude-chrome-' + process.pid + '-' + port
  const proc = spawn('nix', ['run', 'nixpkgs#chromium', '--', '--headless=new',
    '--disable-gpu', '--no-sandbox', '--remote-debugging-port=' + port,
    '--force-device-scale-factor=1', '--window-size=' + width + ',' + height,
    '--user-data-dir=' + profile, '--no-first-run', '--no-default-browser-check',
    '--disable-session-crashed-bubble', 'about:blank'],
    { stdio: 'ignore', detached: true })
  let target
  for (let i = 0; i < 80; i++) {
    await new Promise((r) => setTimeout(r, 500))
    try {
      const l = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json()
      target = l.find((t) => t.type === 'page')
      if (target?.webSocketDebuggerUrl) break
    } catch {}
  }
  if (!target) { try { process.kill(-proc.pid, 'SIGKILL') } catch {} throw new Error('chromium never exposed a target on port ' + port) }
  const kill = () => { try { process.kill(-proc.pid, 'SIGKILL') } catch {} }
  return { target, kill, port, profile }
}


/* Resolved from this file's location, never from process.cwd(): a relative
   'out' silently served 404s when the harness was run from another directory,
   and the browser rendered the 404 body with the right URL and no <nav>, which
   looks exactly like a broken component. */
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'out')
const PORT = 8097
const ORIGIN = 'http://127.0.0.1:' + PORT
/* Read from the source so a version bump cannot leave this harness asserting a stale stamp. */
const EXPECTED_V = (readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'lib/palette/apply.ts'), 'utf8').match(/ENGINE_VERSION = '([^']*)'/) || [])[1]
const TYPES = { '.html':'text/html','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml',
  '.png':'image/png','.json':'application/json','.woff2':'font/woff2','.ico':'image/x-icon','.txt':'text/plain' }
const server = createServer(async (req, res) => {
  try {
    // Strip a trailing slash before resolving: next's static export writes
    // writing/slug.html, not writing/slug/index.html, so '/writing/slug/'
    // would otherwise resolve to '.../slug/.html'.
    let rel = decodeURIComponent(req.url.split('?')[0]).replace(/\/+$/, '') || '/'
    let p = join(ROOT, rel)
    // Next's static export writes BOTH out/projects.html (the page) and
    // out/projects/ (its sub-routes), and that directory has no index.html.
    // So a directory hit must fall back to "<dir>.html" rather than 404 --
    // which it silently did, and the page then looked broken rather than missing.
    try {
      if ((await stat(p)).isDirectory()) {
        const index = join(p, 'index.html')
        try { await stat(index); p = index } catch { p += '.html' }
      }
    } catch {
      if (!extname(p)) p += '.html'
    }
    const b = await readFile(p)
    res.writeHead(200, { 'content-type': TYPES[extname(p)] || 'application/octet-stream' }); res.end(b)
  } catch { res.writeHead(404); res.end('nf'); console.error('  [404] ' + req.url) }
})
await new Promise((r) => server.listen(PORT, '127.0.0.1', r))

const { target, kill } = await launchChrome(1280, 900)
const ws = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j })
let id = 0; const pend = new Map()
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) } }
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method, params })) })
const evalJs = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
  if (r.result?.exceptionDetails) throw new Error('JS: ' + JSON.stringify(r.result.exceptionDetails).slice(0, 400))
  return r.result?.result?.value
}
/* Navigate and WAIT FOR THE PAGE, not for a guessed number of milliseconds.
   location.href updates when the navigation commits, which is before the body
   has parsed -- a fixed sleep raced that and made a present <nav> look absent
   on a cold-cache profile. Poll for readyState plus the hydration-dependent
   control we are about to drive. */
const goto = async (url) => {
  await send('Page.navigate', { url })
  for (let i = 0; i < 80; i++) {
    await new Promise((r) => setTimeout(r, 250))
    const ready = await send('Runtime.evaluate', {
      expression: "document.readyState === 'complete' && !!document.querySelector('nav') && !!document.querySelector('[aria-label=\"Colour theme\"] button')",
      returnByValue: true,
    })
    if (ready.result?.result?.value === true) {
      // let React hydrate and attach its listeners before we click anything
      await new Promise((r) => setTimeout(r, 700))
      return
    }
  }
  throw new Error('page never became ready: ' + url)
}

await send('Page.enable'); await send('Runtime.enable')
const pass = [], fail = []
const check = (name, ok, detail) => (ok ? pass : fail).push(`${name}${detail ? ' — ' + detail : ''}`)

const SNAP = `(() => {
  const h = document.documentElement, cs = getComputedStyle(h);
  const vis = (s) => { const e = document.querySelector(s); return !!e && getComputedStyle(e).display !== 'none' };
  const nav = document.querySelector('nav');
  return {
    theme: h.dataset.theme || null, polarity: h.dataset.polarity || null,
    inlineBg: h.style.getPropertyValue('--bg').trim(),
    inlineAccent: h.style.getPropertyValue('--accent').trim(),
    computedBg: cs.getPropertyValue('--bg').trim(),
    computedAccent: cs.getPropertyValue('--accent').trim(),
    colorScheme: h.style.getPropertyValue('color-scheme').trim(),
    bodyBg: getComputedStyle(document.body).backgroundColor,
    randomMarkVisible: vis('nav .only-random'), funkyMarkVisible: vis('nav .only-funky'),
    maskInk: (() => { const m = document.querySelector('nav .only-random .logo-mask');
      return m ? getComputedStyle(m).backgroundColor : null })(),
    maskImage: (() => { const m = document.querySelector('nav .only-random .logo-mask');
      if (!m) return null; const cs = getComputedStyle(m);
      return cs.maskImage || cs.webkitMaskImage || '' })(),
    inlineSvgInHtml: !!document.querySelector('nav .only-random svg'),
    navOverflow: nav ? nav.scrollWidth - nav.clientWidth : null,
    pressed: (() => { const g = document.querySelector('[role="group"][aria-label="Colour theme"]');
      return g ? [...g.querySelectorAll('button')].map((b) => b.getAttribute('aria-pressed')) : null })(),
    diceLabel: (() => { const g = document.querySelector('[role="group"][aria-label="Colour theme"]');
      if (!g) return null; const b = [...g.querySelectorAll('button')]; return b[b.length-1].getAttribute('title') })(),
    storedTheme: localStorage.getItem('ttt-theme'), storedSeed: localStorage.getItem('ttt-seed'),
    storedV: localStorage.getItem('ttt-palette-v'),
    cachedKeys: (() => { try { return Object.keys(JSON.parse(localStorage.getItem('ttt-palette')||'{}')).length } catch { return -1 } })(),
  };
})()`

// 0. Confirm we attached to our OWN browser and our own page. A fixed debug
// port previously collided with another chromium on this machine, so every
// selector came back null against a stranger's about:blank and the failure
// looked like a broken component.
await goto(ORIGIN + '/')
const SANITY = 'JSON.stringify({ href: location.href, hasNav: !!document.querySelector("nav"), hasSwitcher: !!document.querySelector(\'[role="group"][aria-label="Colour theme"]\') })'
{
  const raw = await evalJs(SANITY)
  const k = JSON.parse(raw)
  if (!k.href.startsWith(ORIGIN) || !k.hasNav || !k.hasSwitcher) {
    kill(); server.close()
    throw new Error('attached to the wrong page/browser: ' + raw)
  }
  console.log('attached OK -> ' + k.href)
}

// 1. clean load -> funky
await goto(ORIGIN + `/`)
await evalJs(`localStorage.clear()`)
await goto(ORIGIN + `/`)
let s = await evalJs(SNAP)
check('clean load renders funky', s.theme === 'funky' && !s.inlineBg, `theme=${s.theme} inlineBg="${s.inlineBg}"`)
check('funky mark visible, random hidden', s.funkyMarkVisible && !s.randomMarkVisible,
  `funky=${s.funkyMarkVisible} random=${s.randomMarkVisible}`)
/* Storage was just cleared, so there is nothing to restore and the dice must
   advertise a roll. This is the empty-store half of the dice's two-state name;
   section 7b covers the other two states. The empty-store BEHAVIOUR needs no
   check of its own -- the press in section 2 below happens in exactly this
   state, so 'dice applies a random palette' already is that assertion. */
check('dice is labelled a roll when nothing is stored',
  s.diceLabel === 'Roll a new palette' && !s.storedSeed,
  `title="${s.diceLabel}" seed=${s.storedSeed}`)

// 2. click the dice
const diceClick = `(() => { const g = document.querySelector('[role="group"][aria-label="Colour theme"]');
  const b = [...g.querySelectorAll('button')]; const d = b[b.length-1]; d.click(); return b.length })()`
const nBtns = await evalJs(diceClick)
await new Promise((r) => setTimeout(r, 400))
s = await evalJs(SNAP)
check('switcher has 2 buttons', nBtns === 2, `found ${nBtns}`)
// localStorage was cleared just above, so this press has nothing to restore and
// must roll. Covered again explicitly in 7c with the label assertions.
check('dice applies a random palette', s.theme === 'random' && /^\d+ \d+ \d+$/.test(s.inlineBg),
  `theme=${s.theme} --bg="${s.inlineBg}"`)
check('polarity published', s.polarity === 'dark' || s.polarity === 'light', `polarity=${s.polarity}`)
check('color-scheme matches polarity', s.colorScheme === s.polarity, `${s.colorScheme} vs ${s.polarity}`)
check('page actually repaints', s.bodyBg === `rgb(${s.inlineBg.replace(/ /g, ', ')})`, `body=${s.bodyBg} token=${s.inlineBg}`)
check('random mark visible, funky hidden', s.randomMarkVisible && !s.funkyMarkVisible,
  `random=${s.randomMarkVisible} funky=${s.funkyMarkVisible}`)
check('masked mark is painted with --accent', s.maskInk === `rgb(${s.inlineAccent.replace(/ /g, ', ')})`,
  `background=${s.maskInk} accent=${s.inlineAccent}`)
check('masked mark actually carries a mask image', !!s.maskImage && s.maskImage !== 'none',
  `mask-image=${s.maskImage}`)
check('no logo path geometry is inlined in the HTML', !s.inlineSvgInHtml,
  `inline svg present=${s.inlineSvgInHtml}`)
check('seed + 9-token cache + stamp persisted',
  s.storedTheme === 'random' && +s.storedSeed > 0 && s.cachedKeys === 10 && s.storedV === EXPECTED_V,
  `seed=${s.storedSeed} cachedKeys=${s.cachedKeys} v=${s.storedV}`)
check('no nav overflow in random', s.navOverflow === 0, `overflow=${s.navOverflow}`)
const seedBefore = s.storedSeed, bgBefore = s.inlineBg

// 3. reload -> restored pre-paint from cache, same palette
await goto(ORIGIN + `/`)
let s2 = await evalJs(SNAP)
check('reload restores the same palette', s2.theme === 'random' && s2.inlineBg === bgBefore && s2.storedSeed === seedBefore,
  `bg ${bgBefore} -> ${s2.inlineBg}, seed ${seedBefore} -> ${s2.storedSeed}`)

// 4. re-roll changes it
await evalJs(diceClick); await new Promise((r) => setTimeout(r, 400))
let s3 = await evalJs(SNAP)
check('pressing dice again re-rolls', s3.storedSeed !== seedBefore && s3.inlineBg !== bgBefore,
  `seed ${seedBefore} -> ${s3.storedSeed}`)

// 5. back to funky -> inline properties must be REMOVED. Button 0 is funky;
// the dice is the last button. Two buttons now, so pick(0) and the dice are the
// whole control.
const pick = (i) => `(() => { const g = document.querySelector('[role="group"][aria-label="Colour theme"]');
  g.querySelectorAll('button')[${i}].click(); return true })()`
await evalJs(pick(0)); await new Promise((r) => setTimeout(r, 400))
let s4 = await evalJs(SNAP)
check('switching to funky clears inline tokens', s4.theme === 'funky' && !s4.inlineBg && !s4.inlineAccent && !s4.polarity,
  `inlineBg="${s4.inlineBg}" inlineAccent="${s4.inlineAccent}" polarity=${s4.polarity}`)
check('funky repaints to its own palette', s4.computedBg === '10 10 10' && s4.computedAccent === '232 255 0',
  `bg=${s4.computedBg} accent=${s4.computedAccent}`)

// 6. stale cache -> funky pre-paint, then corrected from seed after hydration
await evalJs(`(() => { localStorage.setItem('ttt-theme','random'); localStorage.setItem('ttt-palette-v','99'); return 1 })()`)
await goto(ORIGIN + `/`)
let s5 = await evalJs(SNAP)
check('stale cache recovers to random from the seed', s5.theme === 'random' && s5.storedV === EXPECTED_V && !!s5.inlineBg,
  `theme=${s5.theme} v=${s5.storedV} bg="${s5.inlineBg}"`)
// The DOM recovering is not enough: React state has to recover with it, or
// aria-pressed points at the wrong button and the next dice press restores the
// stored seed instead of re-rolling. This is the assertion the first version of
// this suite was missing.
check('recovery syncs aria-pressed onto the dice', JSON.stringify(s5.pressed) === JSON.stringify(['false','true']),
  `aria-pressed=${JSON.stringify(s5.pressed)}`)
check('recovery relabels the dice as a re-roll', s5.diceLabel === 'Roll a new palette',
  `title="${s5.diceLabel}"`)
// and the next press must actually re-roll, not restore
const seedAfterRecovery = s5.storedSeed
await evalJs(diceClick); await new Promise((r) => setTimeout(r, 400))
const s6 = await evalJs(SNAP)
check('press after recovery re-rolls rather than restoring', s6.storedSeed !== seedAfterRecovery,
  `seed ${seedAfterRecovery} -> ${s6.storedSeed}`)

// 7. a code block borrows a Shiki set by polarity (writing page has one)
await goto(ORIGIN + `/writing/mcp-connected-no-tools`)
const code = await evalJs(`(() => {
  const pre = document.querySelector('[data-rehype-pretty-code-figure] pre');
  if (!pre) return { none: true };
  const h = document.documentElement;
  return { theme: h.dataset.theme, polarity: h.dataset.polarity,
    bg: getComputedStyle(pre).backgroundColor, color: getComputedStyle(pre).color };
})()`)
check('a code block IS present to test', !code.none, JSON.stringify(code))
check('code block borrows a Shiki set by polarity',
  !code.none && code.bg !== 'rgba(0, 0, 0, 0)' && !!code.color && code.color !== 'rgb(0, 0, 0)', JSON.stringify(code))

// 7b. The dice RESTORES the palette the reader last landed on when it is
// arriving from funky, and ROLLS once random is already live. This block is
// the inverse of what it asserted before 2026-10-16, deliberately: the old
// rule was "the dice ALWAYS rolls", and it was traded away so that a reader
// who wanders off to funky and comes back gets their own palette rather than
// a stranger's. The negative control for the new rule is the pair below --
// restore must return the SAME seed and the same painted --bg, and the press
// after it must still produce a different one, or "restore" has quietly become
// "never roll again".
await goto(ORIGIN + '/')
const beforeDetour = await evalJs(SNAP)
const seedBeforeNamed = beforeDetour.storedSeed
const bgBeforeNamed = beforeDetour.inlineBg
await evalJs(pick(0)) // funky
await new Promise((r) => setTimeout(r, 300))
const onFunky = await evalJs(SNAP)
// The button has to say which of the two things it is about to do.
check('dice is relabelled as a restore while funky is active',
  onFunky.diceLabel === 'Restore your last palette', `title="${onFunky.diceLabel}"`)
await evalJs(diceClick)
await new Promise((r) => setTimeout(r, 400))
const afterNamed = await evalJs(SNAP)
/* Same seed AND same --bg. The seed alone would pass if the restore wrote the
   stored seed back but painted something else; the --bg alone would pass on a
   coincidence. Checking both also proves generate(seed) still agrees with the
   cache the pre-paint script pasted, since the restore path re-runs the engine
   rather than reading ttt-palette. */
check('dice RESTORES the stored palette when arriving from funky',
  !!seedBeforeNamed && afterNamed.storedSeed === seedBeforeNamed &&
    afterNamed.inlineBg === bgBeforeNamed && afterNamed.theme === 'random',
  `seed ${seedBeforeNamed} -> ${afterNamed.storedSeed}, bg ${bgBeforeNamed} -> ${afterNamed.inlineBg}`)
check('restoring relabels the dice back to a re-roll',
  afterNamed.diceLabel === 'Roll a new palette', `title="${afterNamed.diceLabel}"`)

/* And the press after the restore must still roll -- without this, "restore"
   could silently mean "never roll again". One press is enough: this is a
   random->random press, the same operation asserted at 'pressing dice again
   re-rolls' and 'press after recovery re-rolls', so a second consecutive press
   here would only repeat it. */
const first = afterNamed.storedSeed
await evalJs(diceClick)
await new Promise((r) => setTimeout(r, 400))
const second = await evalJs(SNAP)
check('the press after a restore rolls a new palette',
  second.storedSeed !== first, `${first} -> ${second.storedSeed}`)

// 8. The alpha-composited accent utilities. These are the one family the
// generator cannot bound -- it picks colours, and these are composites of one --
// so the fix is CSS and has to be verified as rendered, not as intended.
await goto(ORIGIN + '/projects')
const chip = await evalJs(`(() => {
  const srgb = (s) => s.match(/[0-9.]+/g).slice(0, 3).map(Number);
  const lin = (c) => { const x = c / 255; return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4) };
  const lum = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
  const cr = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05) };
  const h = document.documentElement;
  const page = srgb(getComputedStyle(document.body).backgroundColor);
  const byClass = (frag) => [...document.querySelectorAll('[class]')].find((e) => String(e.className).includes(frag));
  /* Scan for every element whose border actually RENDERS translucent. Picking
     one element by class was wrong: the first match carried
     hover:border-accent/40, so its resting border is --border at alpha 1 and
     the measurement said nothing about the accent. */
  const translucent = [...document.querySelectorAll('[class]')].map((e) => {
    const bc = getComputedStyle(e).borderColor;
    const m = (bc.match(/[0-9.]+/g) || []).map(Number);
    if (m.length < 4 || m[3] >= 1 || m[3] === 0) return null;
    const composite = [0, 1, 2].map((i) => Math.round(m[i] * m[3] + page[i] * (1 - m[3])));
    const cls = String(e.className);
    /* Only ACCENT-derived borders are held to the 3:1 UI floor. border-border/40
       is a neutral decorative hairline on a tag chip whose text label carries
       the meaning, and it composites to ~1.09:1 in funky too -- holding the
       random theme to a bar the brand theme does not meet would be incoherent.
       Tracked separately below as a parity check instead. */
    /* border-accent/40 is the one held to the 3:1 UI floor: it is a card and
       panel BOUNDARY, and it is the utility that regressed (1.72:1 worst with a
       generated accent, against 3.47-4.74 with a hand-picked one).
       border-accent/30 and border-success/40 outline chips that always carry an
       icon AND a text label, and are already under the floor in funky itself,
       so they are decorative and tracked for parity instead. */
    const uiFloor = cls.includes('border-accent/40');
    const accentish = cls.includes('accent') || cls.includes('success');
    return { cls: cls.slice(0, 70), alpha: m[3], cr: +cr(composite, page).toFixed(3), accentish, uiFloor };
  }).filter(Boolean);
  const tag = byClass('bg-accent/10');
  const out = { theme: h.dataset.theme, polarity: h.dataset.polarity || null, page: page.join(' ') };
  out.translucentBorders = translucent.length;
  const boundary = translucent.filter((t) => t.uiFloor);
  out.boundaryBorders = boundary.length;
  if (boundary.length) {
    boundary.sort((a, b) => a.cr - b.cr);
    out.worstBoundaryBorder = boundary[0];
  }
  const decorative = translucent.filter((t) => t.accentish && !t.uiFloor);
  out.decorativeBorders = decorative.length;
  if (decorative.length) {
    decorative.sort((a, b) => a.cr - b.cr);
    out.worstDecorativeBorder = decorative[0];
  }
  const accentBorders = translucent.filter((t) => t.accentish);
  out.accentBorders = accentBorders.length;
  if (accentBorders.length) {
    out.minAccentAlpha = Math.min(...accentBorders.map((t) => t.alpha));
  }
  if (translucent.length) {
    translucent.sort((a, b) => a.cr - b.cr);
    out.worstAnyBorder = translucent[0];
  }
  if (tag) {
    const tbg = srgb(getComputedStyle(tag).backgroundColor);
    const tfg = srgb(getComputedStyle(tag).color);
    out.chipBg = tbg.join(' ');
    out.chipFg = tfg.join(' ');
    out.chipSurface = getComputedStyle(h).getPropertyValue('--surface').trim();
    out.chipContrast = +cr(tfg, tbg).toFixed(3);
  }
  return JSON.stringify(out);
})()`)
{
  const c = JSON.parse(chip)
  check('projects page is in the random theme', c.theme === 'random', JSON.stringify(c))
  check('every border-accent/40 BOUNDARY composites to >= 3:1 (UI floor)',
    !c.worstBoundaryBorder || c.worstBoundaryBorder.cr >= 3,
    `${c.boundaryBorders} boundary borders; worst ${JSON.stringify(c.worstBoundaryBorder)}`)
  check('decorative accent chip borders stay at least as strong as funky\'s 2.44:1',
    !c.worstDecorativeBorder || c.worstDecorativeBorder.cr >= 2.4,
    `${c.decorativeBorders} decorative; worst ${JSON.stringify(c.worstDecorativeBorder)}`)
  check('no accent border is left at the stock 0.4 alpha',
    c.minAccentAlpha === undefined || c.minAccentAlpha > 0.4,
    `min accent alpha ${c.minAccentAlpha}`)
  check('the faintest border overall is a neutral one, not an accent one',
    !c.worstAnyBorder || !c.worstAnyBorder.accentish,
    `worst overall: ${JSON.stringify(c.worstAnyBorder)}`)
  check('chip background is the opaque surface token, not an accent tint',
    c.chipBg === undefined || c.chipBg === c.chipSurface, `chipBg=${c.chipBg} surface=${c.chipSurface}`)
  check('chip text clears WCAG AA on small text',
    c.chipContrast === undefined || c.chipContrast >= 4.5, `chipContrast=${c.chipContrast}`)
}

ws.close(); kill(); server.close()
console.log('PASS:'); pass.forEach((p) => console.log('  ✓ ' + p))
if (fail.length) { console.log('FAIL:'); fail.forEach((f) => console.log('  ✗ ' + f)) }
console.log(`\n${pass.length} passed, ${fail.length} failed`)
process.exit(fail.length ? 1 : 0)
