'use client'

import { useEffect, useRef } from 'react'
import {
  LOGO_FULL_VIEWBOX,
  aspectOf,
  canvasOf,
  logoBox,
  type LogoSize,
} from '@components/logo-roles'

/*
 * The stacked lockup, with eyes that follow the pointer.
 *
 * THREE MASK LAYERS, ONE BOX. `scripts/split-lockup-mask.mjs` cuts the lockup
 * into a face (38 paths: the frame with its screen hole, the wordmark and the
 * tagline) and the two eye discs. All three carry the same 1920x1080 viewBox
 * and are stacked in one element at `mask-size: contain`, so they line up
 * exactly at translate(0, 0) -- that identity is the whole alignment story, and
 * it is why the layers must never be re-exported with a tighter crop.
 *
 * Each eye is its OWN layer rather than one shared "eyes" layer, which costs a
 * third 250-byte asset. The reason is that each eye aims from its own centre,
 * so the pair converges as the pointer comes close. The differential is ~0.5px
 * at a normal cursor distance and ~2.2px at point blank on a 7px eye, which is
 * exactly the range where a face stops looking like two sliding dots.
 *
 * WHY IT CANNOT BE DONE WITH ONE SPAN AND A FILTER. The mark takes its ink from
 * `rgb(var(--accent))` via `.logo-mask`, so it follows any palette including a
 * generated one, and nothing about the files' own colour is ever read. Moving
 * part of the artwork means moving part of the stencil, which means more than
 * one stencil. See CLAUDE.md note 7 -- this is the change that makes "one
 * masked span per role" false, deliberately.
 *
 * FIRST PAINT IS TODAY'S MARK, EXACTLY. All three spans are rendered into the
 * static export with no transform (the custom properties fall back to 0px), so
 * the server HTML, a reader with JS off, and the first frame before hydration
 * are pixel-identical to the single-span lockup this replaces. The pointer
 * listener only ever ADDS a translation. That is the same discipline the
 * 2026-10-17 switch-stutter fix established: every mask layer is mounted and
 * therefore fetched with the page, never revealed out of `display: none`.
 */

const ASPECT = aspectOf(LOGO_FULL_VIEWBOX)
/* Derived from the same constant as ASPECT rather than typed out. logo-roles.ts
   exists so the layout maths and the artwork cannot disagree about the canvas;
   a hard-coded 1080 beside a derived aspect reintroduced exactly that gap --
   changing LOGO_FULL_VIEWBOX would have updated one and not the other, and the
   asset-vs-constant test would still have passed. */
const [CANVAS_WIDTH, CANVAS_HEIGHT] = canvasOf(LOGO_FULL_VIEWBOX)

const FACE_SRC = '/ttt_stacked-tagline_face_light-primary.svg'

/* Eye centres in canvas units, measured with getBBox() on the real asset in a
   browser -- the paths are relative cubics, so parsing their numbers gives
   control points rather than extents. scripts/split-lockup-mask.mjs holds the
   same pair and the vitest guard asserts the two agree. */
const EYES = [
  { src: '/ttt_stacked-tagline_eyeleft_light-primary.svg', cx: 929.9, cy: 293.7 },
  { src: '/ttt_stacked-tagline_eyeright_light-primary.svg', cx: 1049.5, cy: 293.7 },
]

/*
 * THE CLAMP IS ELLIPTICAL, AND THAT IS MEASURED RATHER THAN CHOSEN.
 *
 * The eyes sit inside the screen cutout -- a hole in the face path, so an eye
 * can translate without ever crossing ink. That socket is 322.8 x 103.6 units
 * (x 828.2-1151.0, y 239.3-342.9): nearly three times wider than it is tall.
 * Clearance from an eye at rest is 32.2 units below, 37.4 above and ~84.5 to
 * either side.
 *
 * A circular clamp has to be sized to the tight dimension, which throws the
 * horizontal room away -- and horizontal is the direction an eye reads in. At
 * these values the eye still clears the socket floor by 19 units and its own
 * side by 56, so it never looks like it is about to fall out, while moving
 * 5.8px across at the 225px lockup /about renders. The eye's own radius there
 * is 3.5px, so that is 1.65x its radius.
 */
const TRAVEL_X = 28
const TRAVEL_Y = 13

/* Distance in CSS pixels at which deflection reaches half of maximum. The
   response saturates as d/(d+REACH) rather than clipping at a radius, so there
   is no edge where the eyes stop tracking and no discontinuity to notice. */
const REACH = 300

/* Per-frame lerp factor. Low enough to read as weight rather than lag; the loop
   stops as soon as the eyes settle, so an idle page costs nothing. */
const EASE = 0.14

/* Stop below this many units of error -- about a hundredth of a pixel at any
   size this renders, i.e. invisible, and it is what ends the rAF loop. */
const SETTLED = 0.02

export type TrackingLogoProps = LogoSize & {
  className?: string
  alt?: string
}

