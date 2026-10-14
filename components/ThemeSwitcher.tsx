'use client'

import { useEffect, useState } from 'react'
import { Zap, Moon, Sun, Dices } from 'lucide-react'
import { generate } from '@lib/palette/generate'
import {
  THEME_KEY,
  applyPalette,
  clearPalette,
  persistPalette,
  randomSeed,
  readSeed,
} from '@lib/palette/apply'


export type Theme = 'funky' | 'dark' | 'light' | 'random'

const themes = [
  { id: 'funky' as Theme, Icon: Zap, label: 'Funky' },
  { id: 'dark' as Theme, Icon: Moon, label: 'Dark' },
  { id: 'light' as Theme, Icon: Sun, label: 'Light' },
  { id: 'random' as Theme, Icon: Dices, label: 'Random' },
]

type ThemeSwitcherProps = {
  variant?: 'compact' | 'full'
  className?: string
}

export default function ThemeSwitcher({
  variant = 'compact',
  className = '',
}: ThemeSwitcherProps) {
  // Starts null so the server render and the first client render agree
  // (nothing pressed) — the pre-paint script in layout.tsx owns the attribute
  // and React must not fight it. Buttons are full-size from the first paint,
  // so resolving the theme causes no layout shift.
  const [theme, setTheme] = useState<Theme | null>(null)
  /* Re-rolling does not change aria-pressed -- the dice is already pressed --
     so without a live region a screen-reader user gets no feedback at all that
     anything happened. The seed is included because it is the one thing that
     distinguishes one palette from another and is what makes it reproducible. */
  const [announcement, setAnnouncement] = useState('')

  useEffect(() => {
    const read = () => {
      const t = document.documentElement.dataset.theme
      setTheme(
        t === 'dark' || t === 'light' || t === 'random' ? t : 'funky',
      )
    }
    read()

    // Recover from a refused palette cache. The pre-paint script falls through
    // to funky when the cache is stale, partial or unparseable, but the stored
    // theme is still 'random' — so if those disagree, regenerate from the seed.
    // This is the one case where the engine runs on the client, and it is a
    // frame late by design: see the note in layout.tsx.
    try {
      if (
        localStorage.getItem(THEME_KEY) === 'random' &&
        document.documentElement.dataset.theme !== 'random'
      ) {
        const seed = readSeed() ?? randomSeed()
        const palette = generate(seed)
        applyPalette(palette.tokens, palette.polarity)
        persistPalette(palette)
        document.documentElement.setAttribute('data-theme', 'random')
        // Sync React too. read() above already ran and saw the pre-paint
        // script's funky fallback, and the MutationObserver is not attached
        // until below, so without this the DOM says random while state says
        // funky: aria-pressed lands on the wrong button (contradicting the CSS
        // pressed visual), the dice announces "Random theme" instead of
        // "Re-roll", and the next press restores the stored seed instead of
        // re-rolling.
        setTheme('random')
      }
    } catch {
      // localStorage throws outright in some privacy modes — funky is already
      // applied and is a correct resting state.
    }

    // The desktop control and the mobile overlay are separate instances, so a
    // change made in one has to be observed rather than assumed — otherwise
    // the other's aria-pressed goes stale. The attribute is the one source of
    // truth; this just follows it.
    const observer = new MutationObserver(read)
    observer.observe(document.documentElement, {
      attributeFilter: ['data-theme'],
    })
    return () => observer.disconnect()
  }, [])

  const select = (next: Theme) => {
    if (next === 'random') {
      // The dice ALWAYS rolls a new palette, whether or not random is already
      // active — pressing a dice and getting the palette you already had is not
      // what a dice means. Getting a previous look back is what the three named
      // themes are for. (A reload is different: that restores the stored seed,
      // because a page load is not a press.)
      const palette = generate(randomSeed())
      applyPalette(palette.tokens, palette.polarity)
      persistPalette(palette)
      setAnnouncement(
        `${palette.polarity} palette applied, seed ${palette.seed}`,
      )
    } else {
      // Inline custom properties beat the stylesheet, so a named theme cannot
      // take effect until the random palette's properties are removed.
      clearPalette()
      setAnnouncement('')
      try {
        localStorage.setItem(THEME_KEY, next)
      } catch {
        // the attribute below still applies the theme for this session
      }
    }

    document.documentElement.setAttribute('data-theme', next)
    setTheme(next)
  }

  /* The full variant is a 2x2 GRID, not a row, and that is a measured
     constraint rather than a preference. It is used once -- in the mobile
     overlay, inside a w-64 (256px) box -- and four labelled buttons in one row
     measure 417px of content. flex-1 does not rescue it, because a flex item's
     default min-width is auto, so the buttons refuse to shrink below their
     label and simply spill outside the pill and off-screen. (Three buttons
     already overflowed at 304px before this theme was added; the fourth is what
     made it visible.) Two columns give each button ~120px for ~100px of
     content, measured at both 375px and 390px. */
  const wrapper =
    variant === 'full'
      ? 'grid grid-cols-2 gap-1 rounded-2xl border border-border p-1'
      : 'inline-flex items-center gap-0.5 rounded-full border border-border p-0.5'

  const button =
    variant === 'full'
      ? 'flex min-w-0 items-center justify-center gap-2 rounded-xl px-3 py-2 font-mono text-sm tracking-wider uppercase transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg'
      : 'rounded-full p-1.5 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg'

  return (
    <div
      role="group"
      aria-label="Colour theme"
      className={`${wrapper} ${className}`.trim()}
    >
      <span role="status" aria-live="polite" className="sr-only">
        {announcement}
      </span>
      {themes.map(({ id, Icon, label }) => {
        const pressed = theme === id
        const isRandom = id === 'random'
        return (
          <button
            key={id}
            type="button"
            onClick={() => select(id)}
            aria-pressed={pressed}
            // The dice's action does not change once it is pressed: it always
            // rolls. So its name says that in every state.
            title={isRandom ? 'Roll a new palette' : `${label} theme`}
            // The pressed *visual* is driven from CSS off html[data-theme],
            // not from React state, so the active theme reads correctly on the
            // very first paint and with JS disabled. `.theme-btn-*` rules live
            // in globals.css. The pressed style inverts background and
            // foreground rather than changing hue, so it survives the loss of
            // yellow (WCAG 1.4.1).
            className={`${button} theme-btn-${id} text-muted hover:text-text`}
          >
            <Icon size={16} aria-hidden="true" />
            {variant === 'full' ? (
              <span>{label}</span>
            ) : (
              <span className="sr-only">
                {isRandom ? 'Roll a new palette' : label}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
