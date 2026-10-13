import Image from 'next/image'

/* Give exactly one dimension; the other is derived from each variant's own
   aspect ratio. Which one you pin decides what stays put when the theme
   changes: pin the height for a lockup sitting in a row (the nav, the footer),
   pin the width for a mark centred in a column (the hero), so the swap does
   not nudge the layout around it. */
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
  /* viewBox width / viewBox height — the other dimension is derived from it,
     never guessed. Transcribed from each file's own viewBox (3rd and 4th
     values — the new assets have a non-zero min-x/min-y, which is not part of
     the ratio). Re-export an asset and this must be re-read from it. */
  aspect: number
  /* Fraction of the requested box this variant is drawn at, so that the
     visible MARK comes out the same size in every theme. The funky SVGs wrap
     the artwork in a padded canvas while the themed ones are cropped to it, so
     drawing them all at one box size makes the themed marks ~8% larger.
     Measured, not guessed: the ink is byte-identical across the three icon
     files at 578.2 x 465.22 user units, and funky's canvas is 623.62 square.
     1 for funky (it defines the box) and ink/canvas for the themed pair. */
  scaleW: number
  scaleH: number
}

const FULL = { scaleW: 1, scaleH: 1 }

/*
 * Theme-aware logo marks.
 *
 * The SVG marks have hardcoded fills and cannot follow `data-theme`, so every
 * variant is rendered and CSS reveals exactly one (`.only-funky` / `.only-dark`
 * / `.only-light` toggle `display`). No JS, so no wrong-logo flash on load and
 * nothing here needs to be a client component.
 *
 * The three themes' assets share neither aspect ratio nor padding, so the size
 * you pass describes the FUNKY box and each variant is drawn at the fraction
 * of it that makes the visible mark match. Never hardcode a width/height pair
 * across variants.
 */

/* Icon: funky pads a 623.62 square around ink of 578.2 x 465.22; the themed
   files are cropped to that ink. */
const ICON: Variant[] = [
  { only: 'only-funky', src: '/ttt_icon.svg', aspect: 1, ...FULL },
  {
    only: 'only-dark',
    src: '/ttt_icon_dark-mono.svg',
    aspect: 578.24 / 465.37,
    scaleW: 578.24 / 623.62,
    scaleH: 465.37 / 623.62,
  },
  {
    only: 'only-light',
    src: '/ttt_icon_light-neon.svg',
    aspect: 578.24 / 465.37,
    scaleW: 578.24 / 623.62,
    scaleH: 465.37 / 623.62,
  },
]

/* Wordmark: all three are already cropped identically (measured ink
   1340.01 x 191.11 in every file), so no correction is needed here. */
const WORDMARK: Variant[] = [
  { only: 'only-funky', src: '/ttt_side_no_byline_logo.svg', aspect: 1339.99 / 191.14, ...FULL },
  { only: 'only-dark', src: '/ttt_horizontal_dark-mono.svg', aspect: 1340.02 / 191.17, ...FULL },
  { only: 'only-light', src: '/ttt_horizontal_light-neon.svg', aspect: 1340.02 / 191.17, ...FULL },
]

/* Stacked logo: same padding story as the icon. funky draws into a 1920x1080
   canvas whose visible ink measures 1768.6 x 859 — the themed viewBox exactly. */
const LOGO_FULL: Variant[] = [
  { only: 'only-funky', src: '/ttt_logo_full.svg', aspect: 1920 / 1080, ...FULL },
  {
    only: 'only-dark',
    src: '/ttt_stacked-tagline_dark-mono.svg',
    aspect: 1768.61 / 858.81,
    scaleW: 1768.61 / 1920,
    scaleH: 858.81 / 1080,
  },
  {
    only: 'only-light',
    src: '/ttt_stacked-tagline_light-neon.svg',
    aspect: 1768.61 / 858.81,
    scaleW: 1768.61 / 1920,
    scaleH: 858.81 / 1080,
  },
]

function ThemedLogo({
  variants,
  height,
  width,
  className,
  priority,
  alt = 'thinktanktom',
}: ThemedLogoProps & { variants: Variant[] }) {
  const sizeFor = ({ aspect, scaleW, scaleH }: Variant) => {
    if (height === undefined) {
      const w = Math.round((width as number) * scaleW)
      return { width: w, height: Math.round(w / aspect) }
    }
    const h = Math.round(height * scaleH)
    return { width: Math.round(h * aspect), height: h }
  }
  return (
    <>
      {variants.map((variant) => (
        /* the class goes on the wrapper because `.only-*` toggles `display` */
        <div key={variant.only} className={className ? `${variant.only} ${className}` : variant.only}>
          <Image
            src={variant.src}
            alt={alt}
            {...sizeFor(variant)}
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
  return <ThemedLogo variants={ICON} {...props} />
}

export function TttWordmark(props: ThemedLogoProps) {
  return <ThemedLogo variants={WORDMARK} {...props} />
}

export function TttLogoFull(props: ThemedLogoProps) {
  return <ThemedLogo variants={LOGO_FULL} {...props} />
}
