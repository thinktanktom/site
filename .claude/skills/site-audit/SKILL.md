---
name: site-audit
description: Run a full performance/accessibility/SEO/code-cleanup audit on this site with before/after visual verification. Use when the user asks to "optimize the site", "run an audit", "check performance/a11y/SEO", or similar for this ThinkTankTom Next.js site.
---

# Site audit workflow

Full-site optimization pass for this repo (Next.js 14 App Router, static
export, GitHub Pages, Tailwind, MDX). Four concerns — performance, a11y, SEO,
code cleanup — audited and fixed in parallel by isolated agents, with visual
regression checking.

First run: 2026-09-18. The `site_audit_2026-09` project memory records what
changed and what was deliberately left alone — read it before starting and
don't redo settled tradeoffs without a new reason. Treat it as a record of
that run, not as a description of `main`: several of its branches were never
merged, so verify against the working tree before believing any claim about
what currently ships.

## 0. Preconditions

- Check `git status`. This repo routinely carries uncommitted and untracked
  work in progress. Worktrees for the parallel agents branch from a clean
  `main`, so that work is invisible to them (safe by construction) — but the
  sequential-merge step in §3 uses `git stash` **in the main tree**, which is
  not safe around unrelated work in progress. Surface what you found to the
  user and agree a plan before touching it; never stash on your own judgement.
- Build and serve the static export — this is what the screenshot script
  targets by default:

  ```bash
  npm run build
  npx -y serve out -l 4323 &
  ```

  Shooting `out/` rather than `npm run dev` means you are looking at the
  artifact that actually reaches GitHub Pages, and it avoids the stale dev
  cache failure mode described in §3. Record the background PID and kill it by
  PID when you finish.
- First call to `scripts/audit-screenshots.sh` resolves nixpkgs chromium via
  `nix build`, which can take 1-2 minutes the first time, then it is cached.

## 1. Baseline screenshots

```bash
scripts/audit-screenshots.sh baseline
```

Screenshots land in `/tmp/site-audit-screenshots/baseline/`. Spot-check a
couple with Read before proceeding — confirm the dark theme actually
rendered.

Expect the hero on `/` to look stretched over a lot of empty background. The
script uses an oversized viewport height to capture full pages in one shot,
which also makes `100vh` that tall. That is the capture method, not a layout
bug, and it is consistent between baseline and after.

## 2. Launch four parallel worktree-isolated agents

Use the `Agent` tool with `isolation: "worktree"` for each role, launched in
one message so they run in parallel. Each is a fresh `general-purpose` agent
with no context from this conversation, so each prompt must be fully
self-contained. Write several paragraphs per agent, not two lines — a thin
prompt produces shallow, generic work. Inline all of:

- the stack and hosting constraints (`output: 'export'`, GitHub Pages, no
  server components hitting APIs, no API routes, no ISR, no Vercel features);
- the design system tokens from `CLAUDE.md` — no agent may change colors,
  fonts, or motion choreography;
- the guardrails below.

**Guardrails that have caught agents out before:**

- `public/ttt_logo.png` and `public/ttt_icon.png` are referenced only from
  `metadata` and JSON-LD blocks — they are social-crawler OG previews, never
  rendered in the UI. They are oversized for that use, but they do not affect
  Core Web Vitals. Don't invent image-optimization work around them; check
  for an actual `<Image>`/`<img>` reference before assuming there is any.
- Everything under `content/projects/<Project>/` **is** shipped — each
  project's `[...slug]` route renders those files as documentation pages, so
  they are in scope for content-level findings. The exception is
  `content/projects/BankX_project_files/`, which is gitignored source
  material and never builds; it won't exist in an agent's worktree at all,
  so don't go looking for it there.

The four roles, each ending with "run `npm run build` and `npm run lint` and
`npx tsc --noEmit` before finishing, then `git add -A && git commit` in the
worktree so the work can be diffed and merged":

1. **Performance & Core Web Vitals** — LCP/INP/CLS, font-loading weights,
   lazy-loading, bundle size / client-component boundaries, asset weight.
