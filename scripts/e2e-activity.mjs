#!/usr/bin/env node
/**
 * /activity — the tracked-hours heatmap, added 2026-11-03.
 *
 *   npm run build && node scripts/e2e-activity.mjs
 *
 * WHAT NEEDS A REAL BROWSER AND CANNOT BE A VITEST. lib/__tests__/timelog.test.ts
 * already covers the grid's arithmetic — the windowing, the banding, the streak,
 * and the timezone the PR half is bucketed in. Everything here is the other
 * half: what the browser does with the painted grid and a five-step alpha ramp.
 *
 *  1. THE GRID IS STRUCTURALLY WHOLE. A full rectangle of 7-day columns, no
 *     wider than the MAX_WEEKS cap, and no <img> or inline <svg> anywhere in
 *     it — the cells are divs painted by CSS, which is what keeps a year of
 *     data at 188 B of page JS. NOTE the width is no longer a fixed 53: since
 *     2026-11-09 the window starts at the first tracked day and grows, so
 *     every assertion here is on the INVARIANT, never on a literal count.
 *  2. THE RAMP PAINTS FIVE DISTINGUISHABLE LEVELS. Composited against the page
 *     ground and compared by luminance, strictly increasing. This is the check
 *     that the measured alphas in globals.css actually reach the screen: a
 *     typo'd or overridden alpha leaves two levels identical, and a heatmap
 *     whose scale has a collapsed step looks completely normal.
 *  3. THE PR RING READS ON AN UNTRACKED DAY, when there is one to read. The
 *     ring must survive a level-0 fill -- a --bg corner notch was the first
 *     design and is invisible exactly there. CURRENTLY DORMANT: the window
 *     opens at the first tracked day and every upstream PR predates it, so no
 *     cell is ringed. Those four checks report SKIP rather than passing
 *     vacuously, and a fifth asserts the page drops the ring from its legend
 *     to match. They come back on their own with the first in-window PR.
 *  4. THE PAGE BODY NEVER SCROLLS HORIZONTALLY, at 375px and 390px. Checked
 *     unconditionally, because it is the guard that matters most. The
 *     scroll-POSITION checks beside it are conditional on the graph actually
 *     being wider than the viewport, which a two-column grid is not.
 *  5. THE DESKTOP GRID STAYS INSIDE THE ARTICLE MEASURE. At the cap, 53 columns
 *     at the pitch in globals.css measure 739px and must still fit 780px, or
 *     the page silently widens past the measure / moved to on 2026-10-29.
 *  6. THE NAV STILL FITS AT lg WITH FOUR LINKS. /activity is the fourth, and
 *     CLAUDE.md's last measurement found only ~185px of clearance at md with
 *     three. Measured here at lg WITH SCROLLBARS VISIBLE — a past nav
 *     measurement in this repo was wrong precisely because it was taken with
 *     --hide-scrollbars, so that flag must never be added to this harness.
 *  7. THE CELLS FOLLOW THE PALETTE. The ramp is alpha on --accent, so a random
 *     palette must repaint every level. A hardcoded colour would pass every
 *     check above and fail only this one.
 *  8. THE TOOLTIPS AND THE A11Y MODEL SURVIVE THE EXPORT. Every tracked cell
 *     carries its date and duration in `title` (no JavaScript involved), the
 *     grid is one role="img" with a summarising label, and the cells inside it
 *     are hidden from the accessibility tree rather than announced 371 times.
 *  9. IT ALL WORKS WITH JAVASCRIPT DISABLED. /activity is a server component
 *     and must stay one; a rewrite into client state would pass 1-8 and fail
 *     only this.
 *
 * TRAPS ALREADY PAID FOR, inherited from the other harnesses here:
 *   - absolute static root (a relative 'out' serves 404s from another cwd, and
 *     the 404 body renders as a plausible-looking broken page)
 *   - allocate a free debug port; other chromium instances squat fixed ones
 *   - `nix run` makes chromium a grandchild: launch detached, kill the GROUP
 *   - poll, never sleep
 *   - never fake a regression by mutating out/*.html; React rehydrates from the
 *     inlined flight payload and the mutation vanishes. Mutate source, rebuild.
 *
 * NEGATIVE CONTROLS RUN, both by editing globals.css and rebuilding:
 *
 *   - Collapsing one ramp step (.hm-2's alpha set to .hm-1's) fails exactly
 *     three checks — the two luminance orderings and the distinct-value count —
 *     and nothing else. Note that "5 ramp levels painted" still passes there,
 *     correctly: it counts painted elements, not distinct colours.
 *
 *   - THE SCROLLER CONTROL FAILED TO FAIL THE FIRST TIME, and the reason is
 *     worth keeping. Setting `overflow-x: visible` on .hm-scroll changed
 *     nothing: per CSS overflow, when one axis is not `visible` the other
 *     computes to `auto`, so `overflow-y: hidden` silently kept the scroller
 *     scrolling and all 46 checks still passed. Only removing BOTH
 *     declarations reproduces the regression, and then it is unmistakable —
 *     body.scrollWidth overruns by 437px at 375 and 422px at 390.
 *     Two consequences for anyone editing this:
 *       * document.documentElement reported ZERO overflow in that broken
 *         state while document.body reported 437px. A check on the
 *         documentElement alone would have passed vacuously; both are measured
 *         for that reason.
 *       * `scrollerScrolls` also still passes when broken — scrollWidth
 *         exceeds clientWidth whether or not the box can scroll. It is kept as
 *         the PRECONDITION (the graph really is wider than the viewport, so
 *         the other two checks are testing something) and is not itself a
 *         guard. The guards are the body-overflow and computed-overflow-x
 *         pair.
 */
