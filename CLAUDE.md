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

The site has **four themes**. `funky` is the default and the brand look; `dark` is black and
white; `light` is white and black; `random` is generated at runtime from a seed. The theme is an
attribute on `<html>` — `data-theme="funky" | "dark" | "light" | "random"` — and `:root` holds funky,
so an absent or unrecognised attribute renders funky.

`random` has **no token block in `globals.css`** and cannot have one: its nine values are generated
by `lib/palette` and written as **inline custom properties on `<html>`**, which beat any stylesheet
rule. Two consequences that are easy to get wrong:

- Switching *away* from random must **remove** those inline properties (`clearPalette()`), not just
  change the attribute. Leaving them pins funky/dark/light to the last random palette.
- Anything that needs to know which end a random palette sits at reads `data-polarity="dark" | "light"`,
  also published on `<html>`. CSS cannot branch on a generated colour, so this attribute is the only
  way to select on it — used by the Shiki mapping and the light accent-border nudges.

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

`dark` and `light` redefine all nine. Both are strictly neutral (R=G=B everywhere): with the
yellow gone, **the accent is carried by luminance instead of hue** — it takes the pure endpoint
(`#ffffff` in dark, `#000000` in light) while `--text` sits just inside it (`#e0e0e0` / `#1f1f1f`).
That is deliberate; do not "fix" text to pure white or black, or the accent stops reading as an
accent. See `src/app/globals.css` for the full blocks.

Every informational text pair clears WCAG AA (4.5:1) in all three themes. If you change a token,
re-check it — `--muted` on `--surface` is the tightest pair at 4.78:1 in funky.

**Theming rules:**
- Never hardcode a colour. Every colour goes through a token, including new ones — a raw hex or a
  stock Tailwind colour (`green-400`) cannot follow the theme and will be wrong in two of three.
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
[TTT wordmark — 32px high]   Writing  Projects  Experience  Contributions  About   [⚡☾☀]  [Hire me ↗]
```

**Mobile nav**: hamburger → full-screen overlay with large links, the Hire me pill, and the
theme control last.

The overlay's theme control (`ThemeSwitcher variant="full"`) is a **2×2 grid, not a row**, and that
is measured. It sits in a `w-64` (256px) box, and four labelled buttons in one flex row measure
417px of content; `flex-1` does not help, because a flex item's default `min-width` is `auto`, so the
buttons refuse to shrink below their label and spill outside the pill and off-screen. Three buttons
already overflowed at 304px, which merely hid behind the rounded border. Verify with
`node scripts/e2e-palette-mobile.mjs` after a build.

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

Three themes, selected by `data-theme` on `<html>`: `funky` (default) | `dark` | `light`.
Persisted in `localStorage` under the key `ttt-theme`. **`prefers-color-scheme` is deliberately
never consulted** — funky is the brand default and is neither light nor dark, so the OS preference
cannot express the choice.

- **No-flash script** — a synchronous inline script, the first child of `<body>` in `layout.tsx`,
  reads the stored value, validates it, and sets the attribute before first paint. It must stay
  synchronous and must stay first; anything that defers it reintroduces a flash of funky. The read
  is wrapped in `try`/`catch` so a `localStorage` throw in a privacy mode cannot kill the page.
  It writes only `data-theme`, an attribute React never renders, so there is no hydration mismatch
  and `suppressHydrationWarning` is correctly *not* needed.
- **`ThemeSwitcher.tsx`** — a 3-way segmented control (⚡ funky / ☾ dark / ☀ light), mounted in both
  the desktop nav and the mobile overlay. The **pressed visual comes from CSS** keyed on
  `html[data-theme]`, not from React state, so the active theme reads correctly on first paint and
  with JS off; `aria-pressed` stays with React and a `MutationObserver` keeps the two mounted
  instances in step. Pressed inverts background and foreground rather than shifting hue, so it
  survives the loss of yellow (WCAG 1.4.1). Picking a theme in the overlay does **not** close it.
- **Theme-visibility utilities** — `.only-funky` / `.only-dark` / `.only-light` toggle `display`
  and are how `ThemedLogo` picks its asset with no JavaScript. `.only-funky` is written with a
  `:not()` pair so it also shows when the attribute is absent, matching what `:root` renders.

**Adding a fifth, named theme** touches: the token block, the `.only-*` group, the `.theme-btn-*`
rule and the Shiki selector set in `globals.css`; the allow-list in the `layout.tsx` script;
`ThemeSwitcher.tsx`; the `variants` arrays in `ThemedLogo.tsx`; and the `theme` object in
`MDXContent.tsx`. It also needs a matching logo asset set. Budget for that before promising one.

Note the `:not()` chains: the rules that make funky the default are written as
`html:not([data-theme='dark']):not([data-theme='light']):not([data-theme='random'])`. **Every new
theme has to be excluded there too**, or it will reveal the funky logo mark and light the funky
button alongside its own.

---

## Verifying this site

`npm test` (vitest, ~3s) covers the palette engine. Three things it cannot cover, because they need
a real browser, live in `scripts/` and run against a built export:

| command | what it proves |
|---|---|
| `node scripts/e2e-palette.mjs` | 21 checks: the palette is actually painted, a reload restores it pre-paint, switching to a named theme *removes* the inline properties, the mark's ink follows `--accent`, a stale cache recovers from the seed with React state in step |
| `node scripts/e2e-palette-mobile.mjs` | the overlay control fits at 375px and 390px, no horizontal overflow, picking a theme does not close the overlay |

Build first — they serve `out/`, not a dev server. Chromium comes from nixpkgs
(`nix run nixpkgs#chromium`); **Playwright's bundled Chromium cannot run on NixOS**. Neither script
installs anything; they drive CDP over Node's built-in `WebSocket`.

