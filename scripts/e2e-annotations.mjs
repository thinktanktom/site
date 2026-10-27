#!/usr/bin/env node
/**
 * Annotation jump checks: the #ref-N <-> #note-N round trip, in a real browser.
 *
 *   npm run build && node scripts/e2e-annotations.mjs
 *
 * The HTML pairing can be grepped out of out/*.html, so that is not what this
 * exists for. Two things need a live layout engine and are the actual point:
 *
 *  1. The nav is `fixed` at h-16 (64px). An anchor jump with no scroll margin
 *     lands UNDER it, so the thing you jumped to is invisible while the URL
 *     says you arrived. Only a real browser can tell you where the target
 *     settled relative to the nav's own bottom edge. scroll-mt-24 (96px) is
 *     what buys the clearance; this asserts it actually does.
 *  2. `html { scroll-behavior: smooth }` means the scroll is still in flight
 *     when the click returns. Measuring immediately reads the OLD position and
 *     passes for the wrong reason. Every measurement here waits for scrollY to
 *     stop moving first -- poll, never sleep (CLAUDE.md).
 *
 * It also pins the styling invariants CLAUDE.md calls settled: the phrase is
 * underlined, the superscript marker is NOT, both are accent, and the hit
 * target is the whole phrase rather than the ~6px superscript.
 *
 * It also pins the accessibility shape, which is where this feature's one real
 * bug was: an aria-label on the forward link REPLACES the link's text as its
 * accessible name, and that text is a phrase mid-sentence -- so labelling it
 * deletes the phrase from the paragraph for screen-reader users. The cue must
 * be an additive sr-only span. Both halves of that are asserted.
 *
 * Covers /writing/god-in-a-bottle (8 annotations, the MDX component path) and
 * / (3, the hand-rolled copy CLAUDE.md requires to stay in sync -- it lived
 * on /about until that page became the landing page on 2026-10-26).
 *
 * One trap when negative-controlling this harness: do NOT mutate out/*.html to
 * fake a regression. React hydrates from the RSC flight payload inlined beside
 * the markup and restores the correct DOM, so the mutation vanishes before any
 * assertion runs and the check appears to pass. Mutate the SOURCE and rebuild.
 */
import { spawn } from 'child_process'
import { createServer } from 'http'
import { readFile, stat } from 'fs/promises'
import { join, extname, dirname, resolve, sep } from 'path'
import { fileURLToPath } from 'url'

// Absolute, deliberately: a relative 'out' resolves against process.cwd(), and
// running from elsewhere then serves 404 bodies that render as a broken page.
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'out')
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
const freePort = () => new Promise(res => { const s=createServer(); s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>res(p))}) })

// Allocate both ports: other chromium instances on this machine squat fixed
// ones, and attaching to a stranger's makes every selector return null.
const httpPort = await freePort()
await new Promise(r => server.listen(httpPort,'127.0.0.1',r))
const ORIGIN = 'http://127.0.0.1:' + httpPort
const port = await freePort()

// nix run makes chromium a GRANDCHILD -- detached + kill the process group, or
// it leaks and holds its debug port.
const proc = spawn('nix',['run','nixpkgs#chromium','--','--headless=new','--disable-gpu','--no-sandbox',
  '--remote-debugging-port='+port,'--user-data-dir=/tmp/claude-chrome-anno-'+process.pid,'--no-first-run','about:blank'],
  {stdio:'ignore',detached:true})
const die = () => { try{process.kill(-proc.pid,'SIGKILL')}catch{}; try{server.close()}catch{} }
let t
for(let i=0;i<80;i++){ await new Promise(r=>setTimeout(r,500))
  try{ const l=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json(); t=l.find(x=>x.type==='page'); if(t?.webSocketDebuggerUrl) break }catch{} }
if(!t){ die(); throw new Error('no chromium target') }
const ws=new WebSocket(t.webSocketDebuggerUrl); await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j})
let id=0; const pend=new Map()
ws.onmessage=e=>{const m=JSON.parse(e.data); if(m.id&&pend.has(m.id)){pend.get(m.id)(m);pend.delete(m.id)}}
const send=(m,p={})=>new Promise(res=>{const i=++id;pend.set(i,res);ws.send(JSON.stringify({id:i,method:m,params:p}))})
const ev=async(x)=>{const r=await send('Runtime.evaluate',{expression:x,returnByValue:true}); return r.result?.result?.value}
const json=async(x)=>JSON.parse(await ev('JSON.stringify('+x+')'))
await send('Page.enable'); await send('Runtime.enable')