import { spawn } from 'child_process'
import { createServer } from 'http'
import { readFile, stat } from 'fs/promises'
import { join, extname, dirname, resolve, sep } from 'path'
import { fileURLToPath } from 'url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'out')
const PORT = 8097
const ORIGIN = 'http://127.0.0.1:' + PORT
const T = {'.html':'text/html','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml','.png':'image/png','.json':'application/json','.woff2':'font/woff2','.ico':'image/x-icon','.txt':'text/plain'}
const server = createServer(async (req, res) => {
  try {
    let rel = decodeURIComponent(req.url.split('?')[0]).replace(/\/+$/, '') || '/'
    let p = join(ROOT, rel)
    const rootAbs = resolve(ROOT), pAbs = resolve(p)
    if (pAbs !== rootAbs && !pAbs.startsWith(rootAbs + sep)) {
      res.writeHead(403); res.end('forbidden'); console.error('  [403] ' + req.url); return
    }
    try {
      if ((await stat(p)).isDirectory()) {
        const index = join(p, 'index.html')
        try { await stat(index); p = index } catch { p += '.html' }
      }
    } catch { if (!extname(p)) p += '.html' }
    const b = await readFile(p); res.writeHead(200, {'content-type': T[extname(p)]||'application/octet-stream'}); res.end(b)
  } catch { res.writeHead(404); res.end('nf'); console.error('  [404] '+req.url) }
})
await new Promise(r => server.listen(PORT, '127.0.0.1', r))
const freePort = () => new Promise(res => { const s=createServer(); s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>res(p))}) })

const port = await freePort()
/* NO --hide-scrollbars. Section 6 measures the nav's fit, and a classic
   scrollbar takes real width out of the row; hiding it is how a previous nav
   measurement in this repo came to be wrong. */
const proc = spawn('nix',['run','nixpkgs#chromium','--','--headless=new','--disable-gpu','--no-sandbox',
  '--remote-debugging-port='+port,'--user-data-dir=/tmp/claude-chrome-activity-'+process.pid,'--no-first-run','about:blank'],
  {stdio:'ignore',detached:true})
