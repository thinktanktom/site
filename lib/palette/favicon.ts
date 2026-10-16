/**
 * Make the browser-tab icon follow the palette.
 *
 * The favicon is fetched by browser chrome, outside the document, so none of
 * the mechanisms the page itself uses can reach it: it sees no CSS custom
 * properties, `currentColor` means nothing to it, and the static export has no
 * server that could render a per-palette file. The only route is to hand the
 * <link> a complete, self-contained icon with the colour already baked in, and
 * to rebuild it on the client whenever the palette changes.
 *
 * Why this is a tint of an EXISTING asset rather than geometry in the bundle:
 * `public/ttt_icon_light-primary.svg` is already shipped and already serves as
 * the CSS mask for the random theme's nav mark, so reusing it adds no second
 * copy of the path data to keep in sync -- the same reason CLAUDE.md gives for
 * the mask path over an inline <svg>. Inlining the geometry here instead would
 * put ~2.2KB of paths in the client bundle for every reader, including the ones
 * who never leave funky.
 *
 * It is fetched once and memoised, so a roll costs a string replace, not a
 * request.
 */

import type { Rgb } from './oklch'

/** The single-fill mask asset. Only its SHAPE is used -- see below. */
const MASK_URL = '/ttt_icon_light-primary.svg'

/** The brand icon, used verbatim whenever funky is active. */
const FUNKY_URL = '/ttt_icon.svg'

/**
 * Matches both `rel="icon"` and `rel="shortcut icon"` (a `~=` match is over the
 * whitespace-separated token list) while deliberately NOT matching
 * `apple-touch-icon`: that one is an iOS home-screen bookmark, captured when
 * the bookmark is made rather than read live, so repainting it achieves
 * nothing.
 */
const ICON_SELECTOR = 'link[rel~="icon"]'

/** Resolves to the mask's SVG source, or null if it cannot be fetched. */
let maskSource: Promise<string | null> | null = null

function loadMask(): Promise<string | null> {
  maskSource ??= fetch(MASK_URL)
    .then((r) => (r.ok ? r.text() : null))
    .catch(() => null)
  return maskSource
}

const hex = ([r, g, b]: Rgb): string =>
  '#' + [r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')

/**
 * Overwrite every `fill` in the mask with one colour.
 *
 * Note that this REPLACES rather than substitutes: it never reads what colour
 * the file happened to carry, so the asset contributes only its shape, exactly
 * as it does through the CSS mask (where only the alpha is read). That keeps it
 * on the right side of CLAUDE.md's "never recolour a file variant" rule -- a
 * stencil is not a recolour -- and it means re-exporting the asset in a
 * different colour cannot silently change the favicon.
 *
 * The screen cutout survives because it is geometry, not a light-coloured fill.
 * `e2e-palette.mjs` §9 asserts the generated icon carries exactly ONE distinct
 * fill, so an asset that gains a second ink fails loudly here instead of being
 * quietly flattened.
 */
function tint(svg: string, colour: string): string {
  return svg.replace(/fill="[^"]*"/g, `fill="${colour}"`)
}

function setIcons(href: string): void {
  // forEach rather than for..of: the tsconfig target predates NodeList being
  // iterable, and this is not worth a --downlevelIteration flag.
  document
    .querySelectorAll<HTMLLinkElement>(ICON_SELECTOR)
    .forEach((link) => {
      link.href = href
    })
}

/**
 * Repaint the tab icon in the accent colour.
 *
 * Deliberately async and fire-and-forget. A tab icon is not a layout element,
 * so arriving a few hundred milliseconds late costs nothing visible -- which is
 * also why this is kept out of the pre-paint script in `layout.tsx`, where a
 * fetch would be blocking work before first paint for no benefit.
 */
export async function paintFavicon(accent: Rgb): Promise<void> {
  const svg = await loadMask()
  // Nothing to do if the asset could not be read -- the funky icon stays, which
  // is a correct-looking tab rather than a missing one.
  if (!svg) return
  const data = tint(svg, hex(accent))
  setIcons('data:image/svg+xml,' + encodeURIComponent(data))
}

/**
 * Repaint from whatever accent is currently applied to the document.
 *
 * Needed for exactly one case: the pre-paint script in `layout.tsx` restores a
 * cached palette without the engine running at all, so on a reload none of the
 * paths that call `paintFavicon` fire, and the markup's static funky icon would
 * sit in the tab over a random page. Reading the applied value rather than
 * re-deriving it from the seed also means this cannot disagree with what is
 * actually painted.
 *
 * No-ops unless a palette really is applied -- an unparseable or absent value
 * leaves the funky icon alone.
 */
export function paintFaviconFromDocument(): void {
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue('--accent')
    .trim()
  const parts = raw.split(/\s+/).map(Number)
  if (parts.length !== 3 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return
  }
  void paintFavicon(parts as unknown as Rgb)
}

/** Put the brand icon back. Used when funky becomes active. */
export function resetFavicon(): void {
  setIcons(FUNKY_URL)
}
