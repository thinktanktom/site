/* The reference canvases, the aspect helper and the element-box maths live in
   components/logo-roles.ts, so the client-side TrackingLogo can share them
   without importing this module's JSX. See the note on Role below -- the
   invariant they carry is unchanged, only its address is. */
import {
  ICON_VIEWBOX,
  WORDMARK_VIEWBOX,
  LOGO_FULL_VIEWBOX,
  aspectOf,
  logoBox,
  type LogoSize,
} from '@components/logo-roles'

export type ThemedLogoProps = LogoSize & {
  className?: string
  alt?: string
}

type Role = {
  /* The role's canvas, and the single source of its aspect ratio -- `aspect`
     below is computed from this rather than typed out, so the number the layout
     maths uses and the number the artwork is drawn on cannot drift apart. */
  viewBox: string
  /* The single-fill asset used as the mark's ALPHA MASK. These are the
     `*_light-primary.svg` exports; nothing about their own ink is ever read, so
     do not delete them as "the light theme's files" and do not re-export them
     in another colour expecting the mark to change. */
  maskSrc: string
  /* viewBox width / viewBox height.

     INVARIANT: the mask asset's viewBox must match the reference canvas below.
     The `*-mono` and `*-primary` exports originally shipped cropped tight to
     the ink while the reference masters carry padding, so sizing each file by
     its own aspect drew the mark ~8% (icon) and ~26% (stacked logo) too large.
     The first fix kept the mismatched assets and scaled each variant down by
     its ink/canvas fraction. That equalised the ink but left the element boxes
     different sizes, which reflowed every container that does not reserve a
     fixed height -- /about collapsed 45.83px and moved the whole page with it
     -- and could not fix position anyway, because the reference padding is
     vertically ASYMMETRIC (icon top 89.45 vs bottom 68.95 user units; stacked
     123 vs 97), so a centred tight crop still sat 1.58px high in the hero.
     Normalising the viewBoxes removes both failures at the source instead of
     compensating for them.

     Re-export an asset and re-read its viewBox against the reference canvas
     before trusting it; a tight crop sneaking back in is exactly the old bug.

     There is NO automated guard on this. It used to be
     `components/logo/extract-paths.mjs`, which asserted the inline geometry's
     viewBox and refused to write on a mismatch -- but that whole directory went
     away with the inline-<svg> mark it generated, so the only check left is the
     one in your head. The canvases to match are 623.62 square (icon),
     1339.99x191.14 (wordmark) and 1920x1080 (full logo).

     The screen is a transparent cutout and must stay one: the mask reads alpha,
     so a filled screen becomes ink. A white screen fill in the light-primary
     mark was tried and reverted -- it read as a faint lighter rectangle against
     the scrolled nav's bg-surface/90. */
  aspect: number
}

/*
 * Theme-aware logo marks -- ONE path, not two, as of 2026-10-17.
 *
 * Every theme renders the same empty <span>, painted
 * `background-color: rgb(var(--accent))` and stencilled by a single-fill SVG
 * (`role.maskSrc`). The artwork becomes a hole-punch and the token supplies the
 * colour, so the mark follows the palette with no JavaScript, no per-theme
 * asset list, and nothing to keep in sync.
 *
 * WHAT THIS REPLACED, AND WHY IT HAD TO GO. Until 2026-10-17 this file ran a
 * dual path: dark-mono got a prebuilt fill-baked <img> revealed by
 * `.only-dark-mono`, and random got the masked span revealed by `.only-random`.
 * That was a measured rendering bug, not just extra machinery -- a
 * `display: none` element never loads its mask image, so the dice press
 * revealed the masked span at the very instant the mask file was first
 * requested. For the length of that request the span was displayed, correctly
 * sized, and painting NOTHING. Measured over CDP against the built export: one
 * whole frame with no logo on localhost (nav wordmark pixel [0,0,0] at +28ms,
 * correct at +41ms), and ~300ms of missing logo with the link throttled to
 * 400ms latency / 50KB/s on a cold cache. Once mounted for every theme the mask
 * loads with the page, so the gap is not merely shortened, it is unreachable.
 *
 * The second half of the same fix lives in `.logo-mask` in globals.css: a
 * `background-color` transition, so the ink EASES from one accent to the next in
 * step with the `html, body` background transition rather than snapping one
 * frame ahead of it.
 *
 * THE ONE CONDITION THIS DESIGN DEPENDS ON: the default theme's mark is now
 * token-driven, so it is correct only while `--accent` is the ink the brand's
 * own dark-mono export carries. Both are pure white today (`#FFFFFF` ==
 * `--accent: 255 255 255`), exactly. The moment a future default accent stops
 * being that white, the default mark silently changes colour with it -- that is
 * the trade accepted here, and CLAUDE.md names it too. It is also why the
 * unused `ttt_*_dark-mono.svg` exports stay on disk: they are the record of what
 * the mark's ink is supposed to be.
 *
 * WHY A MASK AND NOT AN INLINE <svg>. An inline mark with
 * `fill="currentColor"` was built first and did the same job correctly, but the
 * theme is not known at build time, so it had to be rendered in EVERY theme and
 * merely hidden -- its path data cost HTML bytes for every reader (/about
 * carried ~36KB of it). A masked element costs nothing but the rule. Measured
 * gzip at the time: /about 26,665 bytes with the inline mark against 8,425 with
 * the mask; / 12,038 against 7,839.
 *
 * This is NOT the forbidden "recolour a mark": nothing is filtered or
 * hue-shifted, and the file contributes only its alpha.
 */

const ICON: Role = {
  viewBox: ICON_VIEWBOX,
  maskSrc: '/ttt_icon_light-primary.svg',
  aspect: aspectOf(ICON_VIEWBOX),
}

const WORDMARK: Role = {
  viewBox: WORDMARK_VIEWBOX,
  maskSrc: '/ttt_horizontal_light-primary.svg',
  aspect: aspectOf(WORDMARK_VIEWBOX),
}

const LOGO_FULL: Role = {
  viewBox: LOGO_FULL_VIEWBOX,
  maskSrc: '/ttt_stacked-tagline_light-primary.svg',
  aspect: aspectOf(LOGO_FULL_VIEWBOX),
}

function ThemedLogo({
  role,
  height,
  width,
  className,
  alt = 'thinktanktom',
}: ThemedLogoProps & { role: Role }) {
  /* The element box is computed from the one role aspect and handed over
     explicitly, so the mark reserves its space before the mask has loaded and
     the surrounding layout never depends on when it arrives. */
  const size = logoBox(role.aspect, (height === undefined ? { width } : { height }) as LogoSize)
  return (
    /* An empty box: the colour is `background-color` from the --accent token
       (never a hardcoded hex, or it stops following the palette) and the shape
       is the mask. The shared mask-* declarations live on `.logo-mask` in
       globals.css so autoprefixer can add the -webkit- pair; only the per-role
       url is inline. role="img" + aria-label because the element has no content
       of its own to name it. */
    <span
      role="img"
      aria-label={alt}
      className={className ? `logo-mask ${className}` : 'logo-mask'}
      style={{
        width: size.width,
        height: size.height,
        maskImage: `url(${role.maskSrc})`,
        WebkitMaskImage: `url(${role.maskSrc})`,
      }}
    />
  )
}

export function TttIcon(props: ThemedLogoProps) {
  return <ThemedLogo role={ICON} {...props} />
}

export function TttWordmark(props: ThemedLogoProps) {
  return <ThemedLogo role={WORDMARK} {...props} />
}

export function TttLogoFull(props: ThemedLogoProps) {
  return <ThemedLogo role={LOGO_FULL} {...props} />
}
