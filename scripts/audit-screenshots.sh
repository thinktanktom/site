#!/usr/bin/env bash
# Screenshot every key page at desktop/tablet/mobile widths, for before/after
# comparison around site-wide changes (see .claude/skills/site-audit).
#
# Why nixpkgs' chromium: Playwright's bundled Chromium is a generic
# dynamically-linked Linux binary and cannot run on NixOS (it hits the
# nix.dev/permalink/stub-ld error). nixpkgs' chromium is patched for NixOS and
# works directly, so there is no Playwright dependency here at all. The first
# run resolves it via `nix build` (1-2 minutes); after that it is cached.
#
# Why the static export rather than `npm run dev`: this site ships as a static
# export to GitHub Pages, so `out/` is the artifact that actually reaches
# users. Shooting it also sidesteps the dev server's stale-`.next`-cache
# failure mode, where every chunk 404s and pages render unstyled — which looks
# exactly like a catastrophic visual regression but is not one.
#
# Usage:
#   npm run build
#   npx -y serve out -l 4323 &
#   scripts/audit-screenshots.sh <label> [outdir]
#
#   label   required — subdirectory name, e.g. "baseline" or "after"
#   outdir  optional — defaults to /tmp/site-audit-screenshots
#
# Environment:
#   BASE_URL  override the target origin (default http://localhost:4323).
#             Set it to http://localhost:3000 to shoot `npm run dev` instead.

set -euo pipefail

LABEL="${1:?usage: audit-screenshots.sh <label> [outdir]}"
OUTROOT="${2:-/tmp/site-audit-screenshots}"
BASE="${BASE_URL:-http://localhost:4323}"
OUTDIR="$OUTROOT/$LABEL"

# Update this list when routes change. One representative instance of each
# dynamic route is enough — but note that each project's documentation route
# renders its own sidebar component, so they are listed separately rather than
# treated as one [...slug] route.
# A dead route here is WORSE than noise: headless Chrome still writes a PNG for
# a 404 body, so the capture prints OK and the before/after comparison silently
# covers nothing. That is the same trap CLAUDE.md records for the e2e harnesses
# ("the browser renders the 404 body with the right URL and no <nav>, which
# looks exactly like a broken component"). /experience, /projects and
# /contributions were listed here until 2026-10-26 and had all three become
# 404s when they merged into /work, and /about joined them when it became the
# landing page on 2026-10-26 -- "home|/" already covers that content.
PAGES=(
  "home|/"
  "writing-index|/writing"
  "writing-post|/writing/the-proud-robot"
  "work|/work"
  "project-bankx|/projects/BankX"
  "doc-bankx|/projects/BankX/introduction"
  "doc-basedagents|/projects/BasedAgents/introduction"
  "doc-ruflo|/projects/RufloOrchestration/introduction"
  "doc-fractal|/projects/FractalWebhook/introduction"
)

# width,height. The height is deliberately oversized so that headless Chrome,
# which has no physical screen limit, renders the whole page in a single shot.
#
# Caveat worth knowing before you file a bug: an oversized viewport also makes
# `100vh` that tall, so the full-viewport hero on `/` is stretched over
# thousands of pixels of empty background. That is the capture method, not a
# layout regression. It is consistent between baseline and after, so
# comparisons remain valid.
VIEWPORTS=(
  "desktop|1440,6000"
  "tablet|768,7000"
  "mobile|375,8000"
)

if ! curl -sfo /dev/null "$BASE/"; then
  echo "ERROR: nothing is serving $BASE" >&2
  echo "Start it first:  npm run build && npx -y serve out -l 4323" >&2
  echo "(or point BASE_URL at an already-running server)" >&2
  exit 1
fi

echo "Resolving nixpkgs chromium (cached after first run)..." >&2
CHROME="$(nix build nixpkgs#chromium --no-link --print-out-paths)/bin/chromium"

# Chrome needs a writable profile directory. Use a throwaway one so repeat or
# concurrent runs cannot collide, and so the real profile is left untouched.
PROFILE="$(mktemp -d)"
trap 'rm -rf "$PROFILE"' EXIT

mkdir -p "$OUTDIR"

fail=0
for page_entry in "${PAGES[@]}"; do
  page="${page_entry%%|*}"
  path="${page_entry#*|}"
  for vp_entry in "${VIEWPORTS[@]}"; do
    vp="${vp_entry%%|*}"
    size="${vp_entry#*|}"
    out="$OUTDIR/${page}__${vp}.png"
    err="$(
      "$CHROME" --headless=new --disable-gpu --no-sandbox --hide-scrollbars \
        --user-data-dir="$PROFILE" \
        --force-device-scale-factor=1 \
        --window-size="$size" \
        --virtual-time-budget=3000 \
        --screenshot="$out" \
        "$BASE$path" 2>&1 >/dev/null
    )" || true
    if [ -s "$out" ]; then
      echo "OK   $page @ $vp"
    else
      # Chrome writes no file at all when the page fails to load, so surface
      # its stderr — otherwise a failure is just an unexplained "FAIL".
      echo "FAIL $page @ $vp"
      [ -n "$err" ] && echo "     ${err##*$'\n'}" >&2
      fail=1
    fi
  done
done

echo "DONE: $(find "$OUTDIR" -name '*.png' | wc -l) screenshots in $OUTDIR"
exit $fail
