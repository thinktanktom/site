import type { LogoMark } from './paths'

/*
 * One logo mark as an inline <svg> whose ink is `currentColor`.
 *
 * This is the only variant that can follow a palette invented at runtime: the
 * three per-theme SVG *files* have their fills baked in, so `random` gets the
 * geometry inlined and takes its colour from the `--accent` token through a
 * `text-*` class on the element. Never recolour the file variants with a CSS
 * `filter` or a `mask` to fake this — `currentColor` on inline paths is the
 * mechanism.
 *
 * Sizing has to match what next/image produces for the file variants, down to
 * the resolved box, or the mark reflows its container when the theme changes:
 *
 *   - `width` / `height` attributes, from the same one-aspect-per-role maths
 *     ThemedLogo already does.
 *   - `max-w-full h-auto`, because Tailwind's preflight hands `img` (and
 *     `video`) `max-width: 100%; height: auto` but hands `svg` only
 *     `display: block`. Without these two classes an inline mark would refuse
 *     to shrink in a narrow container and would keep the *rounded* height
 *     instead of the aspect-exact one the <img> resolves to.
 *   - `preserveAspectRatio="xMidYMid meet"` — the default, spelled out, because
 *     it is what makes this the exact equivalent of `object-contain` on the
 *     <img>: fit inside the box, centred, never stretched.
 *
 * Accessibility: an <svg> takes `role="img"` + `aria-label`, not `alt`. Only
 * one variant is ever `display: block`, and `display: none` content is outside
 * the accessibility tree, so the four variants do not announce four marks.
 */

export type InlineMarkProps = {
  mark: LogoMark
  width: number
  height: number
  /* announced name; ThemedLogo forwards its public `alt` prop here */
  label: string
  className?: string
}

export function InlineMark({ mark, width, height, label, className }: InlineMarkProps) {
  return (
    <svg
      viewBox={mark.viewBox}
      width={width}
      height={height}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={label}
      className={className ? `h-auto max-w-full ${className}` : 'h-auto max-w-full'}
    >
      {mark.paths.map((p, i) => (
        /* The screen is a transparent cutout: there is no path for it and
           there must not be one. A filled screen was tried in the light mark
           and reverted — it read as a faint rectangle against the scrolled
           nav's bg-surface/90. */
        <path key={i} d={p.d} transform={p.transform} fill="currentColor" />
      ))}
    </svg>
  )
}
