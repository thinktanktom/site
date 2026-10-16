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
 * The site has TWO themes: dark-mono (the default, held by :root) and random. The
 * switcher is therefore two buttons, dark-mono first and the dice LAST -- pick(0)
 * and b[b.length - 1] below rely on exactly that.
 *
 * What it covers that vitest cannot: that the palette is actually PAINTED, that
 * a reload restores it before first paint, that switching back to dark-mono removes
 * the inline custom properties (inline styles beat the stylesheet, so a leftover
 * would pin dark-mono to the last random palette), that the masked logo mark's ink
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
    randomMarkVisible: vis('nav .only-random'), defaultMarkVisible: vis('nav .only-dark-mono'),
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

// 1. clean load -> dark-mono
await goto(ORIGIN + `/`)
await evalJs(`localStorage.clear()`)
await goto(ORIGIN + `/`)
let s = await evalJs(SNAP)
check('clean load renders dark-mono', s.theme === 'dark-mono' && !s.inlineBg, `theme=${s.theme} inlineBg="${s.inlineBg}"`)
check('dark-mono mark visible, random hidden', s.defaultMarkVisible && !s.randomMarkVisible,
  `dark-mono=${s.defaultMarkVisible} random=${s.randomMarkVisible}`)
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
check('random mark visible, dark-mono hidden', s.randomMarkVisible && !s.defaultMarkVisible,
  `random=${s.randomMarkVisible} dark-mono=${s.defaultMarkVisible}`)
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

// 5. back to dark-mono -> inline properties must be REMOVED. Button 0 is dark-mono;
// the dice is the last button. Two buttons now, so pick(0) and the dice are the
// whole control.
const pick = (i) => `(() => { const g = document.querySelector('[role="group"][aria-label="Colour theme"]');
  g.querySelectorAll('button')[${i}].click(); return true })()`
await evalJs(pick(0)); await new Promise((r) => setTimeout(r, 400))
let s4 = await evalJs(SNAP)
check('switching to dark-mono clears inline tokens', s4.theme === 'dark-mono' && !s4.inlineBg && !s4.inlineAccent && !s4.polarity,
  `inlineBg="${s4.inlineBg}" inlineAccent="${s4.inlineAccent}" polarity=${s4.polarity}`)
check('dark-mono repaints to its own palette', s4.computedBg === '0 0 0' && s4.computedAccent === '255 255 255',
  `bg=${s4.computedBg} accent=${s4.computedAccent}`)

/* 5b. The MIGRATION path, which every existing reader takes exactly once.
   'funky' was a valid stored value until 2026-10-16 and is now unknown, so the
   pre-paint script's single `!== 'random'` test has to let it fall through to
   dark-mono. vitest covers the script's logic directly (prepaint.test.ts runs
   the real source over a table of stale values); what only a browser can show
   is that the resulting page actually PAINTS dark-mono's tokens and lands the
   pressed state on the right button, rather than rendering a theme with no
   token block behind it. The same check stands in for a stale 'dark'/'light'. */
await evalJs(`(() => { localStorage.setItem('ttt-theme','funky'); return 1 })()`)
await goto(ORIGIN + '/')
const stale = await evalJs(SNAP)
check('a stale stored "funky" self-heals to a painted dark-mono',
  stale.theme === 'dark-mono' && !stale.inlineBg &&
    stale.computedBg === '0 0 0' && stale.computedAccent === '255 255 255' &&
    stale.defaultMarkVisible && !stale.randomMarkVisible &&
    JSON.stringify(stale.pressed) === JSON.stringify(['true', 'false']),
  `theme=${stale.theme} bg=${stale.computedBg} accent=${stale.computedAccent} pressed=${JSON.stringify(stale.pressed)}`)

// 6. stale cache -> dark-mono pre-paint, then corrected from seed after hydration
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
// arriving from dark-mono, and ROLLS once random is already live. This block is
// the inverse of what it asserted before 2026-10-16, deliberately: the old
// rule was "the dice ALWAYS rolls", and it was traded away so that a reader
// who wanders off to dark-mono and comes back gets their own palette rather than
// a stranger's. The negative control for the new rule is the pair below --
// restore must return the SAME seed and the same painted --bg, and the press
// after it must still produce a different one, or "restore" has quietly become
// "never roll again".
await goto(ORIGIN + '/')
const beforeDetour = await evalJs(SNAP)
const seedBeforeNamed = beforeDetour.storedSeed
const bgBeforeNamed = beforeDetour.inlineBg
await evalJs(pick(0)) // dark-mono
await new Promise((r) => setTimeout(r, 300))
const onDefault = await evalJs(SNAP)
// The button has to say which of the two things it is about to do.
check('dice is relabelled as a restore while dark-mono is active',
  onDefault.diceLabel === 'Restore your last palette', `title="${onDefault.diceLabel}"`)