let t
for(let i=0;i<80;i++){ await new Promise(r=>setTimeout(r,500))
  try{ const l=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json(); t=l.find(x=>x.type==='page'); if(t?.webSocketDebuggerUrl) break }catch{} }
if(!t){ try{process.kill(-proc.pid,'SIGKILL')}catch{}; server.close(); throw new Error('chromium never exposed a target') }
const ws=new WebSocket(t.webSocketDebuggerUrl); await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j})
let id=0; const pend=new Map()
ws.onmessage=e=>{const m=JSON.parse(e.data); if(m.id&&pend.has(m.id)){pend.get(m.id)(m);pend.delete(m.id)}}
const send=(m,p={})=>new Promise(res=>{const i=++id;pend.set(i,res);ws.send(JSON.stringify({id:i,method:m,params:p}))})
const ev=async(x)=>{const r=await send('Runtime.evaluate',{expression:x,returnByValue:true}); return r.result?.result?.value}
await send('Page.enable'); await send('Runtime.enable')

const metrics = (width, height = 900) =>
  send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false})

const goto = async (url, ready = '.hm-grid') => {
  await send('Page.navigate',{url})
  for(let i=0;i<80;i++){ await new Promise(r=>setTimeout(r,200))
    if(await ev(`location.href===${JSON.stringify(url)}&&document.readyState==='complete'&&!!document.querySelector(${JSON.stringify(ready)})`)===true){
      await new Promise(r=>setTimeout(r,300)); return } }
  throw new Error('never arrived at '+url)
}

/* Composite an rgb/rgba computed value over the page ground and return WCAG
   relative luminance. The browser reports a declared `rgba(255,255,255,0.35)`
   verbatim rather than the composite it paints, so the ramp cannot be compared
   without doing the blend here. */
const LUM_FN = `
  const parse=(s)=>{const m=s.match(/[\\d.]+/g).map(Number);return [m[0],m[1],m[2],m[3]===undefined?1:m[3]]};
  const lin=(c)=>{c/=255;return c<=0.04045?c/12.92:Math.pow((c+0.055)/1.055,2.4)};
  const lum=(r,g,b)=>0.2126*lin(r)+0.7152*lin(g)+0.0722*lin(b);
  const ground=parse(getComputedStyle(document.body).backgroundColor);
  const composite=(s)=>{const [r,g,b,a]=parse(s);
    return lum(r*a+ground[0]*(1-a), g*a+ground[1]*(1-a), b*a+ground[2]*(1-a))};
`

const results = {}
await metrics(1280)
await goto(ORIGIN + '/activity')

/* ---------- 1. structure ------------------------------------------------- */
results.structure = JSON.parse(await ev(`JSON.stringify((()=>{
  const grid=document.querySelector('.hm-grid')
  const cols=[...grid.querySelectorAll('.hm-col')]
  const cells=[...grid.querySelectorAll('.hm-cell')]
  /* SCOPED to .hm: the nav wordmark is also a role="img", and it comes first
     in document order -- an unscoped querySelector finds it and this check
     passes against the logo's label instead of the graph's. */
  const wrap=document.querySelector('.hm [role=img]')
  return {
    columns: cols.length,
    perColumn: [...new Set(cols.map(c=>c.querySelectorAll('.hm-cell').length))],
    cells: cells.length,
    imgs: grid.querySelectorAll('img').length,
    svgs: grid.querySelectorAll('svg').length,
    future: cells.filter(c=>c.classList.contains('hm-future')).length,
    ringed: cells.filter(c=>c.classList.contains('hm-pr')).length,
    monthLabels: document.querySelectorAll('.hm-month').length,
    /* the ring's own legend swatch, which the page drops when no grid cell
       carries a ring */
    ringLegend: document.querySelectorAll('.hm-legend .hm-pr').length,
    ariaLabel: wrap?wrap.getAttribute('aria-label'):null,
    cellsHidden: grid.getAttribute('aria-hidden')==='true'
  }})())`))

