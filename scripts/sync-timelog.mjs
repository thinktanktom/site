#!/usr/bin/env node
/*
 * Aggregates the local timewarrior database into content/timelog.json, the
 * committed snapshot that /activity renders.
 *
 * WHY A SNAPSHOT AT ALL, rather than reading timewarrior at build time: the
 * database lives at ~/.local/share/timewarrior on Tom's machine and nowhere
 * else. The site is a static export built by a GitHub Actions runner
 * (.github/workflows/deploy.yml), which has no timewarrior, no data directory
 * and no way to reach this one. A build-time read would therefore succeed
 * locally and publish an empty graph from CI -- the same silent-degradation
 * failure class lib/github.ts has to live with, except here there is no
 * network to blame and no reason to accept it. So the aggregation runs HERE,
 * on demand, and its output is a tracked file.
 *
 * Consequence, and it is the whole trade: THE GRAPH IS AS STALE AS THE LAST
 * SYNC. It does not update itself. Run this before pushing when you want the
 * page current; `--check` tells you whether it would change anything.
 *
 * Three things this script does that are correctness, not formatting:
 *
 *   1. It buckets by LOCAL date, and writes local date strings. A reader in
 *      Tokyo and a reader in New York must see the same grid, so the day
 *      boundaries are resolved once, here, in the timezone the work actually
 *      happened in -- never in the browser.
 *   2. It SPLITS an interval that crosses local midnight. A session from 23:30
 *      to 00:45 is 30 minutes on one day and 45 on the next, not 75 on either.
 *   3. It never publishes a tag that is not in PUBLIC_TAGS. See below.
 *
 * Usage:
 *   node scripts/sync-timelog.mjs            # write content/timelog.json
 *   node scripts/sync-timelog.mjs --check    # exit 1 if the file is stale
 */

import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'

const OUT = join(dirname(dirname(fileURLToPath(import.meta.url))), 'content', 'timelog.json')

/*
 * THE TAG ALLOWLIST. Everything else aggregates into "Other".
 *
 * This is deny-by-default on purpose, and the default is the point: timewarrior
 * tags are typed in a terminal in the middle of working, and several of the
 * repos Tom works in are client work. A tag like `acme-audit` names a client
 * engagement, and publishing it on a public page is a disclosure that cannot be
 * walked back once a crawler has it. An allowlist means a newly invented tag is
 * private by DEFAULT -- it still contributes its hours to the day's total, so
 * the graph stays honest, but it is never named. Forgetting to update this file
 * is the safe direction.
 *
 * Keys are timewarrior tags verbatim (case-sensitive, as timewarrior stores
 * them). Values are the display label, and MAY COLLIDE: several tags mapping to
 * one label is how a label gets consolidated. `Feed` + `Upwork` was the first
 * day's tagging before it settled on the single `UpworkFeed`, so all three
 * resolve to one bucket rather than showing as a split that means nothing.
 */
const PUBLIC_TAGS = {
  UpworkFeed: 'Upwork · feed work',
  Upwork: 'Upwork · feed work',
  Feed: 'Upwork · feed work',
  site: 'This site',
  timewarriorpage: 'This site',
  timewarrior_showcase_page: 'This site',
}

const OTHER = 'Other'

/*
 * Bumped when a change here would make the SAME timewarrior database produce a
 * different timelog.json -- a new allowlist entry, a changed label, a different
 * rounding rule. lib/timelog.ts refuses a snapshot stamped with anything else,
 * which turns "the committed file predates the aggregation rules" from a silent
 * wrong graph into a build error. Same reasoning as ENGINE_VERSION in
 * lib/palette: a cache the producer no longer agrees with is worse than none.
 */
const SNAPSHOT_VERSION = 1

/* ---------------------------------------------------------------- helpers */

/* Local YYYY-MM-DD. Deliberately NOT toISOString(), which is UTC and so names
   the wrong calendar day near a local midnight. The direction depends on the
   sign of the offset: EAST of Greenwich (this machine, UTC+5:30) UTC bucketing
   drags post-midnight work BACK to the previous day; WEST of it, evening work is
   pushed FORWARD to the next. Either way the window is the hours between local
   midnight and the offset, not the evening. */
function localDateKey(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/* Midnight at the START of the local day following `d`. Constructed from local
   parts rather than by adding 86400000ms, so a DST transition shortens or
   lengthens the day correctly instead of landing an hour either side of it. */
function nextLocalMidnight(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0, 0)
}

/* timewarrior's export stamps are compact ISO-8601 UTC: 20261102T050210Z. The
   Date constructor does not accept that form, so expand it to one that is
   unambiguous across engines. */
