/*
 * The brand marks' reference canvases, in one place.
 *
 * WHY THIS FILE EXISTS. `ThemedLogo.tsx` used to hold these three strings, and
 * that was fine while it was the only consumer. `TrackingLogo.tsx` is a second
 * one, and it is a CLIENT component: importing ThemedLogo from it would pull
 * that module's JSX into the client graph for one string, and copying the
 * numbers instead would create exactly the drift CLAUDE.md note 7 warns about
 * -- a role whose layout maths and whose artwork disagree about the canvas.
 * Plain constants with no React and no DOM can be imported from either side.
 *
 * THE INVARIANT, restated from note 7: an asset's own `viewBox` must equal the
 * reference canvas for its role. The `*-mono` and `*-primary` exports
 * originally shipped cropped tight to the ink while the masters carried
 * padding, which drew the mark ~8% (icon) and ~26% (stacked) too large and --
 * because that padding is vertically asymmetric -- could not be fixed by
 * scaling. They are all normalised now. Re-export an asset and re-read its
 * viewBox against the constant here before trusting it.
 *
 * For the stacked lockup there is now a second reason: `TrackingLogo` stacks
 * three mask layers in one box at `mask-size: contain`, so a layer carrying a
 * different viewBox would scale differently and its eye would drift out of the
 * socket. `scripts/split-lockup-mask.mjs` writes LOGO_FULL_VIEWBOX into the
 * layers it generates, and `components/__tests__/lockup-mask-split.test.ts`
 * asserts all four files agree with this constant.
 */

export const ICON_VIEWBOX = '0 0 623.62 623.62'
export const WORDMARK_VIEWBOX = '0 0 1339.99 191.14'
export const LOGO_FULL_VIEWBOX = '0 0 1920 1080'

/** aspect ratio straight out of a role's viewBox, so there is one number */
export function aspectOf(viewBox: string): number {
  const [, , w, h] = viewBox.trim().split(/[\s,]+/).map(Number)
  if (!w || !h) throw new Error(`unusable viewBox: "${viewBox}"`)
  return w / h
}

/* Give exactly one dimension; the other is derived from the role's aspect
   ratio. Which one you pin decides what stays put in the surrounding layout:
   pin the height for a lockup sitting in a row (the nav, the footer), pin the
   width for a mark centred in a column (the hero). */
export type LogoSize =
  | { height: number; width?: never }
  | { width: number; height?: never }

/** the element box for a role, so the mark reserves its space before the mask
    loads and the surrounding layout never depends on when it arrives */
export function logoBox(aspect: number, size: LogoSize): { width: number; height: number } {
  return size.height === undefined
    ? { width: size.width as number, height: Math.round((size.width as number) / aspect) }
    : { width: Math.round(size.height * aspect), height: size.height }
}