/* ---------- 2. the ramp paints five distinguishable levels --------------- */
results.ramp = JSON.parse(await ev(`JSON.stringify((()=>{${LUM_FN}
  return [0,1,2,3,4].map((n)=>{
    const el=document.querySelector('.hm-grid .hm-'+n)||document.querySelector('.hm-legend .hm-'+n)
    const cs=getComputedStyle(el)
    return { level:n, declared:cs.backgroundColor, lum:+composite(cs.backgroundColor).toFixed(4) }
  })})())`))

/* ---------- 3. the ring reads on an untracked day ------------------------ */
results.ring = JSON.parse(await ev(`JSON.stringify((()=>{
  const cells=[...document.querySelectorAll('.hm-grid .hm-cell')]
  const onEmpty=cells.find(c=>c.classList.contains('hm-pr')&&c.classList.contains('hm-0'))
  const anyRinged=cells.find(c=>c.classList.contains('hm-pr'))
  const cs=onEmpty?getComputedStyle(onEmpty):null
  return {
    ringedOnEmptyDay: !!onEmpty,
    ringedTotal: cells.filter(c=>c.classList.contains('hm-pr')).length,
    /* two rings: an inner --bg separator and an outer --accent ring. One ring
       alone is invisible against a level-4 fill. */
    shadowRings: cs?(cs.boxShadow.match(/rgb/g)||[]).length:0,
    title: anyRinged?anyRinged.getAttribute('title'):null
  }})())`))

/* ---------- 5. the desktop grid stays inside the article measure --------- */
results.desktop = JSON.parse(await ev(`JSON.stringify((()=>{
  const grid=document.querySelector('.hm-grid')
  const scroll=document.querySelector('.hm-scroll')
  const main=document.querySelector('main > div')
  return {
    gridWidth: Math.round(grid.getBoundingClientRect().width),
    containerWidth: Math.round(main.getBoundingClientRect().width),
    scrollerOverflows: scroll.scrollWidth > scroll.clientWidth,
    docOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
  }})())`))

/* ---------- 6. the nav fits at lg with four links ------------------------ */
/* Measuring nav.scrollWidth alone is NOT a fit test, and the first run of this
   harness proved it: the nav is width-constrained by max-w-chrome and an
   overflowing row is clipped further up, so scrollWidth reported the clamped
   1100 either way. It read "1100 <= 1100" and would have passed with the links
   spilling off the row. The real question is whether the wordmark, the link
   cluster and the theme control ADD UP to less than the nav's usable inner
   width, so that is what is summed here. Same mistake CLAUDE.md records for the
   earlier md measurement, wearing a different disguise. */
results.nav = JSON.parse(await ev(`JSON.stringify((()=>{
  const nav=document.querySelector('nav')
  const row=nav.querySelector('.hidden.lg\\\\:flex')
  const mark=nav.querySelector('a[href="/"]')
  const cs=getComputedStyle(nav)
  const inner=nav.clientWidth-parseFloat(cs.paddingLeft)-parseFloat(cs.paddingRight)
  const content=(mark?mark.getBoundingClientRect().width:0)+(row?row.getBoundingClientRect().width:0)
  const links=[...nav.querySelectorAll('a[href^="/"]')].map(a=>a.getAttribute('href'))
  return {
    links,
    innerWidth: Math.round(inner),
    contentWidth: Math.round(content),
    clearance: Math.round(inner-content),
    rowScrolls: row?row.scrollWidth>row.clientWidth:null,
    rowWidth: row?Math.round(row.getBoundingClientRect().width):null,
    activeIsAccent: (()=>{
      const a=[...nav.querySelectorAll('a')].find(x=>x.getAttribute('href')==='/activity')
      return a?getComputedStyle(a).color:null
    })(),
    accent: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()
  }})())`))

