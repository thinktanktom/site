---
name: site-audit
description: Run a full performance/accessibility/SEO/code-cleanup audit on this site with before/after visual verification. Use when the user asks to "optimize the site", "run an audit", "check performance/a11y/SEO", or similar for this ThinkTankTom Next.js site.
---

# Site audit workflow

Full-site optimization pass for this repo (Next.js 14 App Router, static
export, GitHub Pages, Tailwind, MDX). Four concerns — performance, a11y, SEO,
code cleanup — audited and fixed in parallel by isolated agents, with visual
regression checking and documentation updates. First run: 2026-09-18 (see
`CLAUDE.md`'s "Site Audit" section and the `site_audit_2026-09` memory for
what changed and what was deliberately left alone — don't redo settled
tradeoffs without a new reason).

## 0. Preconditions

- Check `git status` — if there's uncommitted work already in the tree, note
  it. Worktrees for the parallel agents branch from clean `main` HEAD, so
  uncommitted files are invisible to them (safe by construction) — but call
  this out to the user rather than assuming it's fine to ignore.
- Start the dev server: `npm run dev` in the background, poll
  `curl -sf http://localhost:3000/` until it's up.
- Ensure nixpkgs chromium is available (first call to
  `scripts/audit-screenshots.sh` triggers `nix build nixpkgs#chromium`,
  which can take 1-2 minutes the first time, then it's cached).

## 1. Baseline screenshots

```bash
scripts/audit-screenshots.sh baseline
```

Screenshots land in `/tmp/site-audit-screenshots/baseline/`. Spot-check a
couple with Read before proceeding — confirm the dark theme actually
rendered (see the stale-dev-cache gotcha below; it's easy to mistake for a
real bug).

## 2. Launch four parallel worktree-isolated agents

Use the `Agent` tool with `isolation: "worktree"` for each of these roles,
launched in one message so they run in parallel. Each is a fresh
`general-purpose` agent — it has no context from this conversation, so the
prompt must be fully self-contained: site stack, hosting constraints
(`output: 'export'`, GitHub Pages, no server/API routes/ISR), the design
system tokens from `CLAUDE.md` (don't let any agent change colors, fonts, or
motion choreography), and explicit guardrails against touching
`content/projects/BankX_project_files/` (reference documents, not shipped
assets) or inventing image-optimization work (the only raster images in
`public/` are OG-metadata-only, never rendered in the UI — check before
assuming there's image work to do).

The four roles, each ending with "run `npm run build` (and `npm run lint` /
`npx tsc --noEmit` if available) before finishing, then `git add -A && git
commit` in the worktree so the work can be diffed and merged":

1. **Performance & Core Web Vitals** — LCP/INP/CLS, font-loading weights,
   lazy-loading, bundle size / client-component boundaries, asset weight.
2. **Accessibility** — semantic landmarks, heading hierarchy, keyboard nav
   and focus-visible states, ARIA on icon-only links and the mobile nav
   overlays, color contrast (WCAG AA) on secondary text colors,
   `prefers-reduced-motion`, "opens in new tab" announcements.
3. **SEO** — canonical URLs and per-route OG/Twitter metadata (check for
   pages silently inheriting the generic root metadata), structured data
   (JSON-LD) where it genuinely matches real content, sitemap/robots
   completeness (check every dynamic-route slug is actually enumerated, not
   just top-level pages), single `<h1>` per page.
4. **Code cleanup** — dead code/exports, unused dependencies (verify via
   `grep -r` before removing anything), TypeScript/lint errors, redundant
   CSS, genuine (not speculative) duplication.

Full prompt templates used on the first run are preserved in this session's
transcript / can be reconstructed from the bullet points above — they were
several paragraphs each with the full site context inlined. Don't skip that
context when re-launching; a fresh agent with a two-line prompt will do
shallow, generic work.

## 3. Merge sequentially — squash, not `--no-ff`

Each agent worked from the same clean base, so branches can conflict with
each other on shared files (e.g. `about/page.tsx` touched by both the a11y
and SEO agents). Merge one at a time, using **`git merge --squash`** rather
than `git merge --no-ff`:

```bash
git diff main..<branch> --stat   # review before merging
git merge --squash <branch>
npm run build                     # verify after every merge
```

`--squash` stages changes without creating a commit or a `MERGE_HEAD` lock —
important because sequential merges need to proceed without committing in
between. **Gotcha**: since nothing gets committed, the *second* squash-merge
will refuse ("your local changes would be overwritten") if the first
merge's changes touch the same files. Fix:

```bash
git stash push -u -m "merged-so-far"
git merge --squash <next-branch>   # applies cleanly onto pristine main
git stash pop                       # reapplies the rest; real overlaps
                                     # become normal conflict markers,
                                     # everything else auto-merges
```

Resolve any conflict markers, `git add` the resolved files, keep going. If a
branch changed `package.json`/`package-lock.json`, run `npm install` in the
main tree right after merging it — the branch's own worktree had its own
`node_modules`, which doesn't carry over.

**Gotcha**: after any merge that touches dependencies, the already-running
dev server's `.next` cache goes stale — every `_next/static/*` chunk 404s
and pages render as unstyled white HTML (no dark theme, default fonts).
This looks exactly like a catastrophic visual regression but isn't one. Fix
before panicking:

```bash
ss -ltnp | grep 3000        # find the pid (lsof isn't available on NixOS)
kill <pid>
rm -rf .next
npm run dev &                # restart clean
```

When all four are merged, clean up: `git worktree remove --force
.claude/worktrees/agent-<id>` and `git branch -D worktree-agent-<id>` for
each.

## 4. After screenshots + comparison

```bash
scripts/audit-screenshots.sh after
```

Compare file sizes first as a cheap smoke test — pages with **no visual
change** should be byte-identical or very close:

```bash
cd /tmp/site-audit-screenshots
for f in baseline/*.png; do
  n=$(basename "$f"); echo "$n  $(stat -c%s "$f")  $(stat -c%s "after/$n")"
done
```

Any large delta needs an actual Read/look before concluding anything —
could be a real regression, or (see gotcha above) a stale dev server that
needs a restart and a re-shoot.

## 5. Update documentation

- `CLAUDE.md`: fix any design-system values that changed (e.g. a contrast
  fix to `--muted`) directly in the Color Palette code block, and add/update
  a dated "Site Audit — YYYY-MM-DD" section summarizing what changed and,
  importantly, what was deliberately left alone and why (future runs
  shouldn't redo settled tradeoffs).
- Project memory (`~/.claude/projects/-home-thinktanktom-site/memory/`):
  update `MEMORY.md`'s Design System line if colors changed, and write a
  dated `site_audit_YYYY-MM.md` project memory capturing what changed, what
  was left alone, and any new gotchas hit during the run (append to the
  gotchas in this skill file too, if you find a new one).

## 6. Report

Confirm to the user: build/lint/typecheck all pass, no visual regressions
(cite the screenshot comparison), what changed per category, what was
flagged instead of guessed (e.g. a color contrast fix, a security-tradeoff
left unfixed), and that everything is staged-but-uncommitted in the working
tree pending their review (per this project's git safety rules, don't commit
without being asked).
