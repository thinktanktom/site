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
      // Pressing 🎲 while random is already active re-rolls. Otherwise restore
      // the palette the reader last had, so returning to random is not a
      // surprise — only an explicit re-roll changes it.
      const seed =
        theme === 'random' ? randomSeed() : (readSeed() ?? randomSeed())
      const palette = generate(seed)
      applyPalette(palette.tokens, palette.polarity)
      persistPalette(palette)
    } else {
      // Inline custom properties beat the stylesheet, so a named theme cannot
      // take effect until the random palette's properties are removed.
      clearPalette()
      try {
        localStorage.setItem(THEME_KEY, next)
      } catch {
        // the attribute below still applies the theme for this session
      }
    }

    document.documentElement.setAttribute('data-theme', next)
    setTheme(next)
  }

  const wrapper =
    variant === 'full'
      ? 'flex items-stretch gap-0.5 rounded-full border border-border p-0.5'
      : 'inline-flex items-center gap-0.5 rounded-full border border-border p-0.5'

  const button =
    variant === 'full'
      ? 'flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-2 font-mono text-sm tracking-wider uppercase transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg'
      : 'rounded-full p-1.5 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg'

  return (
    <div
      role="group"
      aria-label="Colour theme"
      className={`${wrapper} ${className}`.trim()}
    >
      {themes.map(({ id, Icon, label }) => {
        const pressed = theme === id
        const isRandom = id === 'random'
        return (
          <button
            key={id}
            type="button"
            onClick={() => select(id)}
            aria-pressed={pressed}
            // The dice is the one control whose action changes while pressed,
            // so say so rather than leaving the label stale.
            title={
              isRandom && pressed ? 'Roll a new palette' : `${label} theme`
            }
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
              <span>{isRandom && pressed ? 'Re-roll' : label}</span>
            ) : (
              <span className="sr-only">
                {isRandom && pressed ? 'Roll a new palette' : label}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
