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

The site has **three themes**. `funky` is the default and the brand look; `dark` is black and
white; `light` is white and black. The theme is an attribute on `<html>` — `data-theme="funky" |
"dark" | "light"` — and `:root` holds funky, so an absent or unrecognised attribute renders funky.

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
│   ├── ThemeSwitcher.tsx        ← 3-way theme control (client)
│   └── ThemedLogo.tsx           ← per-theme logo marks (server, CSS-swapped)
├── lib/
│   └── posts.ts                 ← MDX reading + frontmatter utils
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

- Active page: nav item gets `--accent` colour
- "Hire me" button: small pill button, `--accent` bg, `--bg` text — links to Upwork
- **The desktop cluster breaks at `lg`, not `md`** — this is deliberate and measured, not a typo.
  The wordmark (224px) plus five `tracking-widest uppercase` mono links plus the pill already
  measured 904px of `scrollWidth` against the 720px available at `md`; it overflowed and was
  merely hidden by `overflow-x: hidden` on `html, body`. Below `lg` the full-screen overlay
  carries both the navigation and the theme control.
- Gaps are measured, not guessed: `gap-4` leaves 26px between wordmark and first link at 1024px,
  and `xl:gap-6` leaves 54px. `gap-8` collapses that to 6px once `max-w-chrome` caps the row — so
  if you are tempted to restore the original `gap-8` at `xl`, don't.

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

**Adding a fourth theme** touches five places: the token block, the `.only-*` pair and the Shiki
selector trio in `globals.css`; the allow-list in the `layout.tsx` script; `ThemeSwitcher.tsx`;
the three arrays in `ThemedLogo.tsx`; and the `theme` object in `MDXContent.tsx`. It also needs a
matching logo asset set. Budget for that before promising one.

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
  runtime to re-highlight, which is why it has to go through CSS variables.
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
7. **Logo marks follow the theme; the raster logo does not.** The on-page marks are transparent
   vector glyphs rendered through `components/ThemedLogo.tsx`, which ships a per-theme asset:
   the existing `public/ttt_*.svg` for funky, `ttt_*_dark-mono.svg` (white) for dark, and
   `ttt_*_light-neon.svg` (near-black ink + one neon accent) for light. Pick the asset, never
   recolour or CSS-filter a mark. The old "white on black — never invert it" rule still holds for
   `thinktanktom_logo.png` / `ttt_logo.png` — the raster with the black ground baked in, used only
   as the OG/Twitter card image and the favicon. Those are consumed outside the page by social
   scrapers and browser chrome, cannot be themed, and stay dark-ground.
   **All three variants of a role must carry the same `viewBox`.** The artwork is byte-identical
   across the three files and sits in the same coordinate space; only the fill differs. The
   dark/light exports originally shipped cropped tight to the ink (icon `22.68 89.48 578.24
   465.37`, stacked `75.71 123.4 1768.61 858.81`) while funky's masters carry padding, so sizing
   each file by its own aspect drew the mark 8% larger (icon) and 26% larger (stacked logo) the
   moment you switched theme — a visible jump on `/` and `/about`. Their viewBoxes were widened to
   funky's canvas (`0 0 623.62 623.62`, `0 0 1920 1080`, `0 0 1339.99 191.14`), and `ThemedLogo`
   now holds **one** aspect per role rather than one per variant. Re-export an asset and re-check
   its `viewBox` against the funky master before trusting it.
8. Test mobile layout at 375px and 390px widths
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
