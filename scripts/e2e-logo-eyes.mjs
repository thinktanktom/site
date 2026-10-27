#!/usr/bin/env node
/**
 * The tracking lockup on the landing page: three mask layers, and eyes that
 * follow the pointer without ever leaving their sockets.
 *
 * It targeted /about until that page BECAME / on 2026-10-26. A dead route here
 * would not be quiet -- goto() throws rather than letting the browser render a
 * 404 body that looks like a broken component, which is the trap
 * scripts/audit-screenshots.sh documents.
 *
 *   npm run build && node scripts/e2e-logo-eyes.mjs
 *
 * WHAT NEEDS A REAL BROWSER AND CANNOT BE A VITEST. The asset split is already
 * covered by components/__tests__/lockup-mask-split.test.ts, which asserts the
 * four files still reassemble. Everything here is the other half -- what the
 * browser does with them:
 *
 *  1. ALL THREE MASKS ARE FETCHED WITH THE PAGE, read from the CDP request log.
 *     This is the 2026-10-17 switch-stutter lesson applied to a new feature: a
 *     `display: none` element never loads its mask, so anything revealed later
 *     paints nothing for the length of its first request. All three layers are
 *     mounted from the server, so there is no such moment -- but the only way
 *     to keep it that way is to assert it. Resource Timing cannot be used here:
 *     it does not report memory-cache hits, so it answers differently on a warm
 *     profile than a cold one.
 *  2. FIRST PAINT IS THE UNCHANGED MARK. Both eye layers must sit at
 *     translate(0px, 0px) before any pointer has moved, which is what makes the
 *     static export and a JS-off reader identical to the single-span lockup
 *     this replaced.
 *  3. THE EYES ACTUALLY MOVE, and in the right direction. A pointer dispatched
 *     to the far right must push both eyes right; to the far left, left.
 *  4. THE CLAMP HOLDS. Deflection must stay inside the elliptical envelope
 *     (28 x 13 canvas units) with a tolerance, from a pointer at the extreme
 *     corner of the viewport. An unclamped implementation sails past this.
 *  5. THE EYES RETURN TO CENTRE when the pointer leaves the document.
 *  6. THE INK STILL FOLLOWS THE PALETTE. Three layers now, so the dice has to
 *     repaint all three, not just the face -- an eye layer that misses
 *     `.logo-mask` would keep the old accent and the mark would render
 *     two-tone in a random palette.
 *  7. prefers-reduced-motion PINS THE EYES. The global reduce block in
 *     globals.css kills transitions, but it cannot stop a transform written
 *     frame by frame, so the component checks the query itself. Emulated here
 *     with Emulation.setEmulatedMedia, which is the only way to prove the JS
 *     branch rather than the CSS one.
 *
 * TRAPS ALREADY PAID FOR, inherited from the other harnesses in this directory:
 *   - absolute static root (a relative 'out' serves 404s from another cwd, and
 *     the 404 body renders as a plausible-looking broken page)
 *   - allocate a free debug port; other chromium instances squat fixed ones
 *   - `nix run` makes chromium a grandchild: launch detached, kill the GROUP
 *   - poll, never sleep
 *   - the rAF loop eases toward its target, so a measurement taken immediately
 *     after dispatching a pointer event reads a value mid-flight. Every reading
 *     here polls until the transform holds across three consecutive samples,
 *     the same discipline e2e-annotations.mjs uses for smooth scroll and
 *     e2e-work.mjs for the pill transition.
 */
import { spawn } from 'child_process'
import { createServer } from 'http'
import { readFile, stat } from 'fs/promises'
import { join, extname, dirname, resolve, sep } from 'path'
import { fileURLToPath } from 'url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'out')
const PORT = 8095
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
/* HEADLESS CHROMIUM REPORTS (hover: none) AND (pointer: coarse) BY DEFAULT.
   TrackingLogo refuses to attach its listener without (hover: hover) -- which
   is correct on a touch device and correct here too, except that this machine
   is not one. Without this flag the eyes never move and the harness reports a
   product bug that does not exist; that is exactly what it did on its first
   run. Blink enum values: HoverType none=1 hover=2, PointerType none=1
   coarse=2 fine=4. Emulation.setEmulatedMedia cannot set these, so it has to
   be a launch flag -- and section 0 below asserts it actually took, in the
   same spirit as e2e-palette-mobile.mjs asserting its emulated width. */
const HOVER_FLAG = '--blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4'
const proc = spawn('nix',['run','nixpkgs#chromium','--','--headless=new','--disable-gpu','--no-sandbox',
  HOVER_FLAG,'--remote-debugging-port='+port,'--user-data-dir=/tmp/claude-chrome-eyes-'+process.pid,'--no-first-run','about:blank'],
  {stdio:'ignore',detached:true})
let t
for(let i=0;i<80;i++){ await new Promise(r=>setTimeout(r,500))
  try{ const l=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json(); t=l.find(x=>x.type==='page'); if(t?.webSocketDebuggerUrl) break }catch{} }
