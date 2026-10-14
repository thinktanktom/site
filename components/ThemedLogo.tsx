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
  /* The role's canvas, and the single source of its aspect ratio — `aspect`
     below is computed from this rather than typed out, so the number the layout
     maths uses and the number the artwork is drawn on cannot drift apart. */
  viewBox: string
  /* Single-fill asset used as the ALPHA MASK for the `random` variant. Any of
     the mono exports would do — only their alpha matters, not their ink. */
  maskSrc: string
  /* viewBox width / viewBox height, shared by every variant of the role.
     INVARIANT: all variants of a role carry the SAME viewBox and the SAME
     path sequence in the same coordinates — only the ink differs, so one
     viewBox means the element box AND the ink land on the same pixels in every
     theme.

     Measured caveat, so the claim above is not read as more exact than it is:
     the masked element resolves 0.062px TALLER than the <img> in the wordmark
     role only (224×32.000 vs 224×31.938). Both are handed the same size pair,
     but <img> then has preflight's height:auto and the UA's attr()-based
     aspect-ratio applied on top, which re-derives its height from the ROUNDED
     width/height, while an explicitly sized span keeps what it was given.
     Verified across all four themes on / and /about: nothing reflows — the h1
     top, the footer icon top and document scrollHeight are byte-identical in
     every theme — and the other two roles are exact (96×96, 24×24, 400×225). The screen stays a transparent cutout in every variant; a theme
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
 * `random`: CSS MASK. The palette is generated at runtime, so no file can carry
 * its fill. `.only-random` reveals an empty element painted with
 * `background-color: rgb(var(--accent))` and masked by one of the mono SVGs, so
 * the artwork becomes a stencil and the token supplies the colour.
 *
 * This is NOT the forbidden "recolour a mark" — nothing is filtered or
 * hue-shifted, and the file contributes only its alpha. It replaced an inline
 * <svg> that did the same job with `fill="currentColor"`: correct, but it had
 * to be rendered in EVERY theme and merely hidden, because the theme is not
 * known at build time, so its path data cost HTML bytes for every reader
 * (/about carried ~36KB of it). A masked element costs nothing but the rule,
 * and because hidden elements do not load their masks, the asset is fetched
 * only by readers actually in the random theme.
 *
 * Either way the choice is made in CSS, not JS: no wrong-logo flash on load,
 * nothing here is a client component, and it all survives the static export.
 */

/** aspect ratio straight out of a role's viewBox, so there is one number */
function aspectOf(viewBox: string): number {
  const [, , w, h] = viewBox.trim().split(/[\s,]+/).map(Number)
  if (!w || !h) throw new Error(`unusable viewBox: "${viewBox}"`)
  return w / h
}

const ICON_VIEWBOX = '0 0 623.62 623.62'
const ICON: Role = {
  viewBox: ICON_VIEWBOX,
  maskSrc: '/ttt_icon_light-primary.svg',
  aspect: aspectOf(ICON_VIEWBOX),
  variants: [
    { only: 'only-funky', src: '/ttt_icon.svg' },
    { only: 'only-dark', src: '/ttt_icon_dark-mono.svg' },
    { only: 'only-light', src: '/ttt_icon_light-primary.svg' },
  ],
}

const WORDMARK_VIEWBOX = '0 0 1339.99 191.14'
const WORDMARK: Role = {
  viewBox: WORDMARK_VIEWBOX,
  maskSrc: '/ttt_horizontal_light-primary.svg',
  aspect: aspectOf(WORDMARK_VIEWBOX),
  variants: [
    { only: 'only-funky', src: '/ttt_side_no_byline_logo.svg' },
    { only: 'only-dark', src: '/ttt_horizontal_dark-mono.svg' },
    { only: 'only-light', src: '/ttt_horizontal_light-primary.svg' },
  ],
}

const LOGO_FULL_VIEWBOX = '0 0 1920 1080'
const LOGO_FULL: Role = {
  viewBox: LOGO_FULL_VIEWBOX,
  maskSrc: '/ttt_stacked-tagline_light-primary.svg',
  aspect: aspectOf(LOGO_FULL_VIEWBOX),
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
     variant — the three files and the masked element — is handed this same
     pair, which is what makes the element boxes identical and the theme switch
     a pure repaint instead of a reflow. */
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
        {/* An empty box: the colour is `background-color` from the --accent
            token (never a hardcoded hex, or it stops following the palette) and
            the shape is the mask. The shared mask-* declarations live on
            `.logo-mask` in globals.css so autoprefixer can add the -webkit-
            pair; only the per-role url is inline. role="img" + aria-label
            because the element has no content of its own to name it. */}
        <span
          role="img"
          aria-label={alt}
          className="logo-mask"
          style={{
            width: size.width,
            height: size.height,
            maskImage: `url(${role.maskSrc})`,
            WebkitMaskImage: `url(${role.maskSrc})`,
          }}
        />
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