If you write another browser harness, four traps already paid for:

- Use an **absolute** static root. A relative `'out'` resolves against `process.cwd()`, so running
  from another directory serves 404s — and the browser renders the 404 body with the right URL and
  no `<nav>`, which looks exactly like a broken component. Log 404s loudly.
- **Allocate a free debug port.** Other Chromium instances on this machine squat fixed ports;
  attaching to a stranger's makes every selector return `null`. Assert `location.href` is your own
  URL before trusting anything.
- `nix run` makes Chromium a **grandchild** — launch `detached` and kill the process *group*, or it
  leaks and holds its port.
- **Poll, don't sleep.** `location.href` updates when a navigation commits, before the body parses.

---

## The palette randomizer (`lib/palette/`)

The `random` theme generates all nine tokens from a single 32-bit seed. The engine has **no React,
no DOM and no dependencies** — `lib/palette/apply.ts` is the only part that touches the document — so
it can be lifted into another project whole.

**Do not tune the numbers by taste.** Every target was calibrated by measuring funky, dark and light,
and `lib/palette/__tests__` asserts that **all three shipping themes pass the same gate table the
generator targets**. That test is the calibration: if you change a gate and it fails, the gate is
wrong, not the theme. Two findings from that measurement shaped the design and are easy to undo by
accident:

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
contrast, and a generated accent has far less to spend than a hand-picked one: funky/dark/light put
the accent at 17–21:1 against `--bg` (pure yellow, white, black), so `border-accent/40` still clears
the 3:1 UI floor, while a generated accent at the same 40% lands at **1.72:1** — under the floor on
78.7% of palettes. The accent-tinted chip was worse, because both sides move: `text-accent/80` on
`bg-accent/10` missed WCAG AA on 58.9% of palettes, at `text-xs`.

This cannot be fixed in the generator — it picks colours, and these are composites of one. So
`globals.css` overrides them for `random` only, with **measured** alphas:

| utility | random alpha | why |
|---|---|---|
| `border-accent/40` | `0.8` | a card/panel **boundary**, held to 3:1. Measured worst 3.26:1 over 20,000 seeds; 0.75 still failed 14 of them |
| `border-accent/30`, `border-success/40` | `0.6` | **decorative** chip outlines (every chip carries an icon *and* a label) and already 2.37–3.36 in the shipping themes, so not held to 3:1 — only to parity with funky's 2.44:1 |
| `bg-accent/10` | → `rgb(var(--surface))` | drops the tint so the chip pair reduces to accent-on-surface, which **is** gated |
| `text-accent/80` | → solid `--accent` | same reason; makes the chip AA by construction rather than by luck |

Two traps here, both already paid for:

- **Key these on `[data-theme='random']` alone, never with `data-polarity`.** A
  `[data-theme='random'][data-polarity='light']` selector is (0,3,1) and outranks these (0,2,1)
  rules, silently reinstating the weaker light-theme alpha for every light palette — i.e. exactly the
  bug the rules exist to fix.
- **`border-border/40` is deliberately left alone** at ~1.09:1. It is a neutral decorative hairline
  that measures the same in funky, and holding `random` to a bar the brand theme does not meet would
  be incoherent.

`accent/surface` is gated at **4.5**, not 4.2, and `ACCENT_STAGES` solves for it — because the accent
is rendered as small text directly on `--surface` (inline code, and the chips and doc-nav items the
random theme now routes onto an opaque surface), so AA applies to that pair too.

**Storage** (all under `try`/`catch` — `localStorage` throws outright in some privacy modes):

| key | value |
|---|---|
| `ttt-theme` | `funky` | `dark` | `light` | `random` |
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
random palette borrows the dark or light Shiki set by its `data-polarity`. Fixing it properly means
shipping a client-side highlighter.

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
- `rehype-pretty-code` + `shiki` for code highlighting. Configured with an **object** `theme`
  keyed by theme name, so Shiki emits `--shiki-funky` / `--shiki-dark` / `--shiki-light` CSS
  variables and the page theme picks the set: `one-dark-pro` (funky), `vesper` (dark),
  `vitesse-light` (light). Highlighting is resolved at build time — the static export has no
  runtime to re-highlight, which is why it has to go through CSS variables. There is deliberately
  **no `random` key**: that palette does not exist at build time, so it borrows the dark or light
  set by `data-polarity` in `globals.css` instead.
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