2. **Accessibility** — semantic landmarks, heading hierarchy, keyboard nav
   and focus-visible states, ARIA on icon-only links and on each mobile nav
   overlay (`Nav.tsx` plus `BankXDocSidebar.tsx`,
   `BasedAgentsDocSidebar.tsx`, `RufloOrchestrationDocSidebar.tsx` — the
   three doc sidebars are near-identical and drift apart easily), color
   contrast (WCAG AA) on secondary text, `prefers-reduced-motion`, "opens in
   new tab" announcements.
3. **SEO** — canonical URLs and per-route OG/Twitter metadata (check for
   pages silently inheriting the generic root metadata), structured data
   (JSON-LD) where it genuinely matches real content, sitemap/robots
   completeness, single `<h1>` per page. **Known gap as of 2026-10-13:**
   `src/app/sitemap.ts` imports only `@lib/bankx-docs`, so the BasedAgents
   and RufloOrchestration documentation routes are absent from the sitemap
   entirely. Every dynamic route needs enumerating, not just top-level pages.
4. **Code cleanup** — dead code/exports, unused dependencies (verify via
   `grep -r` before removing anything), TypeScript/lint errors, redundant
   CSS, genuine (not speculative) duplication.

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
will refuse ("your local changes would be overwritten") if the first merge's
changes touch the same files. Fix:

```bash
git stash push -u -m "merged-so-far"
git merge --squash <next-branch>   # applies cleanly onto pristine main
git stash pop                       # reapplies the rest; real overlaps
                                     # become normal conflict markers,
                                     # everything else auto-merges
```

See the §0 warning before running that stash around unrelated work in
progress. Resolve any conflict markers, `git add` the resolved files, keep
going. If a branch changed `package.json`/`package-lock.json`, run
`npm install` in the main tree right after merging it — the branch's own
worktree had its own `node_modules`, which doesn't carry over.

**Gotcha, if you point `BASE_URL` at `npm run dev` instead of the export:**
after any merge that touches dependencies, the running dev server's `.next`
cache goes stale — every `_next/static/*` chunk 404s and pages render as
unstyled white HTML (no dark theme, default fonts). This looks exactly like a
catastrophic visual regression but isn't one. Fix before panicking:

```bash
ss -ltnp | grep 3000        # find the pid (lsof isn't available on NixOS)
kill <pid>
rm -rf .next
npm run dev &                # restart clean
```

Rebuilding and re-serving `out/` (the default path) avoids this entirely.

When all four are merged, clean up: `git worktree remove --force
.claude/worktrees/agent-<id>` and `git branch -D worktree-agent-<id>` for
each.

## 4. After screenshots + comparison

Rebuild and restart the static server first, or you will re-shoot the old
export and conclude nothing changed:

```bash
npm run build
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

Any large delta needs an actual Read/look before concluding anything.

## 5. Record what happened

- **Project memory** (`~/.claude/projects/-home-thinktanktom-site/memory/`):
  write a dated `site_audit_YYYY-MM.md` capturing what changed, what was left
  alone and why, and any new gotcha you hit (append the gotcha to this skill
  file too). Update `MEMORY.md`'s Design System line if tokens changed.
- **`CLAUDE.md`**: update it only where it states something about the code
  that is no longer true — a design-system value in the Color Palette block,
  say. Make that edit when the change is actually on `main`.

  Do **not** add a dated "what this audit shipped" section. The 2026-09-18
  run did exactly that, describing merged and unmerged work alike as shipped;
  three of its five branches were still unmerged four weeks later and the
  section was the reason nobody noticed. A status claim in a file nobody
  re-verifies rots silently. The per-run record belongs in project memory,
  and what shipped is answered by `git log` and the open PR list.

## 6. Report

Confirm to the user: build/lint/typecheck all pass, no visual regressions
(cite the screenshot comparison), what changed per category, and what was
flagged rather than guessed. State plainly which branches are merged and
which are still only branches — that is the distinction the first run got
wrong. Per this project's git safety rules, leave everything
staged-but-uncommitted pending review; don't commit without being asked.
