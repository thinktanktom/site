# CLAUDE.md — ThinkTankTom Personal Website

## Project Overview

Build a minimalist personal website for **ThinkTankTom** — a blog, technical writing hub, and professional profile page. The aesthetic is inspired by [robbowen.digital](https://robbowen.digital/): bold typography, generous whitespace, confident minimalism, and a clear editorial voice.

The logo (`thinktanktom_logo.png`) is a **pixel-art retro computer** with a cityscape on screen — black background, white art. The entire site should feel like an extension of this logo: dark, sharp, retro-techy, with pixel-perfect intentionality.

---

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS + CSS custom properties for theming
- **Content**: MDX files for blog posts and technical writing (stored in `/content/`)
- **Fonts**: Load via `next/font` from Google Fonts
  - Display / headings: `"Space Mono"` (monospaced, retro-pixel feel that echoes the logo)
  - Body: `"DM Sans"` (clean, readable, modern contrast to the mono headings)
- **Deployment**: Vercel (add `vercel.json` if needed)
- **No database** — all content is file-based MDX

---

## Design System

### Color Palette

The site has **two themes**. `funky` is the default and the brand look; `random` is generated at
runtime from a seed. The theme is an attribute on `<html>` — `data-theme="funky" | "random"` — and
`:root` holds funky, so an absent or unrecognised attribute renders funky.

The `dark` (black-and-white) and `light` (white-and-black) themes were **removed on 2026-10-16**,
along with their token blocks, their `.only-*` and `.theme-btn-*` rules, their Shiki selectors, their
light-only accent-alpha nudges and their logo `<img>` variants. A reader whose stored `ttt-theme` is
still `dark` or `light` falls through to funky, so no migration step was needed. Two things survive
the removal and are **not** leftovers — see the warnings below: `data-polarity`, and the `dark` /
`light` keys in the Shiki config.

`random` has **no token block in `globals.css`** and cannot have one: its nine values are generated
by `lib/palette` and written as **inline custom properties on `<html>`**, which beat any stylesheet
rule. Two consequences that are easy to get wrong:

- Switching *away* from random must **remove** those inline properties (`clearPalette()`), not just
  change the attribute. Leaving them pins funky to the last random palette.
- Anything that needs to know which end a random palette sits at reads `data-polarity="dark" | "light"`,
  also published on `<html>`. CSS cannot branch on a generated colour, so this attribute is the only
  way to select on it — used by the Shiki mapping. **`data-polarity` is the generator's own notion of
  which end of the lightness range a palette landed on. It has nothing to do with the removed dark and
  light page themes and must not be cleaned up with them.**

Tokens are stored as **space-separated RGB channel triples, not hex**, so that Tailwind can map
them as `rgb(var(--token) / <alpha-value>)` and the opacity modifiers already in use
(`bg-accent/10`, `border-accent/40`, `bg-surface/60`) keep working. **Always wrap a token in
`rgb()` when using it directly in CSS** — a bare `var(--accent)` is `232 255 0`, not a colour, and
fails silently.

```css
:root {                        /* funky — the default */
  --bg:         10 10 10;      /* #0a0a0a near-black */
  --surface:    17 17 17;      /* #111111 cards/sections */
  --border:     34 34 34;      /* #222222 subtle dividers */
  --text:       240 240 240;   /* #f0f0f0 off-white body text */
  --muted:      128 128 128;   /* #808080 secondary / metadata — AA on --bg */
  --accent:     232 255 0;     /* #e8ff00 electric yellow */
  --accent-dim: 184 204 0;     /* #b8cc00 hover state for accent */
  --grid-dot:   30 30 30;      /* #1e1e1e hero pixel-grid texture */
  --success:    74 222 128;    /* #4ade80 "open" status */
}
```

That block is the only token block in `globals.css`. The two achromatic palettes that used to join
it — `dark` and `light`, strictly neutral (R=G=B everywhere), each taking the pure endpoint
(`#ffffff` / `#000000`) for its accent and sitting `--text` just inside it (`#e0e0e0` / `#1f1f1f`)
so the accent read by luminance rather than hue — live on **only** as fixtures in
`lib/palette/__tests__/fixtures.ts`. They are the calibration reference for the randomizer's gate
table (see below) and nothing renders them. Keep them there; do not restore them to the stylesheet.

Every informational text pair clears WCAG AA (4.5:1). If you change a token, re-check it — `--muted`
on `--surface` is the tightest pair at 4.78:1.

**Theming rules:**
- Never hardcode a colour. Every colour goes through a token, including new ones — a raw hex or a
  stock Tailwind colour (`green-400`) cannot follow the theme and will be wrong in random.
- Theme-dependent CSS selectors must be anchored at `html[data-theme=…]`. In particular
  `rehype-pretty-code` writes its *own* `data-theme` onto every `<pre>`, so an unanchored selector
  matches the wrong element.
- Prefer CSS over JavaScript for anything that varies by theme. The theme is applied before first
  paint by a synchronous inline script in `layout.tsx`; anything driven by React state instead
  will be wrong until hydration.

### Typography Scale

- Use `Space Mono` for all headings, the nav, code, and the site wordmark
- Use `DM Sans` for body copy, post excerpts, and UI labels
- Heading sizes: `4xl` → `6xl` for hero; `2xl`/`3xl` for section titles; `xl` for card titles
- Line-height on body: `1.75` for comfortable long-form reading
- Letter-spacing on headings and nav items: `0.05em` to `0.1em` (wide tracking = editorial feel)

### Motion Principles

- Page load: staggered fade-up on hero elements (150ms delays between items)
- Nav links: underline draw animation on hover (CSS `::after` pseudo-element, width 0 → 100%)
- Post cards: subtle `translateY(-4px)` + border-colour transition on hover
- Keep all transitions `200ms–350ms ease`; nothing jarring
- No scroll-triggered JS libraries — use CSS `@keyframes` and `animation-delay` only

### Layout

- Max content width: `780px` for article body, `1100px` for page chrome
- Mobile-first; single column on small screens
- Nav: sticky top bar, transparent → `--surface` blur backdrop on scroll
- Generous section padding: `py-24` to `py-32`

---

## Site Structure

```
/                   → Home / Hero
/writing            → Blog index (list of all MDX posts)
/writing/[slug]     → Individual post page
/about              → Short bio page
```

### File layout

```
thinktanktom/
├── CLAUDE.md
├── public/
│   ├── thinktanktom_logo.png   ← copy from project files
│   └── favicon.ico             ← derive from logo
├── content/
│   └── posts/
│       └── example-post.mdx    ← seed with one placeholder post
├── src/
│   └── app/
│       ├── layout.tsx           ← root layout, fonts, metadata
│       ├── page.tsx             ← Home
│       ├── writing/
│       │   ├── page.tsx         ← Blog index
│       │   └── [slug]/
│       │       └── page.tsx     ← Post page
│       ├── about/
│       │   └── page.tsx
│       └── globals.css          ← CSS variables + base resets
├── components/
│   ├── Nav.tsx
│   ├── Footer.tsx
│   ├── PostCard.tsx
│   ├── MDXContent.tsx
│   ├── ThemeSwitcher.tsx        ← 4-way theme control (client)
│   ├── ThemedLogo.tsx           ← per-theme logo marks (server, CSS-swapped)
│   └── logo/
│       ├── InlineMark.tsx       ← currentColor mark, for the random theme
│       ├── paths.ts             ← GENERATED geometry (extract-paths.mjs)
│       └── extract-paths.mjs    ← regenerates paths.ts from public/*.svg
├── lib/
│   ├── posts.ts                 ← MDX reading + frontmatter utils
│   └── palette/                 ← the seeded palette engine (no React, no DOM)
├── tailwind.config.ts
└── next.config.mjs
```

---

## Page Specifications

### `/` — Home

**Hero section** (full-viewport height, centered):
```
[Logo image — 96px]

Hi, I'm  ThinkTankTom.

I write about technology, software, and ideas
that are worth thinking about.

[Read my writing →]          [Hire me on Upwork ↗]
```
- "ThinkTankTom" should be in `--accent` yellow
- The two CTAs: primary button (solid `--accent` bg, black text) and ghost button (border `--accent`, `--accent` text)
- Tiny pixel-grid background texture behind the hero (CSS radial-gradient dot pattern, very subtle)

**"Latest writing" section** below the fold:
- Show the 3 most recent posts as cards
- Each card: post title, date, 1-line excerpt, tag chips
- A "View all writing →" link at the bottom

**"Find me" section** (minimal link list):
- GitHub → `https://github.com/YOUR_USERNAME`
- LinkedIn → `https://linkedin.com/in/YOUR_USERNAME`
- Upwork → `https://www.upwork.com/freelancers/YOUR_USERNAME`
- Each link: icon + label, opens in new tab, hover turns `--accent`

---

### `/writing` — Blog Index

- Page title: `"Writing."` (large, `Space Mono`, `--text`)
- Subtitle: `"Thoughts on tech, tools, and the craft of building things."`
- Full list of posts, sorted newest-first
- Each entry: title, date (`MMM YYYY`), short excerpt, tags
- Simple list layout — no grid; let the typography do the work
- Optional: tag filter buttons at the top

---

### `/writing/[slug]` — Post Page

- Render MDX with custom components:
  - `<h2>` / `<h3>`: `Space Mono`, accented left-border (`3px solid --accent`)
  - `<code>` inline: `--surface` bg, `--accent` text, monospace
  - `<pre><code>`: syntax-highlighted code block (use `rehype-pretty-code` with a dark theme)
  - `<a>`: `--accent` underline
  - `<blockquote>`: left-border `--accent`, italic, muted text
- Show: title, date, estimated read time, tags at the top
- "← Back to writing" link below the title
- No comments section; no like buttons — keep it clean

**MDX frontmatter schema:**
```yaml
---
title: "Post title here"
date: "2025-04-27"
excerpt: "One sentence that captures the post."
tags: ["tag1", "tag2"]
---
```

---

### `/about` — About Page

- Short first-person bio (2–3 paragraphs max)
- Profile section: logo image left, text right (stacked on mobile)
- Links to GitHub, LinkedIn, Upwork (same style as home)
- A small "Currently" section: what I'm working on / interested in

---

## Navigation

**Desktop nav** (sticky, top bar):
```
[TTT wordmark — 32px high]   Writing  Projects  Experience  Contributions  About   [⚡🎲]  [Hire me ↗]
```

**Mobile nav**: hamburger → full-screen overlay with large links, the Hire me pill, and the
theme control last.

The overlay's theme control (`ThemeSwitcher variant="full"`) is a **grid, not a flex row**, and that
is measured. It sits in a `w-64` (256px) box. With two themes `grid-cols-2` is one row of two,
measured at **121×36px per button, 254px of content in the 256px box**, no label clipped and no text
wrap, at both 375px and 390px.

Keep it a grid even though two buttons now fit either way: a flex item's default `min-width` is
`auto`, so these labelled buttons will not shrink below their own label — `flex-1` does not help —
and they spill outside the pill and off-screen instead of compressing. That is how it actually
failed with four buttons (417px of content in the 256px box; three already overflowed at 304px and
merely hid behind the rounded border). A grid assigns each cell a width rather than asking the
content to yield. Verify with `node scripts/e2e-palette-mobile.mjs` after a build — it prints
`buttonBoxes` every run, so re-read the numbers there rather than trusting this file.

- Active page: nav item gets `--accent` colour
- "Hire me" button: small pill button, `--accent` bg, `--bg` text — links to Upwork
- **The desktop cluster breaks at `lg`, not `md`** — this is deliberate and measured, not a typo.
  The wordmark (224px) plus five `tracking-widest uppercase` mono links plus the pill already
  measured 904px of `scrollWidth` against the 720px available at `md`; it overflowed and was
  merely hidden by `overflow-x: hidden` on `html, body`. Below `lg` the full-screen overlay
  carries both the navigation and the theme control.
- Gaps are measured, not guessed — **but measure them, do not trust this file.** The Hire me pill has
  since moved out of the desktop row, so the earlier `gap-4`/26px figures no longer describe it. See
  the comment in `Nav.tsx` for the current numbers, and re-measure in a real browser **with scrollbars
  visible** if you change the row: a past `lg` measurement was wrong precisely because it was taken
  with `--hide-scrollbars`.

---

## Theme switching

Two themes, selected by `data-theme` on `<html>`: `funky` (default) | `random`. Persisted in
`localStorage` under the key `ttt-theme`. **`prefers-color-scheme` is deliberately never consulted**
— funky is the brand default and is neither light nor dark, so the OS preference cannot express the
choice.

- **No-flash script** — a synchronous inline script, the first child of `<body>` in `layout.tsx`,
  reads the stored value, validates it, and sets the attribute before first paint. It must stay
  synchronous and must stay first; anything that defers it reintroduces a flash of funky. The read
  is wrapped in `try`/`catch` so a `localStorage` throw in a privacy mode cannot kill the page.
  It writes only `data-theme`, an attribute React never renders, so there is no hydration mismatch
  and `suppressHydrationWarning` is correctly *not* needed. The validation is now a single test —
  `if(t!=='random')t='funky'` — so a stale stored `dark`/`light` self-heals to funky.
- **`ThemeSwitcher.tsx`** — a 2-way segmented control (⚡ funky / 🎲 random), mounted in both the
  desktop nav and the mobile overlay. The dice is **last**, and both e2e harnesses reach it as
  `b[b.length - 1]` — do not reorder. The **pressed visual comes from CSS** keyed on
  `html[data-theme]`, not from React state, so the active theme reads correctly on first paint and
  with JS off; `aria-pressed` stays with React and a `MutationObserver` keeps the two mounted
  instances in step. Pressed inverts background and foreground rather than shifting hue, so it
  survives the loss of yellow (WCAG 1.4.1). Picking a theme in the overlay does **not** close it.
- **The dice has two actions, and which one it takes depends on whether random is already live.**
  Changed 2026-10-16; it used to always roll. The press that *enters* random **restores** the
  reader's stored seed, and every press after that **rolls** a new palette and overwrites what is
  stored. So a reader who picks a palette, detours to funky and comes back gets their own palette
  rather than a stranger's. Four things hold it up:
  - **Liveness is read from `document.documentElement.dataset.theme`, never from the `theme`
    state.** That state starts `null` and is only filled by an effect, so a press landing before it
    resolves would restore where it should roll. The attribute is already the single source of
    truth in that file.
  - **Restore re-runs `generate(seed)`; it does not paste the `ttt-palette` cache.** The seed is
    the documented source of truth and the cache is only the pre-paint shortcut. A side effect
    worth keeping: the e2e check compares the restored `--bg` against the one painted *before* the
    detour, so it also proves the engine still agrees with the cache.
  - **Empty storage needs no branch.** `readSeed()` returns `null` for a first-ever visitor and the
    `??` falls through to a roll.
  - **The button's name is state-dependent, and `diceRestores` is label-only.** `select()`
    deliberately re-reads the DOM and storage instead of consulting that flag — a stale boolean
    picking between restore and roll is a real bug, a stale tooltip is cosmetic. It must be synced
    by hand inside the stale-cache recovery block, because the `MutationObserver` is attached
    *after* it and no mutation record ever arrives; skipping that made the dice advertise
    "Restore your last palette" on a page that had just recovered **into** random. That is a
    live assertion, not a hypothetical.
  **Accepted consequence:** no single press yields a *fresh* palette from funky any more — you get
  your last one back, then press again. A reload and a first press now do the same thing, which is
  more coherent than the split it replaced.
- **Theme-visibility utilities** — `.only-funky` / `.only-random` toggle `display` and are how
  `ThemedLogo` picks between its file and its masked span with no JavaScript. `.only-funky` is
  written with a `:not()` so it also shows when the attribute is absent, matching what `:root`
  renders.

**Adding a third, named theme** touches: a token block, the `.only-*` group, the `.theme-btn-*`
rule and the Shiki selector set in `globals.css`; the validation in the `layout.tsx` script;
`ThemeSwitcher.tsx`; the `variants` arrays in `ThemedLogo.tsx`; and the `theme` object in
`MDXContent.tsx`. It also needs a matching logo asset set. Budget for that before promising one.

Note the `:not()`: the rules that make funky the default are written as
`html:not([data-theme='random'])`. **Every new theme has to be excluded there too**, or it will
reveal the funky logo mark and light the funky button alongside its own.

---

## Verifying this site

`npm test` (vitest, ~3s) covers the palette engine. Three things it cannot cover, because they need
a real browser, live in `scripts/` and run against a built export:

| command | what it proves |
|---|---|
| `node scripts/e2e-palette.mjs` | 35 checks: the switcher has exactly 2 buttons, the palette is actually painted, a reload restores it pre-paint, switching back to funky *removes* the inline properties, the mark's ink follows `--accent`, a stale cache recovers from the seed with React state in step. Also the dice's two-state action (§7b): entering random **restores** the stored seed *and* repaints the same `--bg`, the press after that rolls, and the button renames itself in all three states. **The empty-store roll has no check of its own on purpose** — section 2's press happens on cleared storage, so `dice applies a random palette` already *is* that assertion; breaking the empty-store path fails it (plus 8 downstream checks), which is what licensed dropping the duplicate. Negative-controlled the same way for the restore itself: with the old always-roll `select()` rebuilt from source, the restore check fails and the roll checks still pass |
| `node scripts/e2e-palette-mobile.mjs` | the overlay control fits at 375px and 390px, no horizontal overflow, picking a theme does not close the overlay |
| `node scripts/e2e-annotations.mjs` | 305 checks: every annotation round-trips to its note and back, both ends land **clear of the fixed nav** rather than under it, the phrase (not the superscript) is the hit target, the phrase survives into the accessible name with an additive `sr-only` cue and **no** `aria-label`, ids are unique and paired, no nested `<a>`. The `:target` highlight lands on the right note and no other, tints to `--surface`, measures ≥4.5:1, clears itself on the back-link, and does **not** reflow the note — a `border-left` in place of the inset shadow shifts the text 3px and fails here. Covers the MDX components on a post *and* the hand-rolled copy on `/about` |

Build first — they serve `out/`, not a dev server. Chromium comes from nixpkgs
(`nix run nixpkgs#chromium`); **Playwright's bundled Chromium cannot run on NixOS**. No script
installs anything; they drive CDP over Node's built-in `WebSocket`.

If you write another browser harness, six traps already paid for:

- Use an **absolute** static root. A relative `'out'` resolves against `process.cwd()`, so running
  from another directory serves 404s — and the browser renders the 404 body with the right URL and
  no `<nav>`, which looks exactly like a broken component. Log 404s loudly.
- **Allocate a free debug port.** Other Chromium instances on this machine squat fixed ports;
  attaching to a stranger's makes every selector return `null`. Assert `location.href` is your own
  URL before trusting anything.
- `nix run` makes Chromium a **grandchild** — launch `detached` and kill the process *group*, or it
  leaks and holds its port.
- **Poll, don't sleep.** `location.href` updates when a navigation commits, before the body parses.
- **Wait for a smooth scroll to settle before measuring.** `html` has `scroll-behavior: smooth`, so
  the scroll is still in flight when `.click()` returns and an immediate `getBoundingClientRect()`
  reads the *old* position — which passes for the wrong reason. `e2e-annotations.mjs` polls
  `window.scrollY` until it holds the same value across three consecutive samples.
- **Never fake a regression by mutating `out/*.html`.** React hydrates from the RSC flight payload
  inlined beside the markup and restores the correct DOM, so the mutation vanishes before any
  assertion runs and a broken check looks like a passing one. This cost two invalid negative
  controls. Mutate the **source** and rebuild.

---

## The palette randomizer (`lib/palette/`)

The `random` theme generates all nine tokens from a single 32-bit seed. The engine has **no React,
no DOM and no dependencies** — `lib/palette/apply.ts` is the only part that touches the document — so
it can be lifted into another project whole.

**Do not tune the numbers by taste.** Every target was calibrated by measuring three hand-designed
palettes — funky, plus the former `dark` and `light` themes — and `lib/palette/__tests__` asserts
that **all three pass the same gate table the generator targets**. That test is the calibration: if
you change a gate and it fails, the gate is wrong, not the palette.

Only funky still ships. `dark` and `light` are kept as `CALIBRATION_PALETTES` in
`lib/palette/__tests__/fixtures.ts` because they are the **evidence**, not history: they are the two
achromatic endpoints (accent pure `#ffffff` / `#000000`, C = 0.000) that bound the neutral end of
the range, and they are why the second finding below is a chroma floor. Running them is what shows
the gates are not merely tuned to funky. The CSS cross-check in `calibration.test.ts` is narrowed to
funky's `:root`, since they no longer have a stylesheet block to agree with.

Two findings from that measurement shaped the design and are easy to undo by accident:

- funky's `#e8ff00` sits at the **exact sRGB gamut edge** for its hue (C/maxC = 1.00). "As vivid as
  the gamut allows" is therefore the brand rule, and the gamut is the cap — don't add a saturation
  ceiling below `CHROMA_CEIL` (0.24, just above funky itself).
- funky's accent against its own `--text` measures **1.02:1**. It is distinct by *hue*, not luminance.
  So "the accent must not collapse into the text" is a **chroma floor** (`CHROMA_FLOOR`), and must
  never be rewritten as a contrast gate — as one it rejects the brand's own palette.

Other load-bearing choices:

- **OKLCH, not HSL.** Perceptually uniform, so one lightness ramp looks like the same ramp at every
  hue. Chroma is reduced along the hue ray to reach the gamut; clipping RGB channels shifts hue.
- **Contrast is solved, not sampled.** `solveL`/`solveNear` bisect to the target. A reject-and-retry
  loop can fail to terminate and biases the hue distribution toward whatever happens to pass.
- **`border` and `grid-dot` get contrast *windows*, not floors.** A floor alone lets a divider become
  a stripe and the hero dot texture become noise.
- **The accent search degrades in stages.** Vividness and contrast genuinely oppose in the corners of
  sRGB — a vivid *dark* cyan does not exist, so a cyan accent on a light page cannot have both. Stage
  2 still clears WCAG AA. ~95% of seeds never leave stage 1.
- **`success` keeps a fixed hue (152°)**, calibrated to funky's `#4ade80`. It carries meaning, not the
  key hue; "open to work" must not go red on a red seed.

**Opacity modifiers on the accent are NOT covered by the gate table, and need their own rule.**
The gates bound pairs of *solid* tokens. An alpha on the accent is only as strong as the accent's own
contrast, and a generated accent has far less to spend than a hand-picked one: funky puts the accent
at 17–21:1 against `--bg` (it is pure yellow), so `border-accent/40` still clears the 3:1 UI floor —
as did the two calibration palettes, whose accents were pure white and pure black. A generated
accent at the same 40% lands at **1.72:1** — under the floor on 78.7% of palettes. The accent-tinted chip was worse, because both sides move: `text-accent/80` on
`bg-accent/10` missed WCAG AA on 58.9% of palettes, at `text-xs`.

This cannot be fixed in the generator — it picks colours, and these are composites of one. So
`globals.css` overrides them for `random` only, with **measured** alphas:

| utility | random alpha | why |
|---|---|---|
| `border-accent/40` | `0.8` | a card/panel **boundary**, held to 3:1. Measured worst 3.26:1 over 20,000 seeds; 0.75 still failed 14 of them |
| `border-accent/30`, `border-success/40` | `0.6` | **decorative** chip outlines (every chip carries an icon *and* a label) and already under 3:1 in funky itself, so not held to 3:1 — only to parity with funky's 2.44:1 |
| `bg-accent/10` | → `rgb(var(--surface))` | drops the tint so the chip pair reduces to accent-on-surface, which **is** gated |
| `text-accent/80` | → solid `--accent` | same reason; makes the chip AA by construction rather than by luck |

Two traps here, both already paid for:

- **Key these on `[data-theme='random']` alone, never with `data-polarity`.** A
  `[data-theme='random'][data-polarity='light']` selector is (0,3,1) and outranks these (0,2,1)
  rules. That is how the bug originally landed: it silently reinstated the weaker light-*theme* alpha
  for every light-polarity palette — i.e. exactly the bug the rules exist to fix. The light theme's
  alpha nudges are gone now (they were keyed on the theme, so nothing could match them), but the
  specificity trap is unchanged and will bite the next rule written that way.
- **`border-border/40` is deliberately left alone** at ~1.09:1. It is a neutral decorative hairline
  that measures the same in funky, and holding `random` to a bar the brand theme does not meet would
  be incoherent.

`accent/surface` is gated at **4.5**, not 4.2, and `ACCENT_STAGES` solves for it — because the accent
is rendered as small text directly on `--surface` (inline code, and the chips and doc-nav items the
random theme now routes onto an opaque surface), so AA applies to that pair too.

**Storage** (all under `try`/`catch` — `localStorage` throws outright in some privacy modes):

| key | value |
|---|---|
| `ttt-theme` | `funky` | `random` (a stale `dark`/`light` is rejected and renders funky) |
| `ttt-seed` | the integer seed — the source of truth |
| `ttt-palette` | the nine resolved tokens, for the pre-paint script |
| `ttt-palette-v` | `ENGINE_VERSION`; a cache stamped otherwise is refused |

The pre-paint script **validates every cached value against an `"R G B"` pattern** before applying
any of it, and rejects the whole palette if one value fails. Checking only that the *keys* were
present was not enough: `setProperty` silently drops a value CSSOM refuses (anything with a
top-level `;`), which left some tokens unset while `data-theme` was still `random` — and because the
recovery path keys off `data-theme`, it could not see that state, so the broken palette survived
reloads. Reproduced in a browser as black text on a near-black background.

The pre-paint script **never runs the generator** — `generate()` costs ~1.5ms warm and the engine is
~3KB, neither of which belongs in blocking work before first paint. It pastes the cached tokens
instead. **Bump `ENGINE_VERSION` whenever a change would make a seed produce a different palette**;
a stale cache is then refused, costing one frame of funky before `ThemeSwitcher` regenerates from the
seed, rather than pinning readers to a palette the engine no longer produces.

**Known limitation, accepted:** code blocks cannot follow a random palette. `rehype-pretty-code`
resolves highlighting at build time and the static export has no runtime to re-highlight with, so a
random palette borrows the `--shiki-dark` or `--shiki-light` variable set by its `data-polarity`.
Fixing it properly means shipping a client-side highlighter. **This is the sole reason the `dark` and
`light` keys remain in the Shiki config** — they are Shiki theme names, not page themes. Delete
either and every random-theme reader gets unstyled code blocks.

---

## Footer

```
© 2025 ThinkTankTom          [GitHub]  [LinkedIn]  [Upwork]
```
- Minimal single-row (stacked on mobile)
- Use `Space Mono`, `--muted` colour
- Icons: use `lucide-react` (`Github`, `Linkedin`, `ExternalLink`)

---

## MDX Setup

Install and configure:
- `next-mdx-remote` or `@next/mdx` for rendering MDX
- `gray-matter` for parsing frontmatter
- `rehype-pretty-code` + `shiki` for code highlighting. Configured with an **object** `theme`, so
  Shiki emits `--shiki-funky` / `--shiki-dark` / `--shiki-light` CSS variables and CSS picks the
  set: `one-dark-pro` (funky), `vesper` (dark), `vitesse-light` (light). Highlighting is resolved
  at build time — the static export has no runtime to re-highlight, which is why it has to go
  through CSS variables, and why there is deliberately **no `random` key**: that palette does not
  exist at build time.
  **`dark` and `light` here are Shiki theme names, NOT page themes** — the site ships only funky
  and random. They stay because `globals.css` maps
  `html[data-theme='random'][data-polarity='dark'|'light']` onto those two variable sets, which is
  how a random palette gets highlighted code at all. Removing either key leaves every random-theme
  reader with unstyled code blocks.
- `remark-gfm` for GitHub Flavored Markdown (tables, strikethrough, etc.)
- `reading-time` for estimated read time

`lib/posts.ts` should export:
- `getAllPosts()` → sorted array of `{ slug, title, date, excerpt, tags, readTime }`
- `getPostBySlug(slug)` → `{ frontmatter, content }` for rendering

### Inline annotations (how Tom likes them)

Drafts arrive as plain text with annotations written inline as `(phrase)*(note text)` — the text
before the asterisk is the phrase to annotate, the text after it is the note. Convert each one to
the `Annotated` / `Notes` / `Note` components in `components/MDXContent.tsx`:

```mdx
The <Annotated n={1}>JavaScript, HTML and CSS boilerplate</Annotated> I once wrote by hand…

<Notes>

<Note n={1}>I used Flask and SSGs as well. They all equally strain my eyes</Note>

</Notes>
```

The styling is settled — **do not redesign it**:

- **The phrase is highlighted**: set in `--accent` with a **solid** underline. Since 2026-10-16 this
  is carried by **two real classes in `globals.css`, not Tailwind utilities** — `.annot` (accent,
  hover to `--accent-dim`, `scroll-margin-top`) on the wrapping `<a>`, and `.annot-phrase`
  (underline, 4px offset) on the phrase `<span>` inside it. Identical pixels to the former
  `text-accent underline underline-offset-4` span. They are classes because Next inlines the RSC
  flight payload beside the markup, so a utility string is emitted **four times per annotation** —
  measured at 536 raw / 79 gzip bytes per annotation against 323 / 60 for the class form, on an
  8-annotation post. Don't "modernise" them back into utilities. Never dotted or dashed: a
  perforated underline was explicitly rejected. Never bare/undecorated either — the accent
  highlight is the point.
  Known limitation, **downgraded on 2026-10-16**: a `random` palette whose accent comes out close
  to neutral sets an annotated phrase apart mainly by its underline, so it reads much like an
  inline link. Since the phrase *is* a link now, that is no longer a wrong signal, only an
  ambiguous one — it points at a note rather than off-site. Still not a styling bug; leave it
  alone. (This used to be worse in the black-and-white `dark` and `light` themes, which no longer
  exist.)
- **Use the `--accent` token**, not a hex copied out of a logo file. The funky logo assets do not
  agree with each other on the yellow — they differ by a couple of percent, and from the token — so a
  hex lifted from whichever file you happened to open will be subtly wrong somewhere else. The token
  is the single source of truth, and it keeps an annotated phrase matching its own superscript marker.
- **Marker**: a Unicode superscript (`¹²³⁴`) in `--accent` straight after the phrase, no space.
  **Amended 2026-10-16: the marker is now part of a link.** It used to be specified as "not a
  link"; Tom asked for click-to-note, so the phrase and the marker together are the anchor. The
  *appearance* the old rule protected is unchanged — the marker is still an unlinked-looking accent
  superscript with no underline of its own, because only the inner phrase span carries `underline`.
- **The jump is a two-way plain-HTML round trip**, added 2026-10-16. The phrase+marker is
  `<a id="ref-N" href="#note-N" class="annot">`; the note's `N.` is `<a href="#ref-N" class="annot">`
  and its `<p>` carries `id="note-N"` and `.annot-note`. No JavaScript, no history API, no scroll
  listener — it works in the static export and with JS off, at 323 raw / 60 gzip bytes per
  annotation (most of which is the ids, the hrefs and the screen-reader cue below) plus a one-off
  +347 raw / +83 gzip in the stylesheet. Four things hold it together:
  - **`scroll-margin-top: var(--anchor-offset)` on both ends**, where `--anchor-offset` is `6rem`,
    declared on the `html` rule in `globals.css`. The nav is `fixed` at `h-16` (4rem), so without a
    scroll margin the jump lands *under* the bar — the URL says you arrived and the target is
    hidden. 4rem of nav + 2rem of air. **If the nav height changes, this is the one number to
    change with it.** It is deliberately *not* in a second `:root` block: `:root` is `html` so it
    inherits identically, and both this file's convention and the CSS cross-check in
    `lib/palette/__tests__/calibration.test.ts` (which finds the palette by the **first** `:root {`
    in the file) treat the one `:root` block as the single palette token block.
  - **`html { scroll-behavior: smooth }`** in `globals.css` does the gliding. It has to be on the
    scrolling element; on the target it does nothing. The existing `prefers-reduced-motion` block
    already forces it back to `auto`, and Next's router suspends it for its own scroll-to-top, so
    route changes stay instant.
  - **No `aria-label` on the forward link. This is load-bearing, not an omission.** An `aria-label`
    *replaces* a link's text as its accessible name, and that text is a phrase in the middle of a
    sentence — so labelling it `"Jump to note 1"` **deletes the phrase from the paragraph** for
    anyone using a screen reader, leaving a hole in the prose. The cue is additive instead: a
    `<span class="sr-only"> (see note N)</span>` after the marker, the same pattern `/about`
    already uses for `"(opens in new tab)"`. The **back**-link does take an `aria-label`, because
    its text is a bare `"1."` which means nothing read aloud and there is no sentence to damage.
    `scripts/e2e-annotations.mjs` asserts both halves; the negative control is in its header.
  - **An `Annotated` phrase must never contain a markdown link.** The whole phrase is the hit
    target (deliberately — not the ~6px superscript), so a link inside it nests `<a>` in `<a>` and
    the parser drops the inner one. Annotate around a link, not over one.
  The only *new* pixel in the jump itself is the hover: `.annot:hover` goes to `--accent-dim`, the
  documented hover state for accent, purely as a click affordance.
- **`.annot-note:target` highlights the note you landed on.** With eight notes stacked a few pixels
  apart, arriving at the right scroll offset is not the same as knowing which line was the
  destination. Four things about it are deliberate:
  - **It persists; it does not flash.** That makes it self-clearing — taking the back-link moves
    `:target` to `#ref-N` and the note un-highlights on its own. An `@keyframes` flash would also
    fail to re-fire when the same marker is clicked twice, because `:target` never changes.
  - **The tint is `--surface`, never an accent alpha.** Note text is `--muted`, and
    `muted`/`surface` is a pair the generator *solves for* (`min: 4.5`, `lib/palette/validate.ts`),
    so the highlight is AA by construction in every palette including random — measured 4.78:1,
    matching the documented tightest informational pair. An accent-tinted background would be
    exactly the composite hazard the randomizer section warns about: both sides move and nothing
    in the gate table bounds the result.
  - **The accent is an `inset` box-shadow, not a `border-left`.** A real border changes layout; the
    padding and its compensating negative margin live on the *base* class so the strip is reserved
    at all times and highlighting cannot reflow the note. A `border-left` shifts the text 3px, and
    `e2e-annotations.mjs` fails on exactly that.
  - It echoes the `3px solid --accent` left border already used by `h2`, `h3` and `blockquote`, so
    it is not a new visual idea — and `/about` inherits it for free from the shared class.
  Deep-linking comes free: `/writing/some-post#note-3` arrives with note 3 already highlighted.
- **Notes block** at the foot of the post, matching the `/about` footnotes exactly: wrapper
  `pt-6 border-t border-border`, inner `font-mono text-xs leading-relaxed space-y-1`, each note an
  accent `N.` (now the back-link) followed by muted text. (`/about` hand-rolls the same markup
  inline, anchor round trip included — if the annotation style changes, change both. It was kept in
  sync on 2026-10-16.)
- Keep the note text as written in the draft; don't pad it out. A bare author credit or a one-line
  aside is the intended register.

---

## SEO & Meta

- `layout.tsx` root metadata: site name, description, OG image (use logo)
- Each post page: dynamic `generateMetadata()` using frontmatter title + excerpt
- Add `robots.txt` and `sitemap.xml` via Next.js route handlers
- `<link rel="canonical">` on all pages

---

## Placeholder Content

Seed the project with **one example post** at `content/posts/hello-world.mdx`:

```mdx
---
title: "Hello, World."
date: "2025-04-27"
excerpt: "Every site needs a first post. This is mine — a quick note on why I built this and what I plan to write about."
tags: ["meta", "writing"]
---

Every developer eventually builds their own website...

(continue with 3–4 short paragraphs)
```

---

## Implementation Notes for Claude Code

1. **Start with `npx create-next-app@latest thinktanktom --typescript --tailwind --app --src-dir`**
2. Copy `thinktanktom_logo.png` into `public/`
3. Configure `tailwind.config.ts` to extend theme with the custom colour palette above and the two font families
4. Build in this order: `globals.css` → `layout.tsx` → `Nav.tsx` → `Footer.tsx` → `lib/posts.ts` → home page → writing index → post page → about page
5. Do **not** use any UI component libraries (no shadcn, no MUI) — hand-craft all components for full aesthetic control
6. Keep `--accent` usage disciplined: CTAs, active states, code accents, heading decorations only. Not scattered everywhere.
7. **Logo marks follow the theme; the raster logo does not.** `components/ThemedLogo.tsx` runs a
   deliberate **dual path**, and both halves matter:

   - **`funky`: a file.** The existing `public/ttt_*.svg`, revealed by `.only-funky`. It stays a
     *file* on purpose, not out of inertia: funky's `ttt_logo_full.svg` is the one mark with
     **three inks** (#E1F708 computer, #F6F4F1 / #FFFFFF wordmark and tagline). Routing it through
     the single-ink mask path would flatten all three to one colour — a visible regression on
     `/about`. Do not "unify" the two paths.
   - **`random`: CSS mask.** A runtime-generated palette has no file that could carry its fill, so
     this variant is an **empty `<span>`** painted `background-color: rgb(var(--accent))` and
     stencilled by a single-fill SVG: `.logo-mask` in `globals.css` holds the shared
     `mask-repeat/position/size` (autoprefixer adds the `-webkit-` pair), and only the per-role
     `mask-image` url is inline. The file contributes **nothing but its alpha**, so the screen
     cutout stays a hole and the ink comes from the token.

   So each role renders exactly **two** things now: one `<img>` and one masked `<span>`. The
   `dark`/`light` `<img>` variants were dropped with those themes on 2026-10-16.

   An inline `<svg>` with `fill="currentColor"` was built first and did the same job correctly, but
   it had to be rendered in **every** theme and merely hidden, because the theme is not known at
   build time — so its path data cost HTML bytes for every reader, including the ones who never pick
   `random`. Measured gzip: `/about` 26,665 bytes with the inline mark against **8,425** with the
   mask (7,742 before the feature), and `/` 12,038 against **7,839**. A mask also costs no request
   in funky, because a `display: none` element does not load its mask.

   **Never recolour or CSS-`filter` a file variant**, and never hue-shift one. A mask is not a
   recolour: nothing about the file's own colour is read. (This supersedes the former blanket "pick
   the asset, never recolour" rule, which a themeable palette cannot satisfy — the *reason* behind it
   survives, since the mask reuses an asset that already existed rather than adding another copy of
   the geometry to keep in sync.) The old "white on black — never invert it" rule still holds for
   `thinktanktom_logo.png` / `ttt_logo.png` — the raster with the black ground baked in, used only
   as the OG/Twitter card image and the favicon. Those are consumed outside the page by social
   scrapers and browser chrome, cannot be themed, and stay dark-ground.
   **The funky file and the mask asset of a role must carry the same `viewBox`.** The path sequence
   is identical across them and sits in identical coordinates; only the fill differs, and the mask
   reads just the alpha. The screen is a transparent cutout in both — do not fill it. A white screen
   fill in the light-primary mark was tried and reverted: it read as a faint lighter rectangle
   against the scrolled nav's `bg-surface/90`. **This stays load-bearing after the theme removal,
   because the `*_light-primary.svg` files are now the masks.** Those exports originally shipped
   cropped tight to the ink (icon `22.68 89.48 578.24 465.37`, stacked `75.71 123.4 1768.61 858.81`)
   while funky's masters carry padding, so sizing each file by its own aspect drew the mark ~8%
   (icon) and ~26% (stacked) too large outside funky. Scaling each variant down by its ink/canvas fraction — the first attempt —
   equalised the ink but left the element boxes unequal, which reflowed any container without a
   reserved height (`/about` collapsed 45.83px and carried the page with it), and could not fix
   position regardless, because funky's padding is vertically **asymmetric** (icon top 89.45 vs
   bottom 68.95; stacked 123 vs 97). The viewBoxes are now normalised to funky's canvas
   (`0 0 623.62 623.62`, `0 0 1920 1080`, `0 0 1339.99 191.14`) and `ThemedLogo` holds **one**
   aspect per role, no per-variant scaling. Re-export an asset and re-read its `viewBox` against
   the funky master before trusting it.
   **Which `public/` asset each variant uses**, so the set can be checked at a glance rather than
   reconstructed from the component. Do not add an asset without a reference.

   | role | funky `<img>` | `random` mask (alpha only) |
   |---|---|---|
   | icon | `ttt_icon.svg` | `ttt_icon_light-primary.svg` |
   | wordmark | `ttt_side_no_byline_logo.svg` | `ttt_horizontal_light-primary.svg` |
   | full logo | `ttt_logo_full.svg` | `ttt_stacked-tagline_light-primary.svg` |

   The `*_light-primary.svg` column is **mask-only** now — those files are never rendered as
   images. They are still referenced, so **do not delete them** as part of removing the light theme;
   only their alpha is read, which is why no fourth copy of the geometry was ever needed.

   Plus `ttt_logo.png` — the dark-ground raster for OG/Twitter cards and the favicon, referenced
   from `layout.tsx` metadata and every route's `generateMetadata`.

   The three `*_dark-mono.svg` files became **unreferenced** when the dark theme was removed on
   2026-10-16 and are left on disk for separate untracking. Nothing should start using them.

   That table is the whole list. **Four assets were deleted on 2026-10-14** once nothing referenced
   them — `ttt_logo_side.svg`, `ttt_logo.svg`, `ttt_logo_notag.svg` and `ttt_logo_wordmark.svg`,
   40,933 bytes, with `ttt_logo.svg` a byte-identical duplicate of `ttt_icon.svg` (same md5). They
   were reachable as URLs under the published export, so that was a deliberate URL-breaking change
   rather than a cleanup oversight. Do not re-add them "for completeness".