await evalJs(diceClick)
await new Promise((r) => setTimeout(r, 400))
const afterNamed = await evalJs(SNAP)
/* Same seed AND same --bg. The seed alone would pass if the restore wrote the
   stored seed back but painted something else; the --bg alone would pass on a
   coincidence. Checking both also proves generate(seed) still agrees with the
   cache the pre-paint script pasted, since the restore path re-runs the engine
   rather than reading ttt-palette. */
check('dice RESTORES the stored palette when arriving from dark-mono',
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
       the meaning, and it composites to ~1.11:1 in dark-mono too -- holding the
       random theme to a bar the brand theme does not meet would be incoherent.
       Tracked separately below as a parity check instead. */
    /* border-accent/40 is the one held to the 3:1 UI floor: it is a card and
       panel BOUNDARY, and it is the utility that regressed (1.72:1 worst with a
       generated accent, against 3.47-4.74 with a hand-picked one).
       border-accent/30 and border-success/40 outline chips that always carry an
       icon AND a text label, and are already under the floor in dark-mono itself,
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
  check('decorative accent chip borders stay at least as strong as dark-mono\'s 2.48:1',
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

/* 9. The browser-tab icon follows the palette.
   Browser chrome renders the favicon outside the document, so it sees no CSS
   custom properties and the static export has no server to render a per-palette
   file -- the only route is a generated, self-contained icon handed to the
   <link>. That makes it exactly the kind of thing vitest cannot touch and a
   browser can.

   What is NOT provable here, and is called out rather than implied: whether the
   browser actually PAINTS the new icon into the tab strip. That is chrome, not
   DOM, and headless CDP cannot read it. The strongest available proxy is the
   last check below -- that the generated data URI decodes into a real image
   with non-zero intrinsic dimensions -- which is the failure mode that would
   actually matter (a malformed or unencoded SVG yields a silently blank tab). */
const faviSnap = `(() => {
  const icons = [...document.querySelectorAll('link[rel~="icon"]')].map((l) => l.getAttribute('href'));
  const apple = document.querySelector('link[rel="apple-touch-icon"]');
  const rgb = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
  const hex = rgb ? '#' + rgb.split(/\\s+/).map((n) => (+n).toString(16).padStart(2, '0')).join('') : null;
  return { icons, apple: apple ? apple.getAttribute('href') : null,
    accentHex: hex, theme: document.documentElement.dataset.theme };
})()`

/* The paint is deliberately async -- it fetches the mask asset once -- so poll
   for it rather than sleeping. A fixed sleep here would be the same mistake the
   header warns about for smooth scrolling. */
const waitForDataIcon = async (want) => {
  for (let i = 0; i < 40; i++) {
    const f = await evalJs(faviSnap)
    const isData = f.icons.every((h) => h && h.startsWith('data:image/svg+xml,'))
    if (isData === want) return f
    await new Promise((r) => setTimeout(r, 150))
  }
  return await evalJs(faviSnap)
}

await goto(ORIGIN + '/')
await evalJs(`localStorage.clear()`)
await goto(ORIGIN + '/')
const faviDefault = await evalJs(faviSnap)
check('dark-mono serves the brand icon file, not a generated one',
  faviDefault.icons.length === 2 && faviDefault.icons.every((h) => h === '/ttt_icon_dark-mono.svg'),
  JSON.stringify(faviDefault.icons))

await evalJs(diceClick)
const faviRandom = await waitForDataIcon(true)
check('rolling repaints every tab icon as a generated data URI',
  faviRandom.icons.length === 2 && faviRandom.icons.every((h) => h.startsWith('data:image/svg+xml,')),
  JSON.stringify(faviRandom.icons.map((h) => h.slice(0, 40))))
check('apple-touch-icon is deliberately left alone',
  faviRandom.apple === '/ttt_icon_dark-mono.svg', `apple=${faviRandom.apple}`)

const decoded = await evalJs(`(async () => {
  const href = document.querySelector('link[rel~="icon"]').getAttribute('href');
  const prefix = 'data:image/svg+xml,';
  if (!href.startsWith(prefix)) return { notData: href.slice(0, 60) };
  const svg = decodeURIComponent(href.slice(prefix.length));
  const fills = [...new Set((svg.match(/fill="[^"]*"/g) || []).map((s) => s.slice(6, -1).toLowerCase()))];
  const size = await new Promise((res) => {
    const img = new Image();
    img.onload = () => res({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => res(null);
    img.src = href;
  });
  return { fills, size, bytes: href.length, hasViewBox: /viewBox=/.test(svg) };
})()`)
check('the generated icon is tinted to exactly one colour, the accent',
  decoded.fills && decoded.fills.length === 1 && decoded.fills[0] === faviRandom.accentHex,
  `fills=${JSON.stringify(decoded.fills)} accent=${faviRandom.accentHex}`)
/* The real risk with a hand-built data URI is that it is malformed -- an
   unencoded '#' truncates it at the fragment and the tab silently goes blank.
   Decoding it as an image is what rules that out. */
check('the generated icon actually decodes as an image',
  !!decoded.size && decoded.size.w > 0 && decoded.size.h > 0,
  `size=${JSON.stringify(decoded.size)} bytes=${decoded.bytes} viewBox=${decoded.hasViewBox}`)

// Switching back to dark-mono must RESTORE the file. Unlike the colour tokens there
// is no stylesheet underneath the icon to fall back to, so un-setting is not
// enough and this is a separate code path worth its own check.
await evalJs(pick(0))
const faviBack = await waitForDataIcon(false)
check('switching to dark-mono puts the brand icon file back',
  faviBack.icons.every((h) => h === '/ttt_icon_dark-mono.svg'), JSON.stringify(faviBack.icons))

/* And the on-load path: the pre-paint script restores a cached palette without
   running the engine, so none of the paths above fire on a reload. Without the
   catch-up in ThemeSwitcher's effect the tab would show the dark-mono icon over a
   random page -- which is the original bug, just one reload later. */
await evalJs(diceClick)
await waitForDataIcon(true)
await goto(ORIGIN + '/')
const faviReload = await waitForDataIcon(true)
check('a reload with a stored palette repaints the icon from the applied accent',
  faviReload.theme === 'random' &&
    faviReload.icons.every((h) => h.startsWith('data:image/svg+xml,')),
  `theme=${faviReload.theme} icons=${JSON.stringify(faviReload.icons.map((h) => h.slice(0, 32)))}`)

/* 9b. The icon must survive a CLIENT-SIDE navigation.
   This is a distinct path from both of the above and it is the one that shipped
   broken: a reload re-runs the pre-paint script and ThemeSwitcher's mount
   effect, but an in-app <Link> click does neither. Next resolves route metadata
   on every navigation and reconciles <head>, which RE-CREATES the icon <link>
   from the static value in layout.tsx -- silently reverting the tab to the
   default mark while the page itself is still in a random palette.

   ThemeSwitcher lives in the root layout's <Nav>, so it does NOT remount on a
   route change and its effect cannot catch this. The fix watches usePathname().

   Driven by clicking a real nav anchor rather than Page.navigate, because
   Page.navigate is a full document load and would NOT reproduce the bug -- it
   re-runs everything the mount path already covers. Asserting against a
   hard-coded href would also be wrong here: this must stay true whichever file
   is the default mark, so the expected value is read out of favicon.ts. */
const DEFAULT_ICON = (readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'lib/palette/favicon.ts'), 'utf8',
).match(/DEFAULT_URL = '([^']*)'/) || [])[1]
check('the harness found the default icon path in favicon.ts', !!DEFAULT_ICON,
  `DEFAULT_URL=${DEFAULT_ICON}`)

