import Image from 'next/image'

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
  /* viewBox width / viewBox height, shared by every variant of the role.
     INVARIANT: all three assets of a role carry the SAME viewBox and the
     SAME path sequence in the same coordinates — only the fill differs, so
     one viewBox means the element box AND the ink land on the same pixels in
     all three themes. The screen stays a transparent cutout in every variant;
     a theme that fills it is a theme whose mark no longer matches the others.

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
     trusting it; a tight crop sneaking back in is exactly the old bug. */
  aspect: number
  variants: Variant[]
}

/*
 * Theme-aware logo marks.
 *
 * The SVG marks have hardcoded fills and cannot follow `data-theme`, so every
 * variant is rendered and CSS reveals exactly one (`.only-funky` / `.only-dark`
 * / `.only-light` toggle `display`). No JS, so no wrong-logo flash on load and
 * nothing here needs to be a client component.
 */

const ICON: Role = {
  aspect: 623.62 / 623.62,
  variants: [
    { only: 'only-funky', src: '/ttt_icon.svg' },
    { only: 'only-dark', src: '/ttt_icon_dark-mono.svg' },
    { only: 'only-light', src: '/ttt_icon_light-primary.svg' },
  ],
}

const WORDMARK: Role = {
  aspect: 1339.99 / 191.14,
  variants: [
    { only: 'only-funky', src: '/ttt_side_no_byline_logo.svg' },
    { only: 'only-dark', src: '/ttt_horizontal_dark-mono.svg' },
    { only: 'only-light', src: '/ttt_horizontal_light-primary.svg' },
  ],
}

const LOGO_FULL: Role = {
  aspect: 1920 / 1080,
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
  const size =
    height === undefined
      ? { width: width as number, height: Math.round((width as number) / role.aspect) }
      : { width: Math.round(height * role.aspect), height }
  return (
    <>
      {role.variants.map((variant) => (
        /* the class goes on the wrapper because `.only-*` toggles `display` */
        <div key={variant.only} className={className ? `${variant.only} ${className}` : variant.only}>
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
