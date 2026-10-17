#!/usr/bin/env node
/**
 * Mobile layout checks for the theme control, at the two widths CLAUDE.md names.
 *
 *   npm run build && node scripts/e2e-palette-mobile.mjs
 *
 * Two things this exists to catch, both of which it did catch:
 *
 *  1. The overlay's theme control is a w-64 (256px) box, and its content has to
 *     fit inside it. The recorded failure: a flex item's default min-width is
 *     auto, so LABELLED buttons refuse to shrink below their own label and
 *     spill outside the pill and off-screen rather than compressing -- flex-1
 *     does not save them. That is why the control is a GRID. With two themes it
 *     is one row of two (grid-cols-2); the harness prints buttonBoxes each run,
 *     so the current measured widths are in the output below, not in this
 *     comment where they would go stale.
 *  2. --window-size is NOT a reliable way to set a CSS viewport in headless
 *     chromium: it reported 500px CSS width for both 375 and 390, silently
 *     testing neither. Emulation.setDeviceMetricsOverride is used instead, and
 *     the harness asserts the emulated width actually took effect before
 *     trusting any other number.
 *
 * It also checks the page never scrolls horizontally, that picking a theme does
 * NOT close the overlay (CLAUDE.md requires this), and that the dice works
 * there at all.
 */
import { spawn } from 'child_process'
import { createServer } from 'http'
import { readFile, stat } from 'fs/promises'
import { join, extname, dirname, resolve, sep } from 'path'
import { fileURLToPath } from 'url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'out')
const PORT = 8093
const ORIGIN = 'http://127.0.0.1:' + PORT
const T = {'.html':'text/html','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml','.png':'image/png','.json':'application/json','.woff2':'font/woff2','.ico':'image/x-icon','.txt':'text/plain'}
const server = createServer(async (req, res) => {
  try {
    let rel = decodeURIComponent(req.url.split('?')[0]).replace(/\/+$/, '') || '/'
    let p = join(ROOT, rel)
    // Clamp to ROOT. join() does NOT: join(ROOT, '/../../../etc/passwd') resolves
    // outside it, so this server would read any file the invoking user can.
    // Dev-only and bound to 127.0.0.1, but a page open in a browser on this
    // machine can still issue a GET while a run is live.
    const rootAbs = resolve(ROOT), pAbs = resolve(p)
    if (pAbs !== rootAbs && !pAbs.startsWith(rootAbs + sep)) {
      res.writeHead(403); res.end('forbidden'); console.error('  [403] ' + req.url); return
    }
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
    const b = await readFile(p); res.writeHead(200, {'content-type': T[extname(p)]||'application/octet-stream'}); res.end(b)
  } catch { res.writeHead(404); res.end('nf'); console.error('  [404] '+req.url) }
})
await new Promise(r => server.listen(PORT,'127.0.0.1',r))
const freePort = () => new Promise(res => { const s=createServer(); s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>res(p))}) })

const port = await freePort()
const proc = spawn('nix',['run','nixpkgs#chromium','--','--headless=new','--disable-gpu','--no-sandbox',
  '--remote-debugging-port='+port,'--user-data-dir=/tmp/claude-chrome-m2-'+process.pid,'--no-first-run','about:blank'],
  {stdio:'ignore',detached:true})
let t
for(let i=0;i<80;i++){ await new Promise(r=>setTimeout(r,500))
  try{ const l=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json(); t=l.find(x=>x.type==='page'); if(t?.webSocketDebuggerUrl) break }catch{} }
if(!t){ try{process.kill(-proc.pid,'SIGKILL')}catch{}; throw new Error('no target') }
const ws=new WebSocket(t.webSocketDebuggerUrl); await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j})
let id=0; const pend=new Map()
ws.onmessage=e=>{const m=JSON.parse(e.data); if(m.id&&pend.has(m.id)){pend.get(m.id)(m);pend.delete(m.id)}}
const send=(m,p={})=>new Promise(res=>{const i=++id;pend.set(i,res);ws.send(JSON.stringify({id:i,method:m,params:p}))})
const ev=async(x)=>{const r=await send('Runtime.evaluate',{expression:x,returnByValue:true}); return r.result?.result?.value}
await send('Page.enable'); await send('Runtime.enable')

