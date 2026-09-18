#!/usr/bin/env bash
# Screenshot every key page at desktop/tablet/mobile widths against a running
# `npm run dev` server on localhost:3000. Used to capture before/after
# comparisons around site-wide changes (see .claude/skills/site-audit).
#
# Why not Playwright's own browser: its bundled Chromium is a generic
# dynamically-linked Linux binary and cannot run on NixOS (hits the
# nix.dev/permalink/stub-ld FHS error). nixpkgs' own Chromium is patched for
# NixOS and works directly — no Playwright dependency needed at all.
#
# Usage: scripts/audit-screenshots.sh <label> [outdir]
#   label   required — subdirectory name, e.g. "baseline" or "after"
#   outdir  optional — defaults to /tmp/site-audit-screenshots
set -euo pipefail
LABEL="${1:?usage: audit-screenshots.sh <label> [outdir]}"
OUTROOT="${2:-/tmp/site-audit-screenshots}"
BASE="http://localhost:3000"
OUTDIR="$OUTROOT/$LABEL"
mkdir -p "$OUTDIR"

echo "Resolving nixpkgs chromium (cached after first run)..." >&2
CHROME="$(nix build nixpkgs#chromium --no-link --print-out-paths)/bin/chromium"

# Update this list when routes change. Prefer one representative instance of
# each dynamic route ([slug], [...slug]) rather than every generated page.
declare -A PAGES=(
  [home]="/"
  [writing-index]="/writing"
  [writing-post]="/writing/agentic-workflow-nixos"
  [about]="/about"
  [experience]="/experience"
  [projects-index]="/projects"
  [project-bankx]="/projects/BankX"
  [contributions]="/contributions"
)

# width,tall-height — height is deliberately oversized so headless Chrome
# (no physical screen limit) renders the full page in one shot without
# needing Playwright's --full-page flag.
declare -A VIEWPORTS=(
  [desktop]="1440,6000"
  [tablet]="768,7000"
  [mobile]="375,8000"
)

fail=0
for page in "${!PAGES[@]}"; do
  path="${PAGES[$page]}"
  for vp in "${!VIEWPORTS[@]}"; do
    size="${VIEWPORTS[$vp]}"
    out="$OUTDIR/${page}__${vp}.png"
    "$CHROME" --headless=new --disable-gpu --no-sandbox --hide-scrollbars \
      --force-device-scale-factor=1 \
      --window-size="$size" \
      --virtual-time-budget=3000 \
      --screenshot="$out" \
      "$BASE$path" > /dev/null 2>&1
    if [ -s "$out" ]; then
      echo "OK   $page @ $vp"
    else
      echo "FAIL $page @ $vp"
      fail=1
    fi
  done
done

echo "DONE: $(ls "$OUTDIR" | wc -l) screenshots in $OUTDIR"
exit $fail