export default function TrackingLogoFull({
  height,
  width,
  className,
  alt = 'thinktanktom',
}: TrackingLogoProps) {
  const size = logoBox(ASPECT, (height === undefined ? { width } : { height }) as LogoSize)
  const wrapRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return

    /* prefers-reduced-motion is honoured in JavaScript, not CSS. The global
       reduce block in globals.css forces every transition-duration to ~0, but
       it cannot stop a transform written frame by frame -- so the only correct
       place to respect the preference is before the listener is attached.

       (hover: hover) keeps the whole thing off touch devices, which have no
       cursor for the eyes to follow. Deliberately NOT `and (pointer: fine)`:
       every extra condition is another chance for a browser to answer
       unexpectedly and silently disable the feature, and hover alone already
       expresses "there is a pointer that moves without being pressed". That is
       not hypothetical -- headless chromium reports BOTH as false by default,
       which is why scripts/e2e-logo-eyes.mjs has to override them and asserts
       the override took effect before trusting any measurement. */
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    if (!window.matchMedia('(hover: hover)').matches) return

    /* Array.from rather than a spread: this repo's tsconfig target predates
       downlevelIteration, so spreading a NodeList does not typecheck. */
    const layers = Array.from(wrap.querySelectorAll<HTMLElement>('[data-eye]'))
    if (layers.length !== EYES.length) return

    const current = EYES.map(() => ({ x: 0, y: 0 }))
    let pointer: { x: number; y: number } | null = null
    let frame: number | null = null

    const step = () => {
      const box = wrap.getBoundingClientRect()
      /* Re-read every frame rather than caching: the lockup is responsive and
         the page scrolls, and a stale rect aims the eyes at where the mark used
         to be. getBoundingClientRect on one element per frame is cheap.

         Re-reading is necessary but NOT sufficient — the loop stops when the
         eyes settle, so scroll and resize must kick it awake again. See the
         listeners below; without them this comment described an intent the
         loop's own termination defeated. */

      /* Match what `mask-size: contain` actually does, rather than assuming the
         box keeps the canvas aspect. The wrapper has a fixed inline width and
         height but is a flex item, so below ~448px of viewport its WIDTH shrinks
         while its height does not: `contain` then fits by width and letterboxes
         vertically. Deriving scale from height alone made the eye origins up to
         ~21px wrong at 420px, so the eyes looked past the pointer rather than
         at it. The offsets re-centre the artwork inside whichever axis is slack. */
      const scale = Math.min(box.width / CANVAS_WIDTH, box.height / CANVAS_HEIGHT)
      const offsetX = (box.width - CANVAS_WIDTH * scale) / 2
      const offsetY = (box.height - CANVAS_HEIGHT * scale) / 2
      let moving = false

      EYES.forEach((eye, i) => {
        let tx = 0
        let ty = 0
        if (pointer) {
          const dx = pointer.x - (box.left + offsetX + eye.cx * scale)
          const dy = pointer.y - (box.top + offsetY + eye.cy * scale)
          const d = Math.hypot(dx, dy)
          if (d > 0.001) {
            const reach = d / (d + REACH)
            tx = (dx / d) * TRAVEL_X * reach
            ty = (dy / d) * TRAVEL_Y * reach
          }
        }
        const c = current[i]
        c.x += (tx - c.x) * EASE
        c.y += (ty - c.y) * EASE
        if (Math.abs(tx - c.x) > SETTLED || Math.abs(ty - c.y) > SETTLED) moving = true
        /* Written as custom properties consumed by `.logo-eye`'s transform, so
           the units stay in canvas space here and the stylesheet owns the
           composition. Never React state: this runs at 60fps. */
        layers[i].style.setProperty('--eye-x', `${(c.x * scale).toFixed(2)}px`)
        layers[i].style.setProperty('--eye-y', `${(c.y * scale).toFixed(2)}px`)
      })

      frame = moving ? requestAnimationFrame(step) : null
    }

    const kick = () => {
      if (frame === null) frame = requestAnimationFrame(step)
    }
    const onMove = (e: PointerEvent) => {
      pointer = { x: e.clientX, y: e.clientY }
      kick()
    }
    /* The eyes follow the cursor anywhere on the page, not only over the mark:
       being looked at from across the page is the entire effect. */
    window.addEventListener('pointermove', onMove, { passive: true })
    /* SCROLL AND RESIZE MUST WAKE THE LOOP. It stops as soon as the eyes settle,
       so without these the per-frame getBoundingClientRect above never runs
       again and the eyes stay aimed at where the mark used to be. Measured
       before the fix: scrolling 600px with the pointer still left a 1.4px error
       and resizing 1280 -> 760 left 2.0px, against a 5.8px total travel -- 24%
       and 35% of full deflection, held until the next pointer move. kick() is
       idempotent and the loop still self-terminates, so an idle page is
       unaffected. */
    window.addEventListener('scroll', kick, { passive: true })
    window.addEventListener('resize', kick)
    /* Pointer gone (another window, or off the document) -- return to centre
       rather than freezing mid-glance. */
    const onLeave = () => {
      pointer = null
      kick()
    }
    document.addEventListener('pointerleave', onLeave)

    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('scroll', kick)
      window.removeEventListener('resize', kick)
      document.removeEventListener('pointerleave', onLeave)
      if (frame !== null) cancelAnimationFrame(frame)
    }
  }, [])

  return (
    /* The wrapper carries the accessible name and the reserved box; the three
       layers are decorative, so they are hidden from the accessibility tree.
       `relative` is what the absolutely-positioned layers resolve against. */
    <span
      ref={wrapRef}
      role="img"
      aria-label={alt}
      className={className ? `relative block ${className}` : 'relative block'}
      style={{ width: size.width, height: size.height }}
    >
      <span
        aria-hidden="true"
        className="logo-mask h-full w-full"
        style={{ maskImage: `url(${FACE_SRC})`, WebkitMaskImage: `url(${FACE_SRC})` }}
      />
      {EYES.map((eye) => (
        <span
          key={eye.src}
          aria-hidden="true"
          data-eye=""
          className="logo-mask logo-eye"
          style={{ maskImage: `url(${eye.src})`, WebkitMaskImage: `url(${eye.src})` }}
        />
      ))}
    </span>
  )
}