const results = []
for (const W of [375, 390]) {
  // Emulation is the reliable way to set a CSS viewport: --window-size is
  // clamped (headless reported 500px CSS width for both 375 and 390).
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: 820, deviceScaleFactor: 1, mobile: true })
  await send('Page.navigate', { url: ORIGIN + '/' })
  for(let i=0;i<80;i++){ await new Promise(r=>setTimeout(r,250))
    if(await ev("document.readyState==='complete'&&!!document.querySelector('nav')")===true){ await new Promise(r=>setTimeout(r,700)); break } }

  const closed = JSON.parse(await ev(`JSON.stringify({
    cssWidth: document.documentElement.clientWidth,
    docScroll: document.documentElement.scrollWidth,
    desktopClusterVisible: (()=>{const c=[...document.querySelector('nav').children].find(k=>k.className.includes('lg:flex'));return !!c&&getComputedStyle(c).display!=='none'})(),
    hamburger: !!document.querySelector('[aria-label="Open menu"]')
  })`))

  await ev(`document.querySelector('[aria-label="Open menu"]').click()`)
  await new Promise(r=>setTimeout(r,600))

  const open = JSON.parse(await ev(`JSON.stringify((()=>{
    const ov=document.getElementById('mobile-nav');
    const g=ov?ov.querySelector('[aria-label="Colour theme"]'):null;
    const btns=g?[...g.querySelectorAll('button')]:[];
    return {
      overlayOpen: !!ov,
      cssWidth: document.documentElement.clientWidth,
      docScroll: document.documentElement.scrollWidth,
      switcherW: g?Math.round(g.getBoundingClientRect().width):null,
      switcherScrollW: g?g.scrollWidth:null,
      switcherLeft: g?Math.round(g.getBoundingClientRect().left):null,
      switcherRight: g?Math.round(g.getBoundingClientRect().right):null,
      buttonCount: btns.length,
      buttonBoxes: btns.map(b=>{const r=b.getBoundingClientRect();return {w:Math.round(r.width),h:Math.round(r.height)}}),
      labelsClipped: btns.filter(b=>b.scrollWidth>b.clientWidth+1).length,
      textWraps: btns.filter(b=>b.getBoundingClientRect().height>44).length
    }})())`))

  // The dice is the LAST button in the control (the dark-mono button is first), so this still
  // resolves correctly now that there are two rather than four.
  const dice = `(()=>{const ov=document.getElementById('mobile-nav');const g=ov.querySelector('[aria-label="Colour theme"]');
    const b=[...g.querySelectorAll('button')];b[b.length-1].click();return 1})()`
  await ev(dice); await new Promise(r=>setTimeout(r,500))
  const rolled = JSON.parse(await ev(`JSON.stringify({
    theme: document.documentElement.dataset.theme,
    bg: document.documentElement.style.getPropertyValue('--bg').trim(),
    overlayStillOpen: !!document.getElementById('mobile-nav'),
    docScroll: document.documentElement.scrollWidth,
    cssWidth: document.documentElement.clientWidth
  })`))
  results.push({ W, closed, open, rolled })
  await ev(`localStorage.clear()`)
}
ws.close(); try{process.kill(-proc.pid,'SIGKILL')}catch{}; server.close()
console.log(JSON.stringify(results,null,1))
const f=[]
for(const r of results){
  if(r.closed.cssWidth!==r.W) f.push(r.W+': emulation did not apply (css width '+r.closed.cssWidth+')')
  if(r.closed.desktopClusterVisible) f.push(r.W+': desktop cluster visible')
  if(!r.closed.hamburger) f.push(r.W+': no hamburger')
  if(r.closed.docScroll>r.closed.cssWidth) f.push(r.W+': overflow closed')
  if(!r.open.overlayOpen) f.push(r.W+': overlay did not open')
  if(r.open.buttonCount!==2) f.push(r.W+': overlay switcher has '+r.open.buttonCount+' buttons')
  if(r.open.docScroll>r.open.cssWidth) f.push(r.W+': overflow with overlay open')
  if(r.open.switcherRight>r.open.cssWidth||r.open.switcherLeft<0) f.push(r.W+': switcher outside viewport')
  if(r.open.switcherScrollW>r.open.switcherW+1) f.push(r.W+': switcher content overflows its box ('+r.open.switcherScrollW+' > '+r.open.switcherW+')')
  if(r.open.labelsClipped) f.push(r.W+': '+r.open.labelsClipped+' button label(s) clipped')
  if(r.open.textWraps) f.push(r.W+': '+r.open.textWraps+' button(s) taller than 44px (text wrapping)')
  if(r.open.buttonBoxes.some(b=>b.w<24||b.h<24)) f.push(r.W+': a button is under 24px')
  if(r.rolled.theme!=='random'||!r.rolled.bg) f.push(r.W+': dice did not apply a palette')
  if(!r.rolled.overlayStillOpen) f.push(r.W+': overlay closed on theme pick (CLAUDE.md forbids)')
  if(r.rolled.docScroll>r.rolled.cssWidth) f.push(r.W+': overflow after rolling')
}
console.log(f.length?'\nFAIL:\n  '+f.join('\n  '):'\nPASS mobile 375 and 390 clean')