if(!t){ try{process.kill(-proc.pid,'SIGKILL')}catch{}; server.close(); throw new Error('chromium never exposed a target') }
const ws=new WebSocket(t.webSocketDebuggerUrl); await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j})
let id=0; const pend=new Map(); const requested=[]
ws.onmessage=e=>{const m=JSON.parse(e.data)
  if(m.method==='Network.requestWillBeSent') requested.push(m.params.request.url)
  if(m.id&&pend.has(m.id)){pend.get(m.id)(m);pend.delete(m.id)}}
const send=(m,p={})=>new Promise(res=>{const i=++id;pend.set(i,res);ws.send(JSON.stringify({id:i,method:m,params:p}))})
const ev=async(x)=>{const r=await send('Runtime.evaluate',{expression:x,returnByValue:true}); return r.result?.result?.value}
await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable')
await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false})

const goto = async (url) => {
  await send('Page.navigate',{url})
  for(let i=0;i<80;i++){ await new Promise(r=>setTimeout(r,200))
    if(await ev(`location.href===${JSON.stringify(url)}&&document.readyState==='complete'&&!!document.querySelector('[data-eye]')`)===true){
      await new Promise(r=>setTimeout(r,400)); return } }
  throw new Error('never arrived at '+url)
}

/* Read both eye transforms. The component writes custom properties and the
   stylesheet composes them, so the computed `transform` matrix is what the
   browser actually paints -- which is the thing worth asserting. */
const READ = `JSON.stringify([...document.querySelectorAll('[data-eye]')].map((el)=>{
  const m=new DOMMatrixReadOnly(getComputedStyle(el).transform)
  return { x:+m.e.toFixed(2), y:+m.f.toFixed(2) }
}))`

/* Poll until the eased value holds across three consecutive samples. Taking a
   reading straight after a pointer event reads the animation mid-flight and
   passes or fails for the wrong reason. */
const settled = async () => {
  let last = null, stable = 0
  for (let i = 0; i < 100; i++) {
    const now = await ev(READ)
    if (now === last) { if (++stable >= 3) return JSON.parse(now) } else { stable = 0; last = now }
    await new Promise(r => setTimeout(r, 60))
  }
  return JSON.parse(last)
}

const movePointer = async (x, y) => {
  await send('Input.dispatchMouseEvent',{type:'mouseMoved',x,y,button:'none',pointerType:'mouse'})
  return settled()
}

const results = {}

/* ---------- 0. the environment is one the feature runs in ---------------- */
await goto(ORIGIN + '/')
results.media = JSON.parse(await ev(`JSON.stringify({
  hover: matchMedia('(hover: hover)').matches,
  reduce: matchMedia('(prefers-reduced-motion: reduce)').matches
})`))

/* ---------- 1. structure, and every mask fetched before anything moves ---- */
results.structure = JSON.parse(await ev(`JSON.stringify((()=>{
  const wrap=document.querySelector('[role=img][aria-label=thinktanktom].relative')
  const layers=wrap?[...wrap.querySelectorAll('span')]:[]
  const eyes=wrap?[...wrap.querySelectorAll('[data-eye]')]:[]
  const box=wrap?wrap.getBoundingClientRect():null
  return {
    wrapFound: !!wrap,
    layerCount: layers.length,
    eyeCount: eyes.length,
    allMasked: layers.every((l)=>l.className.includes('logo-mask')),
    hiddenFromA11y: layers.every((l)=>l.getAttribute('aria-hidden')==='true'),
    imgCount: wrap?wrap.querySelectorAll('img').length:null,
    svgCount: wrap?wrap.querySelectorAll('svg').length:null,
    boxW: box?Math.round(box.width):null,
    boxH: box?Math.round(box.height):null,
    eyeInk: eyes.map((e)=>getComputedStyle(e).backgroundColor),
    faceInk: layers[0]?getComputedStyle(layers[0]).backgroundColor:null,
    maskUrls: layers.map((l)=>{const m=/url\\("?([^")]+)"?\\)/.exec(getComputedStyle(l).maskImage||'');return m?m[1]:null})
  }})())`))
results.requestedMasks = requested.filter((u) => /stacked-tagline_(face|eyeleft|eyeright)_light-primary\.svg$/.test(u)).length

/* ---------- 2. identity at first paint ---------------------------------- */
results.atRest = JSON.parse(await ev(READ))

/* ---------- 3 & 4. direction, and the clamp ----------------------------- */
results.right = await movePointer(1270, 450)
results.left = await movePointer(10, 450)
results.corner = await movePointer(1279, 899)

/* ---------- 5. pointer leaves the document ------------------------------ */
await ev(`document.dispatchEvent(new PointerEvent('pointerleave',{bubbles:false}))`)
results.afterLeave = await settled()

/* ---------- 6. all three layers follow the palette ---------------------- */
await ev(`(()=>{const g=document.querySelector('[aria-label="Colour theme"]');
  const b=[...g.querySelectorAll('button')];b[b.length-1].click();return 1})()`)