/* ---------- 8. tooltips carry the data ---------------------------------- */
results.titles = JSON.parse(await ev(`JSON.stringify((()=>{
  const cells=[...document.querySelectorAll('.hm-grid .hm-cell')]
  const tracked=cells.filter(c=>!c.classList.contains('hm-future')&&!c.classList.contains('hm-0'))
  const future=cells.filter(c=>c.classList.contains('hm-future'))
  return {
    trackedCount: tracked.length,
    allTrackedHaveTitle: tracked.every(c=>!!c.getAttribute('title')),
    /* a future cell must carry NO title: there is nothing to report about a day
       that has not happened, and an empty tooltip reads as a broken one */
    futureHaveNoTitle: future.every(c=>!c.hasAttribute('title')),
    sample: tracked.map(c=>c.getAttribute('title')),
    everyPastCellHasTitle: cells.filter(c=>!c.classList.contains('hm-future')).every(c=>!!c.getAttribute('title'))
  }})())`))

/* ---------- 7. the cells follow the palette ----------------------------- */
const rampSignature = `JSON.stringify([0,1,2,3,4].map((n)=>{
  const el=document.querySelector('.hm-grid .hm-'+n)||document.querySelector('.hm-legend .hm-'+n)
  return getComputedStyle(el).backgroundColor }))`
const monoRamp = await ev(rampSignature)
/* The dice is LAST in the switcher and both other harnesses reach it the same
   way; do not reorder the buttons. */
/* The SAME selector scripts/e2e-palette.mjs uses. 'nav button' is wrong: it
   also matches the hamburger and the overlay's own switcher instance, and
   b[b.length-1] then lands on a button inside a closed overlay, where the
   click is silently a no-op and the theme never changes. */
await ev(`(()=>{const g=document.querySelector('[role="group"][aria-label="Colour theme"]');
  const b=[...g.querySelectorAll('button')];b[b.length-1].click();return b.length})()`)
await new Promise(r => setTimeout(r, 600))
const randomRamp = await ev(rampSignature)
results.palette = {
  theme: await ev(`document.documentElement.dataset.theme`),
  monoRamp: JSON.parse(monoRamp),
  randomRamp: JSON.parse(randomRamp),
  repainted: monoRamp !== randomRamp,
  /* still five distinct levels after the roll, not merely different */
  randomDistinct: new Set(JSON.parse(randomRamp)).size,
}
results.randomRampLum = JSON.parse(await ev(`JSON.stringify((()=>{${LUM_FN}
  return [0,1,2,3,4].map((n)=>{
    const el=document.querySelector('.hm-grid .hm-'+n)||document.querySelector('.hm-legend .hm-'+n)
    return +composite(getComputedStyle(el).backgroundColor).toFixed(4)})})())`))

/* ---------- 4. no horizontal page overflow on mobile -------------------- */
results.mobile = {}
for (const width of [375, 390]) {
  await metrics(width, 800)
  await goto(ORIGIN + '/activity')
  results.mobile[width] = JSON.parse(await ev(`JSON.stringify((()=>{
    const scroll=document.querySelector('.hm-scroll')
    return {
      emulatedWidth: window.innerWidth,
      docOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      bodyOverflow: document.body.scrollWidth - document.body.clientWidth,
      /* the graph MUST overflow here -- 739px cannot fit 375px -- and the
         overflow must be inside the scroller rather than on the page */
      scrollerScrolls: scroll.scrollWidth > scroll.clientWidth,
      scrollerOverflowX: getComputedStyle(scroll).overflowX,
      /* Opens at the RECENT end. The data begins Nov 2026, so a left-aligned
         start shows twelve months of empty cells and the graph reads as
         broken until the reader discovers it scrolls. Done with direction:rtl
         because this page ships no JavaScript. In an rtl scroller the resting
         scrollLeft is 0 and scrolling left goes negative, so "at the recent
         end" is |scrollLeft| being near zero rather than near the maximum. */
      scrollLeft: Math.round(scroll.scrollLeft),
      maxScroll: scroll.scrollWidth - scroll.clientWidth,
      atRecentEnd: Math.abs(scroll.scrollLeft) <= 2,
      innerDirection: getComputedStyle(scroll.firstElementChild).direction,
      cellsStaySquare: (()=>{
        const c=document.querySelector('.hm-cell').getBoundingClientRect()
        return Math.abs(c.width-c.height)<0.5 && c.width>8
      })()
    }})())`))
}

