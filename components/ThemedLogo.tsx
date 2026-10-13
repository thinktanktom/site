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
  alt?: string
}

type Variant = {
  /* the `.only-*` utility that reveals this variant (defined in globals.css) */
  only: string
  src: string
  /* viewBox width / viewBox height — the width is derived from it, never
     guessed. Transcribed from each file's own viewBox (3rd and 4th values —
     the new assets have a non-zero min-x/min-y, which is not part of the
     ratio). Re-export an asset and this must be re-read from it. */
  aspect: number
}

/*
 * Theme-aware logo marks.
 *
 * The SVG marks have hardcoded fills and cannot follow `data-theme`, so every
 * variant is rendered and CSS reveals exactly one (`.only-funky` / `.only-dark`
 * / `.only-light` toggle `display`). No JS, so no wrong-logo flash on load and
 * nothing here needs to be a client component.
 *
 * The three themes' assets do NOT share aspect ratios, so each role is
 * normalised on a shared HEIGHT and each variant's width comes from its own
 * viewBox. Never hardcode a width/height pair across variants.
 */

const ICON: Variant[] = [
  { only: 'only-funky', src: '/ttt_icon.svg', aspect: 623.62 / 623.62 },
  { only: 'only-dark', src: '/ttt_icon_dark-mono.svg', aspect: 578.24 / 465.37 },
  { only: 'only-light', src: '/ttt_icon_light-neon.svg', aspect: 578.24 / 465.37 },
]

const WORDMARK: Variant[] = [
  { only: 'only-funky', src: '/ttt_side_no_byline_logo.svg', aspect: 1339.99 / 191.14 },
  { only: 'only-dark', src: '/ttt_horizontal_dark-mono.svg', aspect: 1340.02 / 191.17 },
  { only: 'only-light', src: '/ttt_horizontal_light-neon.svg', aspect: 1340.02 / 191.17 },
]

const LOGO_FULL: Variant[] = [
  { only: 'only-funky', src: '/ttt_logo_full.svg', aspect: 1920 / 1080 },
  { only: 'only-dark', src: '/ttt_stacked-tagline_dark-mono.svg', aspect: 1768.61 / 858.81 },
  { only: 'only-light', src: '/ttt_stacked-tagline_light-neon.svg', aspect: 1768.61 / 858.81 },
]

function ThemedLogo({
  variants,
  height,
  width,
  className,
  alt = 'thinktanktom',
}: ThemedLogoProps & { variants: Variant[] }) {
  const sizeFor = (aspect: number) =>
    height === undefined
      ? { width: width as number, height: Math.round((width as number) / aspect) }
      : { width: Math.round(height * aspect), height }
  return (
    <>
      {variants.map((variant) => (
        /* the class goes on the wrapper because `.only-*` toggles `display` */
        <div key={variant.only} className={className ? `${variant.only} ${className}` : variant.only}>
          <Image
            src={variant.src}
            alt={alt}
            {...sizeFor(variant.aspect)}
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
  return <ThemedLogo variants={ICON} {...props} />
}

export function TttWordmark(props: ThemedLogoProps) {
  return <ThemedLogo variants={WORDMARK} {...props} />
}

export function TttLogoFull(props: ThemedLogoProps) {
  return <ThemedLogo variants={LOGO_FULL} {...props} />
}
