# CLAUDE.md — ThinkTankTom Personal Website

## Project Overview

Build a minimalist personal website for **ThinkTankTom** — a blog, technical writing hub, and professional profile page. The aesthetic is inspired by [robbowen.digital](https://robbowen.digital/): bold typography, generous whitespace, confident minimalism, and a clear editorial voice.

The logo (`thinktanktom_logo.png`) is a **pixel-art retro computer** with a cityscape on screen — black background, white art. The entire site should feel like an extension of this logo: dark, sharp, retro-techy, with pixel-perfect intentionality.

Since **2026-10-16** the default theme is `dark-mono`, which takes that description literally: pure black ground, pure white ink, no hue anywhere. The electric-yellow `funky` palette that previously carried the brand look was removed the same day. **The site now ships no colour at all by default** — the only way a reader sees a hue is by pressing the dice and opting into a generated `random` palette. That is deliberate, not an oversight.

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

The site has **two themes**. `dark-mono` is the default and the brand look; `random` is generated at
runtime from a seed. The theme is an attribute on `<html>` — `data-theme="dark-mono" | "random"` —
and `:root` holds dark-mono, so an absent or unrecognised attribute renders dark-mono.

**Three themes have been removed, in two rounds.** `dark` (black-and-white) and `light`
(white-and-black) went on 2026-10-16. **`funky` — the electric-yellow `#e8ff00` palette that was the
default and the brand look until 2026-10-16 — went the same day**, when `dark-mono` took its place.
dark-mono *is* the old `dark` palette promoted to default: strictly achromatic (R=G=B everywhere),
accent at the pure endpoint `#ffffff`, `--text` just inside it at `#e0e0e0` so the accent reads by
luminance rather than hue.

Each removal took its token block, its `.only-*` and `.theme-btn-*` rules, its Shiki selectors and
its logo `<img>` variants with it. **No migration step was ever needed**, for any of the three: the
pre-paint script validates against `random` alone, so a stored `funky`, `dark` or `light` falls
through to dark-mono. That self-heal is *invisible in the rendering* — `html:not([data-theme='random'])`
matches a stale value too, so the page paints correctly either way — which is why
`scripts/e2e-palette.mjs` §5b asserts the **attribute**, not the pixels. Proven by negative control:
letting `funky` survive validation still paints `bg=0 0 0 accent=255 255 255`, and only the attribute
check catches it.

Three things survive the removals and are **not** leftovers — see the warnings below: `data-polarity`,
the `dark` / `light` keys in the Shiki config, and **funky's token values as a calibration fixture**.

`random` has **no token block in `globals.css`** and cannot have one: its nine values are generated
by `lib/palette` and written as **inline custom properties on `<html>`**, which beat any stylesheet
rule. Two consequences that are easy to get wrong:

- Switching *away* from random must **remove** those inline properties (`clearPalette()`), not just
  change the attribute. Leaving them pins dark-mono to the last random palette.
- Anything that needs to know which end a random palette sits at reads `data-polarity="dark" | "light"`,
  also published on `<html>`. CSS cannot branch on a generated colour, so this attribute is the only
  way to select on it — used by the Shiki mapping. **`data-polarity` is the generator's own notion of
  which end of the lightness range a palette landed on. It has nothing to do with the removed dark and
  light page themes and must not be cleaned up with them.**

Tokens are stored as **space-separated RGB channel triples, not hex**, so that Tailwind can map
them as `rgb(var(--token) / <alpha-value>)` and the opacity modifiers already in use
(`bg-accent/10`, `border-accent/40`, `bg-surface/60`) keep working. **Always wrap a token in
`rgb()` when using it directly in CSS** — a bare `var(--accent)` is `255 255 255`, not a colour, and
fails silently.

```css
:root {                        /* dark-mono — the default */
  --bg:         0 0 0;         /* #000000 pure black */
  --surface:    15 15 15;      /* #0f0f0f cards/sections */
  --border:     42 42 42;      /* #2a2a2a subtle dividers */
  --text:       224 224 224;   /* #e0e0e0 off-white body text */
  --muted:      138 138 138;   /* #8a8a8a secondary / metadata — AA on --bg */
  --accent:     255 255 255;   /* #ffffff pure white — 21:1 on --bg */
  --accent-dim: 189 189 189;   /* #bdbdbd hover state for accent */
  --grid-dot:   36 36 36;      /* #242424 hero pixel-grid texture */
  --success:    184 184 184;   /* #b8b8b8 "open" status */
}
```

That block is the only token block in `globals.css`. The three palettes that are **not** in the
stylesheet live on as fixtures in `lib/palette/__tests__/fixtures.ts` — `funky`, plus the two
achromatic-endpoint references. They are the calibration reference for the randomizer's gate table
(see below) and nothing renders them. Keep them there; do not restore any of them to the stylesheet.
`calibration.test.ts` asserts that no `html[data-theme='funky'|'dark'|'light']` block has reappeared,
and separately that no `.only-funky`, `.theme-btn-funky` or `--shiki-funky` **selector** survives.

**funky's fixture is the one you must not delete.** It is the sole evidence for the generator's
`CHROMA_CEIL` — its `#e8ff00` sat at the exact sRGB gamut edge for its hue (C/maxC = 1.00) — and its
accent measured 1.02:1 against its own text, which is why "the accent must not collapse into the
text" is a chroma floor rather than a contrast gate. Removing funky as a *theme* did not and must not
weaken that.

Every informational text pair clears WCAG AA (4.5:1). If you change a token, re-check it — `--muted`
on `--surface` is the tightest pair, now at **5.55:1** (it was 4.78:1 in funky, and that funky
measurement is what the generator's 4.5 floor was set from). Measured when dark-mono landed: every
informational pair got *stronger*, not weaker — `muted/bg` 5.01 → 6.08:1, `accent/bg` 17.66 → 21.00:1
(the sRGB maximum), `text/bg` 17.37 → 15.91:1. The two alpha composites the random theme is held to
also held without renumbering: `border-accent/40` 3.47 → 3.66:1 and `border-accent/30` 2.44 → 2.48:1,
because both hand-picked accents are near-maximum luminance on a near-black ground.

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

Two themes, selected by `data-theme` on `<html>`: `dark-mono` (default) | `random`. Persisted in
`localStorage` under the key `ttt-theme`. **`prefers-color-scheme` is deliberately never consulted**
— dark-mono is the brand default and the site ships no light counterpart, so the OS preference cannot express the
choice.

- **No-flash script** — a synchronous inline script, the first child of `<body>` in `layout.tsx`,
  reads the stored value, validates it, and sets the attribute before first paint. It must stay
  synchronous and must stay first; anything that defers it reintroduces a flash of dark-mono. The read
  is wrapped in `try`/`catch` so a `localStorage` throw in a privacy mode cannot kill the page.
  It writes only `data-theme`, an attribute React never renders, so there is no hydration mismatch
  and `suppressHydrationWarning` is correctly *not* needed. The validation is now a single test —
  `if(t!=='random')t='dark-mono'` — so a stale stored `funky`, `dark` or `light` self-heals to dark-mono.
- **`ThemeSwitcher.tsx`** — a 2-way segmented control (◐ Mono / 🎲 random), mounted in both the
  desktop nav and the mobile overlay. The dice is **last**, and both e2e harnesses reach it as
  `b[b.length - 1]` — do not reorder. The **pressed visual comes from CSS** keyed on
  `html[data-theme]`, not from React state, so the active theme reads correctly on first paint and
  with JS off; `aria-pressed` stays with React and a `MutationObserver` keeps the two mounted
  instances in step. Pressed inverts background and foreground rather than shifting hue, so it
  survives the loss of yellow (WCAG 1.4.1). Picking a theme in the overlay does **not** close it.
- **The dice has two actions, and which one it takes depends on whether random is already live.**
  Changed 2026-10-16; it used to always roll. The press that *enters* random **restores** the
  reader's stored seed, and every press after that **rolls** a new palette and overwrites what is
  stored. So a reader who picks a palette, detours to dark-mono and comes back gets their own palette
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
  **Accepted consequence:** no single press yields a *fresh* palette from dark-mono any more — you get
  your last one back, then press again. A reload and a first press now do the same thing, which is
  more coherent than the split it replaced.
- **Theme-visibility utilities** — `.only-dark-mono` / `.only-random` toggle `display` and are how
  `ThemedLogo` picks between its file and its masked span with no JavaScript. `.only-dark-mono` is
  written with a `:not()` so it also shows when the attribute is absent, matching what `:root`
  renders.

**Adding a third, named theme** touches: a token block, the `.only-*` group, the `.theme-btn-*`
rule and the Shiki selector set in `globals.css`; the validation in the `layout.tsx` script **and
its static `icons` metadata**; `ThemeSwitcher.tsx`; the `variants` arrays in `ThemedLogo.tsx`;
`DEFAULT_URL` in `lib/palette/favicon.ts`; and the `theme` object in `MDXContent.tsx`. It also needs
a matching logo asset set, and both e2e harnesses hard-code the expected default tokens and the
button order. Budget for that before promising one — the funky → dark-mono swap on 2026-10-16
touched **18 files and ~148 references**, and that was a *replacement*, not an addition.

Note the `:not()`: the rules that make dark-mono the default are written as
`html:not([data-theme='random'])`. **Every new theme has to be excluded there too**, or it will
reveal the dark-mono logo mark and light the Mono button alongside its own.

---

## Verifying this site

`npm test` (vitest, ~3s) covers the palette engine. Three things it cannot cover, because they need
a real browser, live in `scripts/` and run against a built export:

| command | what it proves |
|---|---|
| `node scripts/e2e-palette.mjs` | 48 checks: the switcher has exactly 2 buttons, the palette is actually painted, a reload restores it pre-paint, switching back to dark-mono *removes* the inline properties, the mark's ink follows `--accent`, a stale cache recovers from the seed with React state in step, and (§5b) **a stale stored `funky` self-heals to a PAINTED dark-mono** — the migration path every existing reader takes once, asserted on the attribute because the self-heal is invisible in the pixels. Also the dice's two-state action (§7b): entering random **restores** the stored seed *and* repaints the same `--bg`, the press after that rolls, and the button renames itself in all three states. **The empty-store roll has no check of its own on purpose** — section 2's press happens on cleared storage, so `dice applies a random palette` already *is* that assertion; breaking the empty-store path fails it (plus 8 downstream checks), which is what licensed dropping the duplicate. Negative-controlled the same way for the restore itself: with the old always-roll `select()` rebuilt from source, the restore check fails and the roll checks still pass. §9 covers the **themed favicon**: dark-mono serves the brand file, a roll repaints both `rel~="icon"` links as a tinted data URI with exactly one fill, that URI **decodes as a real image**, `apple-touch-icon` is untouched, dark-mono puts the file back, and a reload repaints from the applied accent. **§9b is the one that shipped broken** — the themed icon must survive a CLIENT-SIDE navigation. It is driven by clicking a real nav anchor, because `Page.navigate` is a full document load that re-runs the mount path and therefore *cannot* reproduce the bug; and its expected default is read out of `favicon.ts` rather than hard-coded, so it cannot drift when the default mark changes |
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
palettes — dark-mono (which ships), plus the former `funky` and `light` themes — and `lib/palette/__tests__` asserts
that **all three pass the same gate table the generator targets**. That test is the calibration: if
you change a gate and it fails, the gate is wrong, not the palette.

Only dark-mono still ships — it is the `dark` fixture, and the CSS cross-check in
`calibration.test.ts` is pointed at its `:root`. `funky` and `light` are kept as
`CALIBRATION_PALETTES` in `lib/palette/__tests__/fixtures.ts` because they are the **evidence**, not
history, and the set is deliberately *spanning* rather than "the shipped one plus two leftovers":

- `funky` is the **chromatic** extreme — accent at the exact sRGB gamut edge.
- `dark` (shipping as dark-mono) and `light` are the two **achromatic** endpoints (accent pure
  `#ffffff` / `#000000`, C = 0.000) that bound the neutral end of the range.

Running all three is what shows the gates are not merely tuned to whichever one happens to ship —
which is exactly why swapping the default from funky to dark-mono required **no gate change at all**.

Two findings from that measurement shaped the design and are easy to undo by accident. **Both come
from funky, which no longer ships — so both are now only as durable as that fixture.** If you delete
it, you delete the evidence for `CHROMA_CEIL` and for the chroma floor's existence, and nothing will
fail loudly to tell you:

- funky's `#e8ff00` sits at the **exact sRGB gamut edge** for its hue (C/maxC = 1.00). "As vivid as
  the gamut allows" is therefore the rule, and the gamut is the cap — don't add a saturation
  ceiling below `CHROMA_CEIL` (0.24, just above funky itself).
- funky's accent against its own `--text` measures **1.02:1**. It is distinct by *hue*, not luminance.
  So "the accent must not collapse into the text" is a **chroma floor** (`CHROMA_FLOOR`), and must
  never be rewritten as a contrast gate — as one it rejects funky outright.

Note the consequence for the **shipped** default: dark-mono is achromatic, so it *fails* the chroma
floor on purpose, and `calibration.test.ts` asserts that failure. That is not a contradiction. The
floor exists so a *generated* accent cannot land on a near-text grey; dark-mono solves the same
problem by taking the pure endpoint instead (21:1 against its own `--bg`). The floor is
generator-only and must stay that way.

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
contrast, and a generated accent has far less to spend than a hand-picked one: dark-mono puts the accent
at 21:1 against `--bg` (pure white, the sRGB maximum), so `border-accent/40` still clears the 3:1 UI floor at 3.66:1 —
as did funky at 17–21:1 (3.47:1) and the light reference's pure black. A generated
accent at the same 40% lands at **1.72:1** — under the floor on 78.7% of palettes. The accent-tinted chip was worse, because both sides move: `text-accent/80` on
`bg-accent/10` missed WCAG AA on 58.9% of palettes, at `text-xs`.

This cannot be fixed in the generator — it picks colours, and these are composites of one. So
`globals.css` overrides them for `random` only, with **measured** alphas:

| utility | random alpha | why |
|---|---|---|
| `border-accent/40` | `0.8` | a card/panel **boundary**, held to 3:1. Measured worst 3.26:1 over 20,000 seeds; 0.75 still failed 14 of them |
| `border-accent/30`, `border-success/40` | `0.6` | **decorative** chip outlines (every chip carries an icon *and* a label) and already under 3:1 in dark-mono itself, so not held to 3:1 — only to parity with dark-mono's 2.48:1 (funky's was 2.44:1) |
| `bg-accent/10` | → `rgb(var(--surface))` | drops the tint so the chip pair reduces to accent-on-surface, which **is** gated |
| `text-accent/80` | → solid `--accent` | same reason; makes the chip AA by construction rather than by luck |

Two traps here, both already paid for:

- **Key these on `[data-theme='random']` alone, never with `data-polarity`.** A
  `[data-theme='random'][data-polarity='light']` selector is (0,3,1) and outranks these (0,2,1)
  rules. That is how the bug originally landed: it silently reinstated the weaker light-*theme* alpha
  for every light-polarity palette — i.e. exactly the bug the rules exist to fix. The light theme's
  alpha nudges are gone now (they were keyed on the theme, so nothing could match them), but the
  specificity trap is unchanged and will bite the next rule written that way.
- **`border-border/40` is deliberately left alone** at ~1.11:1. It is a neutral decorative hairline
  that measures the same in dark-mono itself (1.11:1 — it was 1.09:1 in funky), and holding `random`
  to a bar the brand theme does not meet would be incoherent.

`accent/surface` is gated at **4.5**, not 4.2, and `ACCENT_STAGES` solves for it — because the accent
is rendered as small text directly on `--surface` (inline code, and the chips and doc-nav items the
random theme now routes onto an opaque surface), so AA applies to that pair too.

**Storage** (all under `try`/`catch` — `localStorage` throws outright in some privacy modes):

| key | value |
|---|---|
| `ttt-theme` | `dark-mono` | `random` (a stale `funky`/`dark`/`light` is rejected and renders dark-mono) |
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
a stale cache is then refused, costing one frame of dark-mono before `ThemeSwitcher` regenerates from the
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
  Shiki emits `--shiki-dark` / `--shiki-light` CSS variables and CSS picks the set: `vesper` (dark),
  `vitesse-light` (light). Highlighting is resolved at build time — the static export has no runtime
  to re-highlight, which is why it has to go through CSS variables, and why there is deliberately
  **no `random` key**: that palette does not exist at build time.
  **`dark` and `light` here are Shiki theme names, NOT page themes** — the site ships only dark-mono
  and random. The third key, `funky: 'one-dark-pro'`, was **dropped on 2026-10-16** with the funky
  theme, and `--shiki-funky` went with it: the default theme now takes the `--shiki-dark` (`vesper`)
  set, which is what `vesper` was picked for in the first place.
  Both remaining keys are load-bearing. `globals.css` maps
  `html[data-theme='random'][data-polarity='dark'|'light']` onto these two variable sets, which is
  how a random palette gets highlighted code at all. Removing either key leaves every random-theme
  reader with unstyled code blocks.
  **One subtlety created by dropping `funky`:** the default theme and a dark-polarity random palette
  now resolve to the *same* variable set, so the `[data-polarity='dark']` pair in `globals.css` is
  currently redundant. It is kept deliberately — delete it and "random + dark polarity" becomes
  silently coupled to whatever Shiki theme the default happens to use, with no rule anywhere saying
  so. The `[data-polarity='light']` pair is doing real work either way.
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
  Known limitation, **now the DEFAULT case rather than an edge case, as of 2026-10-16**: an accent
  close to neutral sets an annotated phrase apart mainly by its underline, so it reads much like an
  inline link. This used to apply only to an unlucky `random` palette, and the note here said it
  "used to be worse in the black-and-white `dark` and `light` themes, which no longer exist." That
  is no longer true in either half: dark-mono *is* black-and-white, its accent *is* pure white, and
  it is the default — so every annotated phrase now renders as white text with a solid underline.

  **Still not a styling bug, and still do not redesign it.** Two reasons it is tolerable: the phrase
  genuinely *is* a link now, so "looks like a link" is an ambiguous signal rather than a wrong one
  (it points at a note instead of off-site); and the superscript marker immediately after the phrase
  is what disambiguates, which is why the marker must keep its accent colour. If this ever does need
  solving, solve it on the marker or with a distinct underline style — not by tinting the phrase,
  which would break the `--accent` single-source rule below.
- **Use the `--accent` token**, not a hex copied out of a logo file. The logo assets do not agree
  with each other on their ink — they differ by a couple of percent, and from the token — so a hex
  lifted from whichever file you happened to open will be subtly wrong somewhere else. (This was
  first measured against funky's yellows; the `*_dark-mono.svg` set is `#FFFFFF`, which happens to
  match `--accent` exactly today. Do not rely on that — it is a coincidence of this palette, not a
  guarantee, and it is exactly the assumption that would break on the next theme.) The token is the
  single source of truth, and it keeps an annotated phrase matching its own superscript marker.
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

   - **`dark-mono`: a file.** The `public/ttt_*_dark-mono.svg` set, revealed by `.only-dark-mono`.
     **The reason this half is a file changed on 2026-10-16 and is now weaker — read this before
     trusting the old rule.** Under funky it was forced: funky's `ttt_logo_full.svg` carried
     **three inks** (#E1F708 computer, #F6F4F1 / #FFFFFF wordmark and tagline), so the single-ink
     mask path would have flattened all three — a visible regression on `/about`. The dark-mono
     marks are single-ink `#FFFFFF`, which is also exactly dark-mono's `--accent`, so **the mask
     path could now render the default theme correctly too.**
     It stays a file anyway, for two weaker but real reasons: these are the brand's own exports and
     are meant to be the marks the site serves rather than a stencil of a different export; and a
     file costs one cached request and no mask plumbing, while the masked span exists only because a
     *runtime-generated* palette has no file that could carry its fill — not a problem the default
     theme has. So **"do not unify the two paths" is now a preference, not an invariant.** If you do
     unify it, the thing to check is that `--accent` and the mark's ink stay identical: the moment
     the default accent stops being pure white, a masked default mark silently changes colour with it.
   - **`random`: CSS mask.** A runtime-generated palette has no file that could carry its fill, so
     this variant is an **empty `<span>`** painted `background-color: rgb(var(--accent))` and
     stencilled by a single-fill SVG: `.logo-mask` in `globals.css` holds the shared
     `mask-repeat/position/size` (autoprefixer adds the `-webkit-` pair), and only the per-role
     `mask-image` url is inline. The file contributes **nothing but its alpha**, so the screen
     cutout stays a hole and the ink comes from the token.

   So each role renders exactly **two** things now: one `<img>` and one masked `<span>`. The
   `dark`/`light` `<img>` variants were dropped with those themes on 2026-10-16, and the funky
   `<img>` variants with funky the same day.

   An inline `<svg>` with `fill="currentColor"` was built first and did the same job correctly, but
   it had to be rendered in **every** theme and merely hidden, because the theme is not known at
   build time — so its path data cost HTML bytes for every reader, including the ones who never pick
   `random`. Measured gzip: `/about` 26,665 bytes with the inline mark against **8,425** with the
   mask (7,742 before the feature), and `/` 12,038 against **7,839**. A mask also costs no request
   in the default theme, because a `display: none` element does not load its mask.

   **Never recolour or CSS-`filter` a file variant**, and never hue-shift one. A mask is not a
   recolour: nothing about the file's own colour is read. (This supersedes the former blanket "pick
   the asset, never recolour" rule, which a themeable palette cannot satisfy — the *reason* behind it
   survives, since the mask reuses an asset that already existed rather than adding another copy of
   the geometry to keep in sync.) The old "white on black — never invert it" rule still holds for
   `thinktanktom_logo.png` / `ttt_logo.png` — the raster with the black ground baked in, used only
   as the **OG/Twitter card image**. That is consumed outside the page by social scrapers, cannot be
   themed, and stays dark-ground. (This used to say "and the favicon", which was already wrong
   before the themed favicon landed: `layout.tsx` has pointed `icon`/`shortcut`/`apple-touch-icon`
   at an SVG, not the raster, for some time. Corrected 2026-10-16; it now points at
   `ttt_icon_dark-mono.svg`.)
   **A role's file variant and its mask asset must carry the same `viewBox`.** The path sequence
   is identical across them and sits in identical coordinates; only the fill differs, and the mask
   reads just the alpha. The screen is a transparent cutout in both — do not fill it. A white screen
   fill in the light-primary mark was tried and reverted: it read as a faint lighter rectangle
   against the scrolled nav's `bg-surface/90`. **This stays load-bearing after the theme removal,
   because the `*_light-primary.svg` files are now the masks.** Those exports originally shipped
   cropped tight to the ink (icon `22.68 89.48 578.24 465.37`, stacked `75.71 123.4 1768.61 858.81`)
   while the reference masters carry padding, so sizing each file by its own aspect drew the mark ~8%
   (icon) and ~26% (stacked) too large. Scaling each variant down by its ink/canvas fraction — the first attempt —
   equalised the ink but left the element boxes unequal, which reflowed any container without a
   reserved height (`/about` collapsed 45.83px and carried the page with it), and could not fix
   position regardless, because the reference padding is vertically **asymmetric** (icon top 89.45 vs
   bottom 68.95; stacked 123 vs 97). The viewBoxes are all normalised to one canvas per role
   (`0 0 623.62 623.62`, `0 0 1920 1080`, `0 0 1339.99 191.14`) and `ThemedLogo` holds **one**
   aspect per role, no per-variant scaling. Re-export an asset and re-read its `viewBox` against
   the canvases above before trusting it. **There is no automated guard on this any more** — it used
   to be `components/logo/extract-paths.mjs`, which went away with the inline-`<svg>` mark it
   generated, so this check is manual now.
   **Which `public/` asset each variant uses**, so the set can be checked at a glance rather than
   reconstructed from the component. Do not add an asset without a reference.

   | role | `dark-mono` `<img>` | `random` mask (alpha only) |
   |---|---|---|
   | icon | `ttt_icon_dark-mono.svg` | `ttt_icon_light-primary.svg` |
   | wordmark | `ttt_horizontal_dark-mono.svg` | `ttt_horizontal_light-primary.svg` |
   | full logo | `ttt_stacked-tagline_dark-mono.svg` | `ttt_stacked-tagline_light-primary.svg` |

   The three `*_dark-mono.svg` files were **restored to `public/` on 2026-10-16** from
   `8522281^` — the commit that had untracked them when the dark theme was removed. Restored from
   git rather than re-exported from `logo/dark-mono/` on purpose: those are the exact bytes that
   shipped and passed the logo checks, including the viewBox normalisation from `1757efa`. The
   `logo/dark-mono/` sources carry the same viewBoxes but different md5s and have never shipped.

   The `*_light-primary.svg` column is **shape-only** — nothing about these files' own colour is
   ever read. They are still referenced, so **do not delete them** as part of removing the light
   theme, and no fourth copy of the geometry was ever needed. Two consumers now, not one: the CSS
   mask reads the alpha, and `ttt_icon_light-primary.svg` is additionally **fetched and tinted into
   the themed favicon** (see below) — so that one file is no longer "never rendered as an image".

   Plus `ttt_logo.png` — the dark-ground raster for OG/Twitter cards, referenced from `layout.tsx`
   metadata and every route's `generateMetadata`.

   **Three funky assets are now unreferenced and still on disk**, as of 2026-10-16:
   `ttt_icon.svg`, `ttt_side_no_byline_logo.svg` and `ttt_logo_full.svg`. They were deliberately
   **not** deleted along with the funky theme, because they are reachable as URLs under the
   published export and removing them is a URL-breaking change that is Tom's call, not a cleanup.
   Nothing should start using them. If they do get deleted, note `ttt_logo_full.svg` is the only
   remaining three-ink mark in the repo, so it is also the only record of funky's exact logo inks.

   A warning drawn from this spot's own history: it previously claimed the `*_dark-mono.svg` files
   were "left on disk for separate untracking" when they had in fact already been **deleted** by
   `8522281`. **Verify the contents of `public/` before trusting any sentence in this section** —
   `ls public/` costs nothing and this paragraph has been wrong before.

   That table is the whole list. **Four assets were deleted on 2026-10-14** once nothing referenced
   them — `ttt_logo_side.svg`, `ttt_logo.svg`, `ttt_logo_notag.svg` and `ttt_logo_wordmark.svg`,
   40,933 bytes, with `ttt_logo.svg` a byte-identical duplicate of `ttt_icon.svg` (same md5). They
   were reachable as URLs under the published export, so that was a deliberate URL-breaking change
   rather than a cleanup oversight. Do not re-add them "for completeness".

8. **The browser-tab icon follows the palette** (`lib/palette/favicon.ts`, added 2026-10-16).
   Browser chrome renders the favicon *outside* the document, so it sees no CSS custom properties,
   `currentColor` is meaningless to it, and a static export has no server to render a per-palette
   file. The only route is to hand the `<link>` a self-contained icon with the colour already baked
   in and rebuild it on the client. Load-bearing details:

   - **It tints the existing mask asset; it does not carry its own geometry.** `paintFavicon`
     fetches `ttt_icon_light-primary.svg` once, memoises the source, and replaces **every** `fill`
     with the accent. Inlining the paths into the bundle instead would cost ~2.2KB to every reader
     including dark-mono-only ones — the same argument CLAUDE.md already makes for the mask over an
     inline `<svg>`. Verified: `grep` for the icon's path data finds it in **0** build chunks and
     First Load JS is unchanged at 87.4 kB.
   - **The fill is replaced, never substituted.** It never reads what colour the file carried, so
     the asset stays a stencil and re-exporting it in a different colour cannot silently change the
     favicon. §9 asserts the generated icon has exactly **one** distinct fill, so an asset that
     gains a second ink fails loudly rather than being quietly flattened.
   - **`encodeURIComponent` on the data URI is not optional.** The tinted SVG contains a `#` in
     every fill; unencoded, the URI truncates at the fragment and the tab goes silently blank.
     Negative-controlled: dropping the encoding still passes the "is a data URI" and "one fill"
     checks and fails only the decode check — which is why §9 loads the URI into an `Image()` and
     asserts non-zero intrinsic dimensions.
   - **`link[rel~="icon"]` deliberately spares `apple-touch-icon`.** The `~=` match covers both
     `rel="icon"` and `rel="shortcut icon"`; the Apple icon is an iOS home-screen bookmark captured
     when the bookmark is made, so repainting it achieves nothing.
   - **Two call sites, and the second is a `usePathname()` effect, not a mount effect.**
     `applySeed()` covers every roll, restore and stale-cache recovery, and the dark-mono branch of
     `select()` calls `resetFavicon()` (there is no stylesheet under the icon to fall back to, so it
     must be put back explicitly, not merely un-set).

     Everything else is one effect keyed on `usePathname()`, which repaints whenever random is live.
     It covers two cases that are really the same problem — **something other than this component
     owns the `<link>` and keeps restoring the static default**:
     - **on load**, because the pre-paint script restores a cached palette without running the
       engine, so nothing has painted the icon yet;
     - **on every client-side navigation**, because Next resolves route metadata and reconciles
       `<head>`, re-creating the `<link>` from the static value in `layout.tsx`.

     **The navigation case shipped broken (fixed 2026-10-16)** — the tab silently reverted to the
     default mark while the page was still in a random palette. The reason a mount effect could not
     catch it is the load-bearing part: `ThemeSwitcher` is rendered by the root layout's `<Nav>`, so
     it **never remounts on a route change** and a `[]` effect runs exactly once in the life of the
     tab. Anything that needs to survive navigation has to key off the route.
     Folding the load case into the same effect is what let the old `recovered` guard go — one
     favicon path instead of two, and double-painting would be harmless anyway since the fetch is
     memoised and the write is idempotent.
   - **Deliberately async and fire-and-forget**, and deliberately *not* in the pre-paint script: a
     tab icon is not a layout element, so arriving a few hundred ms late costs nothing visible,
     whereas a `fetch` before first paint would be blocking work for no benefit.
   - **What is not proven:** whether the browser repaints the tab strip. That is chrome, not DOM,
     and headless CDP cannot read it. The decode check is the strongest available proxy and covers
     the failure mode that would actually matter.

9. Test mobile layout at 375px and 390px widths. Use
   `Emulation.setDeviceMetricsOverride` over CDP, **not** `--window-size`: headless chromium
   reported a 500px CSS viewport for both 375 and 390, so a `--window-size` check silently tests
   neither width. `node scripts/e2e-palette-mobile.mjs` does this and asserts the emulated width
   actually applied before trusting any other number.
10. Run `next build` and fix all TypeScript errors before considering the site done

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