/* ---------- 9. works with JavaScript disabled --------------------------- */
await metrics(1280)
await send('Emulation.setScriptExecutionDisabled', { value: true })
await send('Page.navigate', { url: ORIGIN + '/activity' })
await new Promise(r => setTimeout(r, 1200))
results.noJs = JSON.parse(await send('Runtime.evaluate', {
  /* Runtime.evaluate still works with script execution disabled -- it is the
     page's own scripts that are blocked, which is the point. */
  expression: `JSON.stringify((()=>{
    /* .hm-grid, not .hm: an unscoped .hm-cell also counts the 6 legend
       swatches, which are deliberately the same class at the same size. */
    const cells=document.querySelectorAll('.hm-grid .hm-cell')
    return {
      cells: cells.length,
      ringed: document.querySelectorAll('.hm-pr').length,
      titled: [...cells].filter(c=>c.getAttribute('title')).length,
      shippedSection: !!document.body.textContent.match(/Shipped upstream/),
      prLinks: document.querySelectorAll('a[href*="/pull/"]').length
    }})())`,
  returnByValue: true,
}).then((r) => r.result?.result?.value))
await send('Emulation.setScriptExecutionDisabled', { value: false })

/* ---------------------------------------------------------------- report */
try { process.kill(-proc.pid, 'SIGKILL') } catch {}
server.close()

const checks = []
const ok = (name, cond, detail) => checks.push({ name, pass: !!cond, detail })

/*
 * A check that has nothing to exercise is reported as SKIP, never as a pass.
 *
 * Two groups became conditional when the grid started at the first tracked day
 * (2026-11-09): the PR-ring checks, because every upstream PR predates the log
 * so no cell carries a ring; and the overflow checks, because a two-column grid
 * fits a phone. Letting those quietly pass is exactly the vacuous-green trap
 * this harness's header already records for the /projects probe and the
 * overflow control — a run that proves nothing while looking identical to one
 * that proves everything. Skips are printed, counted and shown in the summary,
 * so the day data makes them live again is visible rather than silent.
 */
const skip = (name, why) => checks.push({ name, skip: true, detail: why })

const s = results.structure
/* The grid is no longer a fixed 53 columns -- since 2026-11-09 it starts at the
   first tracked week and grows to a MAX_WEEKS cap. Asserting the INVARIANT
   (a full rectangle of 7-day columns, within the cap) instead of the literal
   53, so this does not have to be edited every week as the log lengthens. */
ok('between 1 and 53 columns', s.columns >= 1 && s.columns <= 53, s.columns)
ok('7 cells per column', s.perColumn.length === 1 && s.perColumn[0] === 7, JSON.stringify(s.perColumn))
ok('cells == columns x 7', s.cells === s.columns * 7, s.cells + ' for ' + s.columns + ' columns')
ok('no <img> in the grid', s.imgs === 0, s.imgs)
ok('no inline <svg> in the grid', s.svgs === 0, s.svgs)
ok('future cells present and few', s.future > 0 && s.future < 7, s.future)
/* At least one, never more than one per column. Was `>= 12`, which assumed
   the fixed 53-week window — a two-column grid spans a single month and the
   old assertion failed on a perfectly correct page. */