// Smooth scrolling is in flight when click() returns. Wait for scrollY to hold
// the same value across consecutive frames rather than guessing a duration.
const settle = async () => {
  let last = null, same = 0
  for (let i = 0; i < 120; i++) {
    await new Promise(r=>setTimeout(r,50))
    const y = await ev('Math.round(window.scrollY)')
    if (y === last) { if (++same >= 3) return y } else { same = 0; last = y }
  }
  return last
}

const PAGES = [
  { url: '/writing/god-in-a-bottle', count: 8, label: 'post (MDX components)' },
  { url: '/',                        count: 3, label: 'landing page (hand-rolled)' },
]

const out = []
for (const page of PAGES) {
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false })
  await send('Page.navigate', { url: ORIGIN + page.url })
  let ok = false
  for(let i=0;i<80;i++){ await new Promise(r=>setTimeout(r,250))
    if(await ev("document.readyState==='complete'&&!!document.querySelector('nav')")===true){ ok = true; await new Promise(r=>setTimeout(r,500)); break } }
  // Assert we are on OUR url before trusting a single selector.
  const href = await ev('location.href')
  if (!ok || !href.startsWith(ORIGIN + page.url)) { out.push({ page: page.url, fatal: 'did not load ('+href+')' }); continue }

  const shape = await json(`(()=>{
    const refs=[...document.querySelectorAll('a[id^="ref-"]')];
    const notes=[...document.querySelectorAll('[id^="note-"]')];
    const accent=getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
    const ids=[...document.querySelectorAll('[id]')].map(e=>e.id).filter(i=>/^(ref|note)-/.test(i));
    return {
      refCount: refs.length,
      noteCount: notes.length,
      navH: Math.round(document.querySelector('header').getBoundingClientRect().height),
      accentToken: accent,
      dupIds: ids.filter((v,i)=>ids.indexOf(v)!==i),
      // every forward link must point at a note that exists, and back again
      broken: refs.filter(a=>{
        const n=a.id.slice(4);
        return a.getAttribute('href')!=='#note-'+n
          || !document.getElementById('note-'+n)
          || !document.querySelector('#note-'+n+' a[href="#ref-'+n+'"]');
      }).map(a=>a.id),
      // a link inside the phrase would nest <a> in <a>; the parser drops the
      // inner one, so this catches it as a missing descendant anchor instead
      nested: refs.filter(a=>a.querySelector('a')).map(a=>a.id),
      // CLAUDE.md: phrase underlined, marker not, both accent
      style: refs.map(a=>{
        const span=a.querySelector('.annot-phrase'), cs=getComputedStyle(a), ss=getComputedStyle(span);
        const sr=a.querySelector('.sr-only');
        const r=a.getBoundingClientRect();
        return {
          id:a.id,
          linkColor:cs.color,
          phraseUnderlined:ss.textDecorationLine.includes('underline'),
          linkUnderlined:cs.textDecorationLine.includes('underline'),
          hitW:Math.round(r.width), hitH:Math.round(r.height),
          markerW:Math.round(r.width-span.getBoundingClientRect().width),
          // An aria-label here would be a REGRESSION: it replaces the link's
          // text as its accessible name, and that text is a phrase in the
          // middle of a sentence. Labelling it deletes the phrase from the
          // prose for screen-reader users. The cue has to be additive.
          ariaLabel:a.getAttribute('aria-label'),
          srCue:sr?sr.textContent.trim():null,
          // the phrase must survive into the accessible name
          nameHasPhrase:a.textContent.includes(span.textContent),
          // sr-only must be visually hidden but not display:none (which would
          // drop it from the accessibility tree too)
          srHidden:sr?(getComputedStyle(sr).display!=='none'&&Math.round(sr.getBoundingClientRect().width)<=1):null,
        };
      }),
      // the back-link, by contrast, SHOULD be labelled: "1." alone is meaningless
      backLabels: refs.map(a=>{
        const n=a.id.slice(4);
        const b=document.querySelector('#note-'+n+' a[href="#ref-'+n+'"]');
        return { n, label:b?b.getAttribute('aria-label'):null };
      }),
    }})()`)

  // The resting geometry and paint of every note BEFORE anything is targeted.
  // The :target highlight must not move a note (padding is reserved on the base
  // class precisely so it cannot), so these are the baseline to compare against.
  const resting = await json(`(()=>{
    const out={};
    document.querySelectorAll('.annot-note').forEach(p=>{
      const r=p.getBoundingClientRect(), cs=getComputedStyle(p);
      out[p.id]={ x:Math.round(r.x), w:Math.round(r.width),
                  textX:Math.round(p.querySelector('a').getBoundingClientRect().x),
                  bg:cs.backgroundColor, shadow:cs.boxShadow };
    });
    return { notes:out, bodyBg:getComputedStyle(document.body).backgroundColor,
             surface:getComputedStyle(document.documentElement).getPropertyValue('--surface').trim() };
  })()`)

  // Round trip each annotation: marker down to the note, note number back up.
  const trips = []
  for (let n = 1; n <= shape.refCount; n++) {
    await ev('window.scrollTo(0,0)'); await settle()
    await ev(`document.getElementById('ref-${n}').click()`)
    const yDown = await settle()
    const down = await json(`(()=>{
      const el=document.getElementById('note-${n}'), r=el.getBoundingClientRect();
      const nav=document.querySelector('header').getBoundingClientRect();
      const de=document.documentElement;
      return { top:Math.round(r.top), bottom:Math.round(r.bottom), navBottom:Math.round(nav.bottom),
               vh:de.clientHeight, hash:location.hash,
               atPageBottom: Math.ceil(window.scrollY+de.clientHeight)>=de.scrollHeight-2 };
    })()`)

    // The :target highlight. Transition is 200ms; poll for it rather than
    // assuming it has finished, same discipline as the scroll.
    const hl = await (async () => {
      let last = null
      for (let i = 0; i < 40; i++) {
        await new Promise(r=>setTimeout(r,50))
        const cur = await json(`(()=>{
          const el=document.getElementById('note-${n}'), cs=getComputedStyle(el);
          const r=el.getBoundingClientRect();
          const others=[...document.querySelectorAll('.annot-note')].filter(p=>p.id!=='note-${n}');
          return {
            bg:cs.backgroundColor, shadow:cs.boxShadow,
            x:Math.round(r.x), w:Math.round(r.width),
            textX:Math.round(el.querySelector('a').getBoundingClientRect().x),
            // exactly one note may be highlighted at a time
            othersHighlighted:others.filter(p=>{
              const c=getComputedStyle(p);
              return c.backgroundColor!==getComputedStyle(document.body).backgroundColor && c.backgroundColor!=='rgba(0, 0, 0, 0)';
            }).map(p=>p.id),
            // the note text must stay AA-legible on whatever the tint is
            textColor:getComputedStyle(el.querySelector('span')).color,
          };
        })()`)
        if (last && cur.bg === last.bg && cur.shadow === last.shadow) return cur
        last = cur
      }
      return last
    })()

    // Where the reference already sits BEFORE clicking back. If it is already
    // parked clear of the nav and on screen, the browser correctly scrolls
    // nowhere -- so "did not move" is only a dead link when it wasn't.
    const preBack = await json(`(()=>{
      const r=document.getElementById('ref-${n}').getBoundingClientRect();
      const nav=document.querySelector('header').getBoundingClientRect();
      return { alreadyParked: r.top>=nav.bottom && r.bottom>0 && r.top<document.documentElement.clientHeight };
    })()`)
    await ev(`document.querySelector('#note-${n} a[href="#ref-${n}"]').click()`)
    const yBack = await settle()
    const back = await json(`(()=>{
      const el=document.getElementById('ref-${n}'), r=el.getBoundingClientRect();
      const nav=document.querySelector('header').getBoundingClientRect();
      return { top:Math.round(r.top), bottom:Math.round(r.bottom), navBottom:Math.round(nav.bottom),
               vh:document.documentElement.clientHeight, hash:location.hash };
    })()`)
    // Taking the back-link moves :target to #ref-N, so the note must stop
    // being highlighted on its own -- that self-clearing is the whole reason
    // the highlight persists rather than flashing.
    const cleared = await (async () => {
      let last = null
      for (let i = 0; i < 40; i++) {
        await new Promise(r=>setTimeout(r,50))
        const cur = await json(`(()=>{
          const cs=getComputedStyle(document.getElementById('note-${n}'));
          return { bg:cs.backgroundColor, shadow:cs.boxShadow };
        })()`)
        if (last && cur.bg === last.bg && cur.shadow === last.shadow) return cur
        last = cur
      }
      return last
    })()
    trips.push({ n, yDown, yBack, down, back, preBack, hl, cleared })
  }
  out.push({ page: page.url, label: page.label, expected: page.count, shape, trips, resting })
}