await new Promise(r => setTimeout(r, 700))
results.random = JSON.parse(await ev(`JSON.stringify((()=>{
  const wrap=document.querySelector('[role=img][aria-label=thinktanktom].relative')
  const layers=[...wrap.querySelectorAll('span')]
  return { theme: document.documentElement.dataset.theme,
           accent: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(),
           inks: layers.map((l)=>getComputedStyle(l).backgroundColor) }})())`))
await ev(`localStorage.clear()`)

/* ---------- 7. reduced motion pins the eyes ----------------------------- */
await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]})
await goto(ORIGIN + '/')
await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:1270,y:450,button:'none',pointerType:'mouse'})
await new Promise(r => setTimeout(r, 800))
results.reduced = JSON.parse(await ev(READ))
await send('Emulation.setEmulatedMedia',{features:[]})

ws.close(); try{process.kill(-proc.pid,'SIGKILL')}catch{}; server.close()
console.log(JSON.stringify(results, null, 1))

/* ------------------------------ assertions ------------------------------ */
const checks = []
const check = (name, ok, detail = '') => checks.push({ name, ok: !!ok, detail })

check('the browser reports a hovering pointer, so the feature is live',
  results.media.hover && !results.media.reduce,
  `hover=${results.media.hover} reduce=${results.media.reduce} -- without the blink-settings flag headless says false and every motion check below passes vacuously`)

const s = results.structure
check('the wrapper renders three mask layers, two of them eyes',
  s.wrapFound && s.layerCount === 3 && s.eyeCount === 2 && s.allMasked,
  `layers=${s.layerCount} eyes=${s.eyeCount} allMasked=${s.allMasked}`)
check('no <img> and no inline <svg> in the mark',
  s.imgCount === 0 && s.svgCount === 0, `img=${s.imgCount} svg=${s.svgCount}`)
check('the layers are hidden from the accessibility tree',
  s.hiddenFromA11y, `aria-hidden on all three: ${s.hiddenFromA11y}`)
check('the box is the 225px lockup', s.boxH === 225 && s.boxW === 400,
  `${s.boxW}x${s.boxH}`)
check('all three masks are fetched with the page, before anything moves',
  results.requestedMasks === 3, `requested=${results.requestedMasks} of 3 layer assets`)
check('every layer takes its ink from --accent (dark-mono: white)',
  s.faceInk === 'rgb(255, 255, 255)' && s.eyeInk.every((i) => i === 'rgb(255, 255, 255)'),
  `face=${s.faceInk} eyes=${s.eyeInk.join(' ')}`)

const zero = (p) => Math.abs(p.x) < 0.01 && Math.abs(p.y) < 0.01
check('both eyes sit at translate(0,0) at first paint -- the unchanged mark',
  results.atRest.length === 2 && results.atRest.every(zero),
  JSON.stringify(results.atRest))

check('a pointer to the right pushes both eyes right',
  results.right.every((p) => p.x > 0.5), JSON.stringify(results.right))
check('a pointer to the left pushes both eyes left',
  results.left.every((p) => p.x < -0.5), JSON.stringify(results.left))

/* The clamp is in canvas units; the rendered lockup is 225px tall on a 1080
   canvas, so one unit is 225/1080 px. Tolerance covers the easing's last
   fraction and sub-pixel rounding. */
const U = 225 / 1080
const MAXX = 28 * U + 0.5, MAXY = 13 * U + 0.5
check('deflection stays inside the elliptical clamp from the far corner',
  results.corner.every((p) => Math.abs(p.x) <= MAXX && Math.abs(p.y) <= MAXY),
  `corner=${JSON.stringify(results.corner)} max=${MAXX.toFixed(2)}x${MAXY.toFixed(2)}px`)
check('the eyes converge -- each aims from its own centre',
  Math.abs(results.corner[0].x - results.corner[1].x) > 0.01 ||
  Math.abs(results.corner[0].y - results.corner[1].y) > 0.01,
  `left=${JSON.stringify(results.corner[0])} right=${JSON.stringify(results.corner[1])}`)

check('the eyes return to centre when the pointer leaves the document',
  results.afterLeave.every(zero), JSON.stringify(results.afterLeave))

check('a random palette repaints all three layers, not just the face',
  results.random.theme === 'random' &&
  new Set(results.random.inks).size === 1 &&
  results.random.inks[0] === `rgb(${results.random.accent.trim().split(/\s+/).join(', ')})`,
  `accent=${results.random.accent} inks=${results.random.inks.join(' | ')}`)

check('prefers-reduced-motion keeps the eyes still',
  results.reduced.every(zero), JSON.stringify(results.reduced))

for (const c of checks) console.log(`${c.ok ? 'ok  ' : 'FAIL'}  ${c.name}${c.detail ? '  --  ' + c.detail : ''}`)
const failed = checks.filter((c) => !c.ok)
console.log(failed.length
  ? `\nFAIL: ${failed.length} of ${checks.length}`
  : `\nPASS ${checks.length}/${checks.length} tracking-lockup checks`)
process.exit(failed.length ? 1 : 0)