await goto(ORIGIN + '/')
await evalJs(diceClick)
const beforeNav = await waitForDataIcon(true)
// A real in-app link click. Returns the href so a selector change fails loudly
// rather than silently testing nothing.
const navClicked = await evalJs(`(() => {
  const a = document.querySelector('nav a[href="/writing"]');
  if (!a) return null;
  a.click();
  return a.getAttribute('href');
})()`)
check('a nav link to /writing exists to click', navClicked === '/writing',
  `clicked=${JSON.stringify(navClicked)}`)
// Poll for the route to actually commit; a client nav has no load event.
for (let i = 0; i < 60; i++) {
  const href = await evalJs('location.pathname')
  if (href === '/writing') break
  await new Promise((r) => setTimeout(r, 150))
}
const afterNav = await evalJs(faviSnap)
check('client-side navigation did happen', afterNav !== null &&
  (await evalJs('location.pathname')) === '/writing',
  `pathname=${await evalJs('location.pathname')}`)
/* The assertion. Both halves matter: the palette must still be live (so we are
   not just observing a theme reset) AND the icon must still be the generated
   one rather than the static default. */
const navIcons = await waitForDataIcon(true)
check('the themed icon SURVIVES a client-side navigation',
  navIcons.theme === 'random' &&
    navIcons.icons.length > 0 &&
    navIcons.icons.every((h) => h.startsWith('data:image/svg+xml,')) &&
    !navIcons.icons.includes(DEFAULT_ICON),
  `theme=${navIcons.theme} icons=${JSON.stringify(navIcons.icons.map((h) => h.slice(0, 32)))}`)
check('and it still matches the palette actually applied after the nav',
  navIcons.accentHex === beforeNav.accentHex,
  `accent before=${beforeNav.accentHex} after=${navIcons.accentHex}`)

ws.close(); kill(); server.close()
console.log('PASS:'); pass.forEach((p) => console.log('  ✓ ' + p))
if (fail.length) { console.log('FAIL:'); fail.forEach((f) => console.log('  ✗ ' + f)) }
console.log(`\n${pass.length} passed, ${fail.length} failed`)
process.exit(fail.length ? 1 : 0)