ws.close(); die()

// ---- report ----
// WCAG 2.x relative luminance / contrast ratio, on the computed rgb() strings
// Chromium hands back. Returns null rather than guessing on a transparent or
// otherwise unparseable colour, so a bad read cannot masquerade as a pass.
const rgb = (s) => { const m = /^rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)$/.exec(s); if (!m) return null; if (m[4] !== undefined && Number(m[4]) < 1) return null; return [Number(m[1]), Number(m[2]), Number(m[3])] }
const lum = (c) => { const f = c.map(v => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4) }); return 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2] }
const contrast = (fg, bg) => { const a = rgb(fg), b = rgb(bg); if (!a || !b) return null; const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05) }

const f = []
const crs = []
for (const r of out) {
  const P = r.page + ': '
  if (r.fatal) { f.push(P + r.fatal); continue }
  const s = r.shape
  if (s.refCount !== r.expected) f.push(P + 'found ' + s.refCount + ' annotations, expected ' + r.expected)
  if (s.noteCount !== s.refCount) f.push(P + s.refCount + ' refs but ' + s.noteCount + ' notes')
  if (s.dupIds.length) f.push(P + 'duplicate ids: ' + s.dupIds.join(','))
  if (s.broken.length) f.push(P + 'unpaired: ' + s.broken.join(','))
  if (s.nested.length) f.push(P + 'nested <a> inside annotation: ' + s.nested.join(','))
  for (const st of s.style) {
    if (!st.phraseUnderlined) f.push(P + st.id + ': phrase not underlined (CLAUDE.md requires a solid underline)')
    if (st.linkUnderlined) f.push(P + st.id + ': marker is underlined (it must not be)')
    if (st.ariaLabel) f.push(P + st.id + ': has aria-label "' + st.ariaLabel + '" — that REPLACES the phrase as the accessible name and deletes it from the sentence; use an additive sr-only cue')
    if (!st.srCue) f.push(P + st.id + ': no sr-only cue naming the note')
    else if (!/see note \d+/.test(st.srCue)) f.push(P + st.id + ': sr-only cue is "' + st.srCue + '"')
    if (!st.nameHasPhrase) f.push(P + st.id + ': phrase missing from the accessible name')
    if (st.srHidden === false) f.push(P + st.id + ': sr-only cue is visible or display:none')
    // the whole phrase must be the hit target, not just the superscript
    if (st.hitW <= st.markerW + 8) f.push(P + st.id + ': hit target is only ' + st.hitW + 'px (marker alone)')
    if (st.hitH < 16) f.push(P + st.id + ': hit target only ' + st.hitH + 'px tall')
  }
  for (const bl of s.backLabels) {
    if (!bl.label) f.push(P + 'note ' + bl.n + ': back-link has no aria-label (its text is a bare "' + bl.n + '.")')
  }
  const accentRgb = 'rgb(' + s.accentToken.split(/\s+/).join(', ') + ')'
  const offAccent = s.style.filter(st => st.linkColor !== accentRgb)
  if (offAccent.length) f.push(P + offAccent.length + ' annotation(s) not --accent (' + offAccent[0].linkColor + ' vs ' + accentRgb + ')')

  for (const t of r.trips) {
    const d = t.down, b = t.back
    if (d.hash !== '#note-' + t.n) f.push(P + 'note ' + t.n + ': hash is ' + d.hash)
    if (t.yDown === 0) f.push(P + 'note ' + t.n + ': page did not scroll')
    // The whole point: the target must clear the fixed nav, not hide under it.
    // Unless the page is scrolled as far as it goes, in which case visible is
    // the most that can be asked.
    if (d.top < d.navBottom && !d.atPageBottom) f.push(P + 'note ' + t.n + ': lands under the nav (top ' + d.top + ' < nav bottom ' + d.navBottom + ')')
    if (d.bottom <= 0 || d.top >= d.vh) f.push(P + 'note ' + t.n + ': offscreen after jump')

    // ---- the :target highlight ----
    const rest = r.resting.notes['note-' + t.n]
    const surfaceRgb = 'rgb(' + r.resting.surface.split(/\s+/).join(', ') + ')'
    if (!t.hl) f.push(P + 'note ' + t.n + ': could not read highlight state')
    else {
      if (t.hl.bg === rest.bg) f.push(P + 'note ' + t.n + ': :target did not change the background (still ' + t.hl.bg + ')')
      if (t.hl.bg !== surfaceRgb) f.push(P + 'note ' + t.n + ': highlight tint is ' + t.hl.bg + ', expected --surface ' + surfaceRgb)
      if (!/inset/.test(t.hl.shadow)) f.push(P + 'note ' + t.n + ': no inset accent rule on the highlight (' + t.hl.shadow + ')')
      // An outset shadow or a real border would reflow the note. The padding is
      // reserved on the base class so that highlighting cannot move anything.
      if (t.hl.textX !== rest.textX) f.push(P + 'note ' + t.n + ': highlight SHIFTED the text ' + (t.hl.textX - rest.textX) + 'px (' + rest.textX + ' -> ' + t.hl.textX + ')')
      if (t.hl.x !== rest.x || t.hl.w !== rest.w) f.push(P + 'note ' + t.n + ': highlight changed the note box (' + rest.x + 'x' + rest.w + ' -> ' + t.hl.x + 'x' + t.hl.w + ')')
      if (t.hl.othersHighlighted.length) f.push(P + 'note ' + t.n + ': ' + t.hl.othersHighlighted.length + ' other note(s) highlighted too: ' + t.hl.othersHighlighted.join(','))
      // Note text is --muted and the tint is --surface; muted-on-surface is a
      // gated pair (4.5 min, lib/palette/validate.ts) so this must clear AA.
      const cr = contrast(t.hl.textColor, t.hl.bg)
      if (cr !== null && cr < 4.5) f.push(P + 'note ' + t.n + ': text on the highlight is ' + cr.toFixed(2) + ':1, under WCAG AA')
      if (cr !== null) crs.push(cr)
    }
    if (t.cleared && t.cleared.bg !== rest.bg) f.push(P + 'note ' + t.n + ': highlight did not clear after taking the back-link (' + t.cleared.bg + ' vs resting ' + rest.bg + ')')
    if (t.cleared && /inset/.test(t.cleared.shadow)) f.push(P + 'note ' + t.n + ': accent rule survived the back-link')

    if (b.hash !== '#ref-' + t.n) f.push(P + 'back ' + t.n + ': hash is ' + b.hash)
    if (b.top < b.navBottom) f.push(P + 'back ' + t.n + ': lands under the nav (top ' + b.top + ' < nav bottom ' + b.navBottom + ')')
    if (b.bottom <= 0 || b.top >= b.vh) f.push(P + 'back ' + t.n + ': offscreen after jump')
    if (t.yBack === t.yDown && !t.preBack.alreadyParked) f.push(P + 'back ' + t.n + ': did not move from the note')
  }
}

console.log(JSON.stringify(out.map(r => r.fatal ? r : ({
  page: r.page, label: r.label, annotations: r.shape.refCount, navH: r.shape.navH,
  accent: r.shape.accentToken,
  hitTargets: r.shape.style.map(s => s.hitW + 'x' + s.hitH),
  jumps: r.trips.map(t => ({ n: t.n, down: { y: t.yDown, topRelNav: t.down.top - t.down.navBottom }, back: { y: t.yBack, topRelNav: t.back.top - t.back.navBottom } })),
})), null, 1))
// per annotation: 5 style + 4 a11y + 1 back-label + 8 round-trip + 9 highlight;
// plus 4 whole-page checks (count, ref/note parity, duplicate ids, accent)
const checks = out.reduce((a, r) => a + (r.fatal ? 0 : r.shape.refCount * 27 + 4), 0)
if (crs.length) console.log('worst note-on-highlight contrast: ' + Math.min(...crs).toFixed(2) + ':1 (WCAG AA floor 4.5)')
console.log(f.length ? '\nFAIL:\n  ' + f.join('\n  ') : '\nPASS ' + checks + ' checks: annotation round trip clears the nav on both pages')
process.exit(f.length ? 1 : 0)