function parseStamp(s) {
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(s)
  if (!m) throw new Error(`unrecognised timewarrior timestamp: ${s}`)
  return new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`)
}

/*
 * One interval resolves to exactly ONE bucket, never several.
 *
 * An interval carries a set of tags, and adding its seconds to a bucket per tag
 * would double-count: `Feed Upwork` would report its 13 seconds twice and the
 * day's buckets would not sum to the day's total. So the tags are sorted and
 * the first allowlisted one wins -- deterministic (sorted, so it does not
 * depend on the order timewarrior happened to store them in) and total (no
 * allowlisted tag means `Other`).
 */
function bucketFor(tags) {
  for (const tag of [...(tags ?? [])].sort()) {
    if (Object.hasOwn(PUBLIC_TAGS, tag)) return PUBLIC_TAGS[tag]
  }
  return OTHER
}

/* ---------------------------------------------------------------- the work */

/*
 * `soft` is what makes this script safe to run from a git hook on a machine
 * that has never had timewarrior. Without it, `timew` missing is a hard error
 * and the hook would block every commit on any other machine or in CI.
 * Returns null instead, and the caller decides.
 */
function readTimewarrior(soft = false) {
  let raw
  try {
    /* `timew export` rather than parsing ~/.local/share/timewarrior/data/*.data
       by hand. The on-disk format is one `inc` line per interval with tags
       after a `#`, which looks trivial until a tag contains a space (quoted) or
       the month rolls over into a second file. The export is JSON, handles
       both, and is the documented interface. */
    raw = execFileSync('timew', ['export'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  } catch (err) {
    /*
     * SOFT MODE SWALLOWS EVERY FAILURE, not just ENOENT, and the difference is
     * not theoretical. A machine with `timew` installed but never configured
     * does not fail with ENOENT: `timew export` prompts for first-time setup,
     * gets EOF (a hook's stdin is /dev/null), and exits 255. `err.code` is
     * then undefined, so an ENOENT-only guard rethrows and node prints ~25
     * lines of stack trace into the output of EVERY COMMIT, forever. A corrupt
     * *.data file does the same. The commit still succeeds — the hook ignores
     * the status — but "harmless on a machine that has never had timewarrior"
     * has to mean unconfigured and broken too, not just absent.
     */
    if (soft) {
      console.log(
        `timewarrior unavailable (${err.code ?? `exit ${err.status}`}) — leaving content/timelog.json alone.`
      )
      return null
    }
    if (err.code === 'ENOENT') {
      console.error('timew is not on PATH. This script only runs where the database lives.')
      process.exit(1)
    }
    throw err
  }

  try {
    return JSON.parse(raw)
  } catch (err) {
    if (soft) {
      console.log('timew export was not valid JSON — leaving content/timelog.json alone.')
      return null
    }
    throw err
  }
}

function aggregate(intervals, now) {
  /* dateKey -> { seconds, buckets: { label -> seconds } } */
  const days = new Map()

  const add = (key, bucket, seconds) => {
    if (seconds <= 0) return
    let day = days.get(key)
    if (!day) {
      day = { seconds: 0, buckets: new Map() }
      days.set(key, day)
    }
    day.seconds += seconds
    day.buckets.set(bucket, (day.buckets.get(bucket) ?? 0) + seconds)
  }

  let openCount = 0
  /* The local days a still-running interval touches. --check neutralises these
     before comparing, because their totals grow every second the session runs
     -- see the note in the --check branch. */
  const openDays = new Set()

  for (const iv of intervals) {
    const start = parseStamp(iv.start)
    /* An interval with no `end` is the one currently being tracked. Clamp it to
       the sync time rather than skipping it -- otherwise the day you are
       working on is the one day the graph cannot see, which reads as a bug
       every time you run this mid-session. */
    const end = iv.end ? parseStamp(iv.end) : now
    /* Counted BEFORE the zero-length guard. Behind it, a session started in
       the current second (or with a start slightly ahead of the clock) was
       reported as `openAtSync: false` with no open days — which told --check
       to compare a day that is in fact still growing. */
    if (!iv.end) openCount += 1
    if (!(end > start)) continue

    const bucket = bucketFor(iv.tags)

    /* Walk the interval day by local day. Nothing here assumes an interval is
       shorter than a day: a forgotten `timew start` left running overnight
       spans three keys and is attributed to each. */
    let cursor = start
    while (cursor < end) {
      const boundary = nextLocalMidnight(cursor)
      const slice = boundary < end ? boundary : end
      const key = localDateKey(cursor)
      add(key, bucket, Math.round((slice - cursor) / 1000))
      if (!iv.end) openDays.add(key)
      cursor = slice
    }
  }

  return { days, openCount, openDays }
}

function build(soft = false) {
  const now = new Date()
  const intervals = readTimewarrior(soft)
  if (intervals === null) return null
  const { days, openCount, openDays } = aggregate(intervals, now)

  /* Sorted, so the committed file has a stable diff. An object keyed by date
     is what lib/timelog.ts wants anyway -- the grid looks days up by key
     rather than scanning -- and JSON preserves insertion order. */
  const dayKeys = [...days.keys()].sort()

  const out = {
    version: SNAPSHOT_VERSION,
    /* The sync time, and the honest answer to "how current is this graph". The
       page renders it, because a heatmap with no as-of date silently claims to
       be live and this one is not. */
    generatedAt: now.toISOString(),
    /* The offset the day boundaries were resolved in. lib/timelog.ts READS this
       to bucket the GitHub PR half onto the same days -- a CI runner is UTC, and
       at this offset the UTC and local calendar days diverge once the UTC clock
       passes 18:30, i.e. for local times between 00:00 and 05:30. Letting the
       build machine decide would bucket work in those small hours a day early. */
    tzOffsetMinutes: -now.getTimezoneOffset(),
    /* Was a session still running at sync time? If so the final day's total is
       a partial, which is a fact about the snapshot rather than the data. */
    openAtSync: openCount > 0,
    intervalCount: intervals.length,
    totalSeconds: dayKeys.reduce((n, k) => n + days.get(k).seconds, 0),
    days: Object.fromEntries(
      dayKeys.map((k) => {
        const day = days.get(k)
        return [
          k,
          {
            seconds: day.seconds,
            /* Largest bucket first, so the page can render the breakdown in
               the order it wants to read without sorting at build time. */
            buckets: Object.fromEntries([...day.buckets.entries()].sort((a, b) => b[1] - a[1])),
          },
        ]
      })
    ),
  }

  return { out, openDays }
}

/* ------------------------------------------------------------- test seam */

/*
 * Exported so scripts/__tests__/sync-timelog.test.mjs can reach the pure
 * helpers. `bucketFor` is the site's ONLY privacy control — the single
 * function standing between a client-named timewarrior tag and a committed,
 * crawled file — and until this seam existed nothing could test it, because
 * `vitest.config.ts` globs only `lib/**` and `components/**` and importing
 * this module ran the whole CLI as a side effect.
 *
 * The entry block below is guarded on being the process's main module, so an
 * import is inert.
 */
export { bucketFor, localDateKey, nextLocalMidnight, parseStamp, aggregate, PUBLIC_TAGS, OTHER, SNAPSHOT_VERSION }

/* ---------------------------------------------------------------- entry */

/* Only run the CLI when invoked as one. `process.argv[1]` is the script path;
   comparing resolved file URLs avoids the symlink and relative-path mismatches
   a plain string compare hits. */
const INVOKED_DIRECTLY =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href

if (INVOKED_DIRECTLY) {
  main()
}

function main() {

const CHECK = process.argv.includes('--check')
/*
 * --if-changed is the mode the pre-commit hook uses (.githooks/pre-commit).
 * It differs from a plain run in three ways, and each one exists so that a
 * hook can run it on EVERY commit without being a nuisance:
 *
 *   - a missing `timew` is a SKIP, not an error, so the hook is harmless on a
 *     machine or a CI runner that has no timewarrior;
 *   - the file is left completely untouched when nothing a reader could see has
 *     changed, instead of being rewritten with a fresh `generatedAt`. Without
 *     this every single commit in the repo would carry a one-line timelog.json
 *     diff, including commits that have nothing to do with this site's data;
 *   - it exits 0 only when it actually wrote, so the hook knows whether there
 *     is anything to `git add`. Exit 3 means "nothing to do".
 */
const IF_CHANGED = process.argv.includes('--if-changed')

const built = build(IF_CHANGED)
if (built === null) {
  /* --if-changed only; a plain run has already exited inside readTimewarrior. */
  console.log('timew not found — leaving content/timelog.json alone.')
  process.exit(3)
}

const { out: snapshot, openDays } = built
const serialised = JSON.stringify(snapshot, null, 2) + '\n'

if (IF_CHANGED) {
  let existing = null
  try {
    existing = readFileSync(OUT, 'utf8')
  } catch {
    /* no snapshot committed yet — writing one is exactly the right move */
  }

  /*
   * A DIFFERENT QUESTION FROM --check's, deliberately.
   *
   * --check asks "is the committed data wrong?", and so ignores the day a
   * running session is on, whose total grows every second by construction.
   *
   * This asks "would rewriting the file change what the page renders?", and so
   * must NOT ignore that day: keeping today's hours current is the entire point
   * of running this from a hook. Only the fields that churn with no visible
   * effect are neutralised -- `generatedAt` moves on every run, and
   * `intervalCount` is not rendered anywhere.
   *
   * ACCEPTED CONSEQUENCE: a commit made while the timer is running will carry a
   * timelog.json change, because the hours genuinely did move. Commits made
   * with no session open and no new work logged will not touch the file at all.
   */
  /*
   * Returns null for anything it cannot parse, which is what makes a corrupt
   * snapshot SELF-HEALING. With a bare JSON.parse here, a half-written or
   * conflict-marked content/timelog.json threw a SyntaxError out of the hook
   * on every commit and the file was never rewritten — so the one state that
   * most needs repairing was the one state the script refused to repair, while
   * a *missing* file healed itself on the next commit. A file we cannot read is
   * now treated exactly like a file that is not there.
   */
  const material = (s) => {
    try {
      return JSON.stringify({ ...JSON.parse(s), generatedAt: null, intervalCount: null })
    } catch {
      return null
    }
  }

  const existingMaterial = existing === null ? null : material(existing)
  if (existingMaterial !== null && existingMaterial === material(serialised)) {
    console.log('content/timelog.json already current — not rewritten.')
    process.exit(3)
  }

  writeFileSync(OUT, serialised)
  const hrs = (snapshot.totalSeconds / 3600).toFixed(2)
  console.log(
    `content/timelog.json updated — ${Object.keys(snapshot.days).length} days, ${hrs}h` +
      (snapshot.openAtSync ? ' (session running; today is partial)' : '')
  )
  process.exit(0)
}

if (CHECK) {
  let existing
  try {
    existing = readFileSync(OUT, 'utf8')
  } catch {
    console.error(`content/timelog.json is missing. Run: node ${process.argv[1]}`)
    process.exit(1)
  }

  /*
   * WHAT IS NEUTRALISED BEFORE COMPARING, and why each one has to be.
   *
   * `generatedAt` and `intervalCount` change on every run by construction, so a
   * byte comparison would always report stale and the check would mean nothing.
   *
   * THE DAYS A RUNNING SESSION TOUCHES are neutralised for a less obvious
   * reason, and leaving them in made `--check` useless exactly when it would be
   * used. An open interval is clamped to the sync time, so its day's total grows
   * every second the timer runs -- which means that while you are tracking (the
   * normal state when you would ask) the answer was unconditionally "STALE",
   * whether or not anything a reader could see had actually changed. A check
   * that always says yes is not a check.
   *
   * So the comparison is: has anything changed on a day that is FINISHED? If
   * not, the committed snapshot is current apart from a timer that is still
   * running, and re-syncing would only move a partial figure. That is reported
   * distinctly rather than as either "up to date" or "stale", because it is
   * neither -- a re-sync before pushing is still worth doing, it is just not a
   * correctness problem.
   */
  const neutralise = (s) => {
    const o = JSON.parse(s)
    const days = { ...o.days }
    for (const key of openDays) delete days[key]
    return JSON.stringify({
      ...o,
      generatedAt: null,
      openAtSync: null,
      intervalCount: null,
      /* a sum over all days, open ones included, so it cannot be compared once
         those days are excluded */
      totalSeconds: null,
      days,
    })
  }

  if (neutralise(existing) !== neutralise(serialised)) {
    console.error('content/timelog.json is STALE — the timewarrior database has moved on.')
    console.error(`Run: node ${process.argv[1]}`)
    process.exit(1)
  }

  if (openDays.size > 0) {
    console.log(
      'content/timelog.json is current for every finished day; a session is still ' +
        `running (${[...openDays].join(', ')}), so its total will grow until you re-sync.`
    )
  } else {
    console.log('content/timelog.json is up to date.')
  }
  process.exit(0)
}

writeFileSync(OUT, serialised)
const dayCount = Object.keys(snapshot.days).length
const hours = (snapshot.totalSeconds / 3600).toFixed(2)
console.log(
  `content/timelog.json ← ${snapshot.intervalCount} intervals, ${dayCount} days, ${hours}h` +
    (snapshot.openAtSync ? ' (a session is still running; the last day is partial)' : '')
)
}
