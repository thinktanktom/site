import Image from 'next/image'

/* Give exactly one dimension; the other is derived from the role's aspect
   ratio. Which one you pin decides what stays put in the surrounding layout:
   pin the height for a lockup sitting in a row (the nav, the footer), pin the
   width for a mark centred in a column (the hero). All three theme variants
   render at the same size either way — see the note on Role below. */
type ThemedLogoSize =
  | { height: number; width?: never }
  | { width: number; height?: never }

export type ThemedLogoProps = ThemedLogoSize & {
  className?: string
  priority?: boolean
  alt?: string
}

type Variant = {
  /* the `.only-*` utility that reveals this variant (defined in globals.css) */
  only: string
  src: string
}

type Role = {
  /* viewBox width / viewBox height, shared by every variant of the role.
     INVARIANT: all three assets of a role carry the SAME viewBox — identical
     artwork on an identical canvas, differing only in fill. That is what makes
     the mark render at the same size and the same offset in all three themes.
     The dark/light exports originally shipped cropped tight to the ink while
     funky's masters carry padding, which scaled the art up 8% (icon) and 26%
     (stacked logo) on a theme switch; their viewBoxes were widened to funky's
     canvas to fix it. Re-export an asset and you must re-check its viewBox
     against the funky master, not just transcribe it here. */
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
    { only: 'only-light', src: '/ttt_icon_light-neon.svg' },
  ],
}

const WORDMARK: Role = {
  aspect: 1339.99 / 191.14,
  variants: [
    { only: 'only-funky', src: '/ttt_side_no_byline_logo.svg' },
    { only: 'only-dark', src: '/ttt_horizontal_dark-mono.svg' },
    { only: 'only-light', src: '/ttt_horizontal_light-neon.svg' },
  ],
}

const LOGO_FULL: Role = {
  aspect: 1920 / 1080,
  variants: [
    { only: 'only-funky', src: '/ttt_logo_full.svg' },
    { only: 'only-dark', src: '/ttt_stacked-tagline_dark-mono.svg' },
    { only: 'only-light', src: '/ttt_stacked-tagline_light-neon.svg' },
  ],
}

function ThemedLogo({
  role,
  height,
  width,
  className,
  priority,
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
            /* Only the funky variant preloads. Marking all three `priority`
               emits three rel=preload/fetchPriority=high links where two are
               display:none, competing with the real LCP image. The other two
               stay lazy, and a lazy img in a display:none subtree is not
               fetched until revealed — so they cost nothing until you switch. */
            priority={priority && variant.only === 'only-funky'}
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
