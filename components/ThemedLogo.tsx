import Image from 'next/image'

import { InlineMark } from './logo/InlineMark'
import { ICON_MARK, LOGO_FULL_MARK, WORDMARK_MARK, type LogoMark } from './logo/paths'

/* Give exactly one dimension; the other is derived from the role's aspect
   ratio. Which one you pin decides what stays put in the surrounding layout:
   pin the height for a lockup sitting in a row (the nav, the footer), pin the
   width for a mark centred in a column (the hero). Every variant of a role
   renders at the same box either way — see the note on Role. */
type ThemedLogoSize =
  | { height: number; width?: never }
  | { width: number; height?: never }

export type ThemedLogoProps = ThemedLogoSize & {
  className?: string
  alt?: string
}

type Variant = {
  /* the `.only-*` utility that reveals this variant (defined in globals.css) */
  only: string
  src: string
}

type Role = {
  /* Geometry for the inline `random` variant, and the single source of the
     role's aspect ratio — `aspect` below is computed from `mark.viewBox`, not
     typed out, so the number the layout maths uses and the number the inline
     mark draws with cannot drift apart. */
  mark: LogoMark
  /* viewBox width / viewBox height, shared by every variant of the role.
     INVARIANT: all variants of a role carry the SAME viewBox and the SAME
     path sequence in the same coordinates — only the ink differs, so one
     viewBox means the element box AND the ink land on the same pixels in every
     theme. The screen stays a transparent cutout in every variant; a theme
     that fills it is a theme whose mark no longer matches the others.

     This is load-bearing, and the history says why. The dark/light exports
     originally shipped cropped tight to the ink while funky's masters carry
     padding, so sizing each file by its own aspect drew the mark ~8% (icon)
     and ~26% (stacked logo) too large outside funky. The first fix kept the
     mismatched assets and scaled each variant down by its ink/canvas fraction.
     That equalised the ink but left the element boxes different sizes, which
     reflowed every container that does not reserve a fixed height — /about
     collapsed 45.83px and moved the whole page with it — and could not fix
     position anyway, because funky's padding is vertically ASYMMETRIC (icon
     top 89.45 vs bottom 68.95 user units; stacked 123 vs 97), so a centred
     tight crop still sat 1.58px high in the hero. Normalising the viewBoxes
     removes both failures at the source instead of compensating for them.

     Re-export an asset and re-read its viewBox against the funky master before
     trusting it; a tight crop sneaking back in is exactly the old bug.
     `node components/logo/extract-paths.mjs` asserts the inline geometry's
     viewBox against funky's master and refuses to write if they diverge — it
     cannot check the dark/light *files*, so those still need eyes. */
  aspect: number
  /* the themes whose mark is a prebuilt, fill-baked SVG file */
  variants: Variant[]
}

/*
 * Theme-aware logo marks — a deliberate dual path.
 *
 * `funky` / `dark` / `light`: ASSET SWAP. Every variant is rendered and CSS
 * reveals exactly one (`.only-funky` / `.only-dark` / `.only-light` toggle
 * `display`). These stay as files on purpose, not out of inertia: funky's
 * `ttt_logo_full.svg` is the one mark with THREE inks (#E1F708 computer,
 * #F6F4F1 and #FFFFFF wordmark/tagline). Routing it through a single-ink
 * inline mark would flatten all three to one colour, which is a visible
 * regression on /about. Do not "unify" the four variants onto the inline path.
 *
 * `random`: INLINE SVG. The palette is generated at runtime, so no file can
 * carry its fill. `.only-random` reveals an inline <svg> whose paths are
 * `fill="currentColor"`, and `text-accent` points `currentColor` at the
 * `--accent` token — which is a CSS variable the randomiser rewrites, so the
 * mark follows a palette that did not exist at build time. This mark is
 * single-ink by nature; see components/logo/InlineMark.tsx for the sizing
 * rules that keep its box identical to the <img> variants'.
 *
 * Either way the choice is made in CSS, not JS: no wrong-logo flash on load,
 * nothing here is a client component, and it all survives the static export.
 */

/** aspect ratio straight out of a mark's viewBox, so there is one number */
function aspectOf(mark: LogoMark): number {
  const [, , w, h] = mark.viewBox.trim().split(/[\s,]+/).map(Number)
  if (!w || !h) throw new Error(`unusable viewBox: "${mark.viewBox}"`)
  return w / h
}

const ICON: Role = {
  mark: ICON_MARK,
  aspect: aspectOf(ICON_MARK),
  variants: [
    { only: 'only-funky', src: '/ttt_icon.svg' },
    { only: 'only-dark', src: '/ttt_icon_dark-mono.svg' },
    { only: 'only-light', src: '/ttt_icon_light-primary.svg' },
  ],
}

const WORDMARK: Role = {
  mark: WORDMARK_MARK,
  aspect: aspectOf(WORDMARK_MARK),
  variants: [
    { only: 'only-funky', src: '/ttt_side_no_byline_logo.svg' },
    { only: 'only-dark', src: '/ttt_horizontal_dark-mono.svg' },
    { only: 'only-light', src: '/ttt_horizontal_light-primary.svg' },
  ],
}

const LOGO_FULL: Role = {
  mark: LOGO_FULL_MARK,
  aspect: aspectOf(LOGO_FULL_MARK),
  variants: [
    { only: 'only-funky', src: '/ttt_logo_full.svg' },
    { only: 'only-dark', src: '/ttt_stacked-tagline_dark-mono.svg' },
    { only: 'only-light', src: '/ttt_stacked-tagline_light-primary.svg' },
  ],
}

function ThemedLogo({
  role,
  height,
  width,
  className,
  alt = 'thinktanktom',
}: ThemedLogoProps & { role: Role }) {
  /* ONE size for every variant, computed once from the one role aspect. Every
     variant — the three files and the inline mark — is handed this same pair,
     which is what makes the element boxes identical and the theme switch a
     pure repaint instead of a reflow. */
  const size =
    height === undefined
      ? { width: width as number, height: Math.round((width as number) / role.aspect) }
      : { width: Math.round(height * role.aspect), height }
  /* the class goes on the wrapper because `.only-*` toggles `display` */
  const wrap = (only: string) => (className ? `${only} ${className}` : only)
  return (
    <>
      {role.variants.map((variant) => (
        <div key={variant.only} className={wrap(variant.only)}>
          <Image
            src={variant.src}
            alt={alt}
            {...size}
            className="object-contain"
            unoptimized
            /* No variant preloads. Only one is ever visible, but the theme
               is not known at build time, so marking any of them `priority`
               makes that one eager + preloaded in EVERY theme — the funky
               assets were being downloaded for dark and light readers and
               rendered hidden. The hidden variants are display:none, so a
               lazy image inside them is never requested at all, and the
               visible one is in the viewport and loads at layout. Measured:
               under Fast-3G the LCP element is the h1, gated by the webfont,
               not the mark — so there is nothing here worth preloading. */
          />
        </div>
      ))}
      <div className={wrap('only-random')}>
        {/* Inline, so there is no request to make and nothing to preload; it
            costs HTML bytes in every theme instead (the stacked mark is ~28KB
            of path data, on one page). `text-accent` is what colours it —
            the token, never a hardcoded hex, or it stops following the
            randomised palette. */}
        <InlineMark mark={role.mark} {...size} label={alt} className="text-accent" />
      </div>
    </>
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
