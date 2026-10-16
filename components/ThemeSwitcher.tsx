'use client'

import { useEffect, useState } from 'react'
import { Zap, Dices } from 'lucide-react'
import { generate } from '@lib/palette/generate'
import {
  THEME_KEY,
  applyPalette,
  clearPalette,
  persistPalette,
  randomSeed,
  readSeed,
} from '@lib/palette/apply'


export type Theme = 'funky' | 'random'

/* Two themes: funky, the brand default held by :root, and random, generated at
   runtime from a seed. The dice is LAST on purpose -- both e2e harnesses reach
   it as b[b.length - 1]. */
const themes = [
  { id: 'funky' as Theme, Icon: Zap, label: 'Funky' },
  { id: 'random' as Theme, Icon: Dices, label: 'Random' },
]

type ThemeSwitcherProps = {
  variant?: 'compact' | 'full'
  className?: string
}

/* Resolve a seed and put the result on the page, applied and persisted in one
   step. Both callers below need exactly this -- the stale-cache recovery in the
   effect and the dice in select() -- and they only differ in how they choose
   the seed. Keeping it one function is not just deduplication: applying without
   persisting would paint a palette the next load cannot restore, which is the
   bug this whole feature exists to prevent. */
function applySeed(seed: number) {
  const palette = generate(seed)
  applyPalette(palette.tokens, palette.polarity)
  persistPalette(palette)
  return palette
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
  /* Whether the NEXT dice press will restore rather than roll, used only to
     name the button. Starts false so the server render and the first client
     render agree; the effect below corrects it. `select()` deliberately does
     not consult this -- it re-reads the DOM and storage itself, because a
     stale boolean choosing between restore and roll would be a real bug,
     where a stale tooltip is cosmetic. */
  const [diceRestores, setDiceRestores] = useState(false)

  useEffect(() => {
    const read = () => {
      const t = document.documentElement.dataset.theme
      // Anything that is not 'random' reads as funky, which mirrors both the
      // pre-paint script's validation and what :root actually renders.
      const isRandom = t === 'random'
      setTheme(isRandom ? 'random' : 'funky')
      // Mirrors select()'s own test exactly: restore only when random is not
      // live AND there is something stored to restore.
      setDiceRestores(!isRandom && readSeed() !== null)
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
        applySeed(readSeed() ?? randomSeed())
        document.documentElement.setAttribute('data-theme', 'random')
        // Sync React too. read() above already ran and saw the pre-paint
        // script's funky fallback, and the MutationObserver is not attached
        // until below, so without this the DOM says random while state says
        // funky: aria-pressed lands on the wrong button (contradicting the CSS
        // pressed visual), the dice announces "Random theme" instead of
        // "Re-roll", and the next press restores the stored seed instead of
        // re-rolling.
        setTheme('random')
        /* Same reason, and it is not theoretical: read() above saw funky WITH a
           stored seed, so it set this true, and no mutation record ever arrives
           to correct it. The dice then advertised "Restore your last palette"
           on a page that had just recovered INTO random, where the next press
           rolls. Caught by e2e-palette.mjs's 'recovery relabels the dice as a
           re-roll' check. It was only ever the label that was wrong -- select()
           re-reads the DOM rather than trusting this flag, which is why the
           press itself still rolled correctly. */
        setDiceRestores(false)
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
      /* The dice RESTORES on the way in and ROLLS once random is already live.
         So a reader who picked a palette, wandered off to funky and came back
         gets their palette back rather than a stranger's; pressing again from
         there rolls, and every roll overwrites what is stored.

         Liveness is read from the DOM attribute, never from the `theme` state
         above: that state starts null and is only filled in by an effect, so a
         press that lands before it resolves would restore where it should roll.
         The attribute is the single source of truth everywhere else in this
         file (the MutationObserver follows it, the pressed visual is CSS keyed
         on it), and this is no exception.

         A first-ever visitor has no stored seed, so readSeed() is null and the
         ?? falls through to a roll — the empty-storage case needs no branch of
         its own. The consequence accepted deliberately: there is no longer any
         single press that yields a FRESH palette from funky. You get your old
         one back, then press again. A reload and a first press now do the same
         thing, which is the more coherent model than the split that was here
         before. */
      const live = document.documentElement.dataset.theme === 'random'
      const restored = live ? null : readSeed()
      const palette = applySeed(restored ?? randomSeed())
      /* Re-rolling does not move aria-pressed, so this live region is the only
         feedback a screen-reader user gets. It has to distinguish the two
         actions: "applied" for a palette they have never seen and "restored"
         for the one they left, or the announcement is indistinguishable from a
         roll that happened to be ignored. */
      setAnnouncement(
        restored === null
          ? `${palette.polarity} palette applied, seed ${palette.seed}`
          : `${palette.polarity} palette restored, seed ${palette.seed}`,
      )
    } else {
      // Inline custom properties beat the stylesheet, so funky cannot take
      // effect until the random palette's properties are removed.
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

  /* The full variant is a GRID, not a flex row, and that stays a measured
     constraint rather than a preference. It is used once -- in the mobile
     overlay, inside a w-64 (256px) box. With two themes grid-cols-2 is a single
     row of two: measured at 121x36px per button, 254px of content inside the
     256px box, with no label clipped and no text wrap, at both 375px and 390px
     (node scripts/e2e-palette-mobile.mjs, which prints buttonBoxes every run --
     re-read it there rather than trusting this comment).

     Why a grid and not a row, kept because the reason outlived the bug: a flex
     item's default min-width is auto, so these labelled buttons will not shrink
     below their own label -- flex-1 does not rescue them -- and instead of
     compressing they spill outside the pill and off-screen. That is how it
     actually failed when there were four of them (417px of content in the 256px
     box; three already overflowed at 304px and merely hid behind the rounded
     border). The grid assigns each cell a width instead of asking the content to
     yield, so it cannot fail that way whatever the button count. */
  const wrapper =
    variant === 'full'
      ? 'grid grid-cols-2 gap-1 rounded-2xl border border-border p-1'
      : 'inline-flex items-center gap-0.5 rounded-full border border-border p-0.5'

  const button =
    variant === 'full'
      ? 'flex min-w-0 items-center justify-center gap-2 rounded-xl px-3 py-2 font-mono text-sm tracking-wider uppercase transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg'
      : 'rounded-full p-1.5 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg'

  /* The dice's action is state-dependent -- it restores on the way in and rolls
     once random is live -- so its name has to say which one it will do. Named
     once here because the title and the compact variant's sr-only text must not
     be able to disagree about what the button does.

     `diceRestores` is React state, so this is one frame behind on first paint;
     that is acceptable for a name (there is no click handler before hydration
     either) and it costs no hydration mismatch, because the server and the
     first client render agree on false. */
  const diceName = diceRestores
    ? 'Restore your last palette'
    : 'Roll a new palette'

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
            title={isRandom ? diceName : `${label} theme`}
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
              <span className="sr-only">{isRandom ? diceName : label}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
