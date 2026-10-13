'use client'

import { useEffect, useState } from 'react'
import { Zap, Moon, Sun } from 'lucide-react'

export type Theme = 'funky' | 'dark' | 'light'

const themes = [
  { id: 'funky' as Theme, Icon: Zap, label: 'Funky' },
  { id: 'dark' as Theme, Icon: Moon, label: 'Dark' },
  { id: 'light' as Theme, Icon: Sun, label: 'Light' },
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
      setTheme(t === 'dark' || t === 'light' ? t : 'funky')
    }
    read()
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
    document.documentElement.setAttribute('data-theme', next)
    try {
      localStorage.setItem('ttt-theme', next)
    } catch {
      // localStorage throws outright in some privacy modes — the attribute is
      // already set, so the theme still applies for this session.
    }
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
        return (
          <button
            key={id}
            type="button"
            onClick={() => select(id)}
            aria-pressed={pressed}
            title={`${label} theme`}
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
              <span className="sr-only">{label}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