ok(
  'month labels rendered, at most one per column',
  s.monthLabels >= 1 && s.monthLabels <= s.columns,
  s.monthLabels + ' for ' + s.columns + ' columns'
)
ok('grid is one role=img', !!s.ariaLabel, s.ariaLabel)
ok('aria-label summarises the window', /^Tracked work since \w{3} \d{1,2} \w{3} \d{4}:/.test(s.ariaLabel || ''), s.ariaLabel)
ok('cells hidden from a11y tree', s.cellsHidden, s.cellsHidden)

const lums = results.ramp.map((r) => r.lum)
ok('5 ramp levels painted', results.ramp.length === 5, results.ramp.map(r=>r.declared).join(' | '))
ok(
  'ramp luminance strictly increasing',
  lums.every((l, i) => i === 0 || l > lums[i - 1]),
  lums.join(' < ')
)
ok('level 4 is the solid accent', /^rgb\(/.test(results.ramp[4].declared), results.ramp[4].declared)

const r = results.ring
if (r.ringedTotal > 0) {
  ok('PR ring present', r.ringedTotal > 0, r.ringedTotal)
  ok('PR ring lands on an untracked day', r.ringedOnEmptyDay, r.ringedOnEmptyDay)
  ok('ring is two box-shadow rings', r.shadowRings === 2, r.shadowRings)
  ok('ringed cell titles its PR', /pull request/.test(r.title || ''), r.title)
} else {
  /* Dormant, not broken. The window opens at the first tracked day and every
     upstream PR predates it, so there is no ringed cell to measure. The page
     correspondingly drops the ring from the legend and from the intro
     sentence — asserted below so the three stay in step. */
  skip('PR ring checks (4)', 'no PR falls inside the window — nothing ringed')
  ok(
    'ring legend hidden when nothing is ringed',
    results.structure.ringLegend === 0,
    results.structure.ringLegend
  )
}

const d = results.desktop
ok('grid fits the 780px article measure', d.gridWidth <= 780, d.gridWidth + 'px')
ok('grid does not overflow at 1280', !d.scrollerOverflows, d.gridWidth + ' in ' + d.containerWidth)
ok('no page overflow at 1280', d.docOverflow <= 0, d.docOverflow)

const n = results.nav
ok('nav has 4 links incl. /activity', n.links.includes('/activity'), n.links.join(' '))
ok('nav row does not itself overflow', n.rowScrolls === false, 'rowScrolls=' + n.rowScrolls)
ok(
  'nav content fits the chrome width at lg',
  n.clearance > 0,
  n.contentWidth + 'px of content in ' + n.innerWidth + 'px — ' + n.clearance + 'px clear'
)
ok(
  'active nav item is the accent',
  n.activeIsAccent === 'rgb(' + n.accent.split(/\s+/).join(', ') + ')',
  n.activeIsAccent + ' vs --accent ' + n.accent
)

const ti = results.titles
ok('every past cell carries a title', ti.everyPastCellHasTitle, ti.trackedCount + ' tracked')
ok('future cells carry no title', ti.futureHaveNoTitle, ti.futureHaveNoTitle)
ok('a title carries date and duration', /\d{4} — \d/.test(ti.sample[0] || ''), ti.sample[0])

const p = results.palette
ok('dice entered random', p.theme === 'random', p.theme)
ok('ramp repainted for the palette', p.repainted, p.monoRamp[4] + ' -> ' + p.randomRamp[4])
ok('ramp still 5 distinct values in random', p.randomDistinct === 5, p.randomDistinct)
/*
 * MONOTONIC, not increasing — and this check failed on a light-polarity seed
 * before it was written this way, which is exactly the bug it now guards.
 *
 * The generator produces palettes at BOTH ends of the lightness range
 * (`data-polarity="dark" | "light"`). On a dark palette the ramp runs from a
 * near-black surface up to a bright accent; on a light one, from a near-white
 * surface DOWN to a dark accent — measured 0.849 > 0.516 > 0.323 > 0.190 >
 * 0.097 on an accent of rgb(18, 90, 153). Both are correct: more hours means
 * more ink either way. Asserting "increasing" hardcoded the dark case and
 * would have failed at random on roughly the seeds that roll light.
 *
 * What the ramp actually has to guarantee is that its five levels stay
 * ordered and distinct, in whichever direction the palette runs.
 */
const rl = results.randomRampLum
const ascending = rl.every((l, i) => i === 0 || l > rl[i - 1])
const descending = rl.every((l, i) => i === 0 || l < rl[i - 1])
ok(
  'random ramp luminance strictly monotonic (either polarity)',
  ascending || descending,
  rl.join(ascending ? ' < ' : descending ? ' > ' : ' ? ') +
    `  (${ascending ? 'dark' : descending ? 'light' : 'NOT ORDERED'} polarity)`
)

for (const [width, m] of Object.entries(results.mobile)) {
  ok(`${width}: emulation applied`, m.emulatedWidth === Number(width), m.emulatedWidth)
  /* Unconditional. This is the guard that matters most and it holds whether or
     not the graph is wide enough to scroll. */
  ok(`${width}: no page overflow`, m.docOverflow <= 0 && m.bodyOverflow <= 0, `doc ${m.docOverflow} body ${m.bodyOverflow}`)
  ok(`${width}: scroller is overflow-x auto`, m.scrollerOverflowX === 'auto', m.scrollerOverflowX)
  ok(`${width}: inner content is not mirrored`, m.innerDirection === 'ltr', m.innerDirection)
  ok(`${width}: cells stay square`, m.cellsStaySquare, m.cellsStaySquare)

  /* The scroll behaviour can only be tested while the graph is actually wider
     than the viewport. With the window starting at the first tracked day the
     grid is a couple of columns and fits a phone outright, so `scrollerScrolls`
     is the PRECONDITION for the resting-position check rather than a result:
     asserting "opens at the recent end" against a scroller with maxScroll 0
     would pass for the wrong reason, which is this harness's recorded trap. */
  if (m.scrollerScrolls) {
    ok(`${width}: graph scrolls inside itself`, m.scrollerScrolls, m.maxScroll + 'px of scroll')
    ok(`${width}: opens at the recent end`, m.atRecentEnd, `scrollLeft ${m.scrollLeft} of ${m.maxScroll}`)
  } else {
    skip(`${width}: scroll-position checks (2)`, `grid fits the viewport (maxScroll ${m.maxScroll})`)
  }
}

const j = results.noJs
ok('JS off: the whole grid renders', j.cells > 0 && j.cells % 7 === 0, j.cells)
if (results.ring.ringedTotal > 0) {
  ok('JS off: rings render', j.ringed > 0, j.ringed)
} else {
  skip('JS off: rings render', 'no PR falls inside the window')
}
ok('JS off: tooltips present', j.titled > 0, j.titled)
ok('JS off: shipped section renders', j.shippedSection, j.shippedSection)
ok('JS off: PR links are real anchors', j.prLinks > 0, j.prLinks)

let failed = 0
let skipped = 0
for (const c of checks) {
  if (c.skip) skipped += 1
  else if (!c.pass) failed += 1
  const tag = c.skip ? 'SKIP' : c.pass ? 'ok  ' : 'FAIL'
  console.log(`${tag}  ${c.name}${c.detail !== undefined ? '  —  ' + c.detail : ''}`)
}
/* Skips are reported out of the denominator AND called out, so "50/50" can
   never quietly mean "44 ran and 6 were unreachable". */
const ran = checks.length - skipped
console.log(
  `\n${ran - failed}/${ran} checks passed` +
    (skipped ? `, ${skipped} skipped — see the SKIP lines above` : '')
)
process.exit(failed ? 1 : 0)