- **The phrase is highlighted**: set in `--accent` with a **solid** underline —
  `text-accent underline underline-offset-4`. Never dotted or dashed: a perforated underline was
  explicitly rejected. Never bare/undecorated either — the accent highlight is the point.
  Known limitation, accepted: in `dark` and `light` the accent is white/black rather than a hue,
  so an annotated phrase is set apart mainly by its underline and reads much like an inline link.
  That is inherent to a black-and-white theme, not a styling bug — leave it alone.
- **Use the `--accent` token**, not a hex copied out of a logo file. The logo SVGs are inconsistent
  (`#D9DB00` in `ttt_icon.svg`/`ttt_logo.svg`/`ttt_logo_wordmark.svg`, `#E1F708` in
  `ttt_logo_full.svg`/`ttt_logo_notag.svg`) and the token `#e8ff00` is the same green within a
  couple of percent. It also keeps the phrase matching its own superscript marker.
- **Marker**: a Unicode superscript (`¹²³⁴`) in `--accent` straight after the phrase, no space, not
  a link.
- **Notes block** at the foot of the post, matching the `/about` footnotes exactly: wrapper
  `pt-6 border-t border-border`, inner `font-mono text-xs leading-relaxed space-y-1`, each note an
  accent `N.` followed by muted text. (`/about` hand-rolls the same markup inline — if the
  annotation style changes, change both.)
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

   - **`funky` / `dark` / `light`: asset swap.** Per-theme files — the existing `public/ttt_*.svg`
     for funky, `ttt_*_dark-mono.svg` (white) for dark, `ttt_*_light-primary.svg` (near-black) for
     light — all rendered, with CSS revealing exactly one. These stay as *files* on purpose, not out
     of inertia: funky's `ttt_logo_full.svg` is the one mark with **three inks** (#E1F708 computer,
     #F6F4F1 / #FFFFFF wordmark and tagline). Routing it through the single-ink inline path would
     flatten all three to one colour — a visible regression on `/about`. Do not "unify" the variants.
   - **`random`: inline SVG.** A runtime-generated palette has no file that could carry its fill, so
     this variant inlines the geometry with `fill="currentColor"` and points `currentColor` at the
     `--accent` token via `text-accent`. Geometry lives in `components/logo/paths.ts`, which is
     **generated** — run `node components/logo/extract-paths.mjs`, never hand-edit it.

   **The inline mark costs HTML bytes on every page, in every theme.** It is always rendered and
   merely hidden by CSS, because the theme is not known at build time. Measured gzip, against the
   pre-feature build: `/` 7,212 → 12,038 bytes (the wordmark twice plus the icon twice) and
   `/about` 7,742 → 26,665 bytes, of which roughly 14KB is the 40-path stacked mark alone. Keep the
   geometry out of the CLIENT bundle (see the note in `Nav.tsx` — a client component importing a
   logo drags `paths.ts` into every page's JavaScript), but the HTML cost is inherent to this design.
   If `/about` needs that back, the alternative worth trying is `mask-image: url(<the mono svg>)`
   with `background-color: rgb(var(--accent))`: the marks are single-ink, so the file works directly
   as an alpha mask, the transparent screen stays transparent because it has no path, and nothing is
   inlined or filtered. That was not done here only because the inline path was already built and
   verified.

   **Never recolour or CSS-filter a file variant** to fake the inline behaviour: `currentColor` on
   inline paths is the only sanctioned mechanism. (This supersedes the former blanket "pick the asset,
   never recolour" rule, which a themeable palette cannot satisfy — the *reason* behind it survives and
   gets stricter, since there is now one generated geometry per role instead of three files that could
   drift apart.) The old "white on black — never invert it" rule still holds for
   `thinktanktom_logo.png` / `ttt_logo.png` — the raster with the black ground baked in, used only
   as the OG/Twitter card image and the favicon. Those are consumed outside the page by social
   scrapers and browser chrome, cannot be themed, and stay dark-ground.
   **All three variants of a role must carry the same `viewBox`.** The path sequence is identical
   across the three files and sits in identical coordinates; only the fill differs. The screen is a
   transparent cutout in all three — do not fill it. A white screen fill in the light mark was
   tried and reverted: it read as a faint lighter rectangle against the scrolled nav's
   `bg-surface/90`. The dark/light exports originally shipped cropped tight to the ink (icon
   `22.68 89.48 578.24 465.37`, stacked `75.71 123.4 1768.61 858.81`) while funky's masters carry
   padding, so sizing each file by its own aspect drew the mark ~8% (icon) and ~26% (stacked) too
   large outside funky. Scaling each variant down by its ink/canvas fraction — the first attempt —
   equalised the ink but left the element boxes unequal, which reflowed any container without a
   reserved height (`/about` collapsed 45.83px and carried the page with it), and could not fix
   position regardless, because funky's padding is vertically **asymmetric** (icon top 89.45 vs
   bottom 68.95; stacked 123 vs 97). The viewBoxes are now normalised to funky's canvas
   (`0 0 623.62 623.62`, `0 0 1920 1080`, `0 0 1339.99 191.14`) and `ThemedLogo` holds **one**
   aspect per role, no per-variant scaling. Re-export an asset and re-read its `viewBox` against
   the funky master before trusting it.
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