8. Test mobile layout at 375px and 390px widths. Use
   `Emulation.setDeviceMetricsOverride` over CDP, **not** `--window-size`: headless chromium
   reported a 500px CSS viewport for both 375 and 390, so a `--window-size` check silently tests
   neither width. `node scripts/e2e-palette-mobile.mjs` does this and asserts the emulated width
   actually applied before trusting any other number.
9. Run `next build` and fix all TypeScript errors before considering the site done

---

## External Links to Wire Up

Replace placeholders before first deploy:

| Label    | URL |
|----------|-----|
| GitHub   | `https://github.com/YOUR_USERNAME` |
| LinkedIn | `https://linkedin.com/in/YOUR_USERNAME` |
| Upwork   | `https://www.upwork.com/freelancers/YOUR_USERNAME` |

---

## Definition of Done

- [ ] Home, `/writing`, `/writing/[slug]`, `/about` all render correctly
- [ ] At least one MDX post renders with syntax highlighting
- [ ] Nav is sticky and mobile hamburger menu works
- [ ] All three external links (GitHub, LinkedIn, Upwork) are present and open in new tab
- [ ] Logo displays correctly in nav and hero
- [ ] `next build` passes with zero errors
- [ ] Lighthouse performance score ≥ 90 on mobile
- [ ] No placeholder "Lorem ipsum" text left in the final build
