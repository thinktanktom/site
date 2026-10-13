import Image from 'next/image'

export type ThemedLogoProps = {
  height: number
  className?: string
  priority?: boolean
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
  className,
  priority,
  alt = 'thinktanktom',
}: ThemedLogoProps & { variants: Variant[] }) {
  return (
    <>
      {variants.map((variant) => (
        /* the class goes on the wrapper because `.only-*` toggles `display` */
        <div key={variant.only} className={className ? `${variant.only} ${className}` : variant.only}>
          <Image
            src={variant.src}
            alt={alt}
            width={Math.round(height * variant.aspect)}
            height={height}
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
