import snapshot from '../content/timelog.json'

/*
 * The grid behind /activity: a GitHub-shaped 53x7 heatmap of tracked hours,
 * with the days that shipped a pull request marked.
 *
 * Two sources meet here and they are joined on a CALENDAR DATE, which is the
 * only subtle thing in this file:
 *
 *   - content/timelog.json, written by scripts/sync-timelog.mjs from the local
 *     timewarrior database. Its day keys are LOCAL dates, already resolved in
 *     the zone the work happened in (see that script's header for why the data
 *     is a committed snapshot and not a build-time read).
 *   - lib/github.ts, a build-time fetch whose timestamps are UTC instants.
 *
 * So the PR half has to be bucketed into the SAME days as the timewarrior half,
 * using the snapshot's own recorded offset -- not the build machine's. A CI
 * runner is UTC, and at UTC+5:30 a UTC instant and the local calendar day part
 * company once the UTC clock passes 18:30 -- that is local 00:00 to 05:30, the
 * small hours. Work in that window would be bucketed to the PRECEDING day by
 * the PR half while the hours half put it on the correct one, so the ring would
 * sit one cell left of the session it belongs with.
 *
 * Everything below represents a calendar date as a Date at UTC midnight and
 * reads it back with the UTC getters. That makes dates pure calendar values
 * with no zone of their own, so none of this arithmetic can be bent by the
 * TZ of whichever machine runs the build.
 */

import { getRecentPRs, getPRStatus, type PRStatus } from '@lib/github'

/* Must match SNAPSHOT_VERSION in scripts/sync-timelog.mjs. A snapshot written
   under different aggregation rules is refused rather than rendered, because
   the failure it would otherwise cause is a quietly wrong graph. */
const SNAPSHOT_VERSION = 1

/*
 * THE GRID STARTS AT THE FIRST TRACKED DAY, not a fixed year back (changed
 * 2026-11-09). It used to be a fixed 53x7 like GitHub's, which meant 369 of
 * 371 cells were empty and the page had to carry a paragraph explaining why.
 * Growing from the first logged day instead means the graph is dense from day
 * one and widens on its own, and the explanation could go.
 *
 * MAX_WEEKS is the cap it grows into: once there is more than a year of data
 * the window slides, and the grid is exactly the GitHub-shaped 53 columns it
 * started as. So this is strictly a head-trim of the old window, not a
 * different idea.
 */
export const MAX_WEEKS = 53
export const DAYS_PER_WEEK = 7

/*
 * How many PULL REQUESTS the "Recent pull requests" list renders. The query
 * returns up to 100 and the page is a showcase, not an archive -- 65 rows
 * would bury the graph above them and the totals beside it.
 *
 * Counted in PRs rather than in days: capping days was the first attempt and
 * it is unpredictable, because PRs cluster (several merged to this site on one
 * afternoon) -- 15 days rendered 52 rows. Only the list is capped, never the
 * counts, so "PRs opened" still means what it says.
 */
export const RECENT_PRS = 15

/*
 * INTENSITY IS FIXED HOUR BANDS, NOT QUARTILES OF THE DATA. This is a
 * deliberate departure from GitHub's graph and the reason matters.
 *
 * GitHub scales its four greens to quartiles of your own non-zero days, which
 * works because a busy contributor has hundreds of them. Applied here it is
 * actively misleading in both directions: with two logged days a ten-minute
 * session lands in the top quartile and paints the darkest cell on the page,
 * and later, a genuinely heavy month would re-scale every historic cell so the
 * same eight-hour day renders lighter than it used to. The graph would change
 * shape without the underlying work changing at all.
 *
 * Fixed bands mean a dark cell always means a long day, the legend can state
 * the thresholds outright, and nothing is retroactively redrawn. The cost is
 * that an all-light year stays all-light -- which is simply true, and the
 * honest rendering of it.
 */
const BANDS = [2, 4, 6] as const

/** 0 = nothing tracked, 1..4 = increasing bands. */
export type Intensity = 0 | 1 | 2 | 3 | 4

export function intensityFor(seconds: number): Intensity {
  /* `!(seconds > 0)`, not `seconds <= 0`, so NaN lands here. NaN fails every
     `<` below, so the old form fell through to the final `return 4` and a
     corrupt or hand-edited day painted the DARKEST cell on the page while its
     tooltip read "NaNh NaNm". Reachable from a botched merge-conflict
     resolution in the snapshot — exactly the state the guards are for. */
  if (!(seconds > 0)) return 0
  const hours = seconds / 3600
  if (hours < BANDS[0]) return 1
  if (hours < BANDS[1]) return 2
  if (hours < BANDS[2]) return 3
  return 4
}

export const BAND_LABELS = [
  'nothing tracked',
  `under ${BANDS[0]}h`,
  `${BANDS[0]}–${BANDS[1]}h`,
  `${BANDS[1]}–${BANDS[2]}h`,
  `over ${BANDS[2]}h`,
] as const

export interface ActivityCell {
  /** "yyyy-mm-dd", the calendar date this cell is */
  date: string
  seconds: number
  intensity: Intensity
  /** largest bucket first, as the snapshot stores it */
  buckets: Array<{ label: string; seconds: number }>
  prs: Array<{ number: number; title: string; url: string; repo: string; status: PRStatus }>
  /** a cell after today: present to keep the grid rectangular, rendered as a hole */
  future: boolean
  /** a cell before the first tracked day, in the opening column. Also a hole:
      the grid must not claim a day went untracked before tracking began. */
  preStart: boolean
}

/** one day that carries at least one PR, for the "Recent pull requests" list */
export interface PRDay {
  date: string
  /** tracked time that day; 0 when the day predates the log */
  seconds: number
  prs: ActivityCell['prs']
}

export interface ActivityGrid {
  /** week columns of DAYS_PER_WEEK cells, Sunday first, oldest column first.
      The count grows from the first tracked week up to MAX_WEEKS. */
  columns: ActivityCell[][]
  /** { column index, label } for the columns where the month changes */
  monthLabels: Array<{ column: number; label: string }>
  firstDate: string
  lastDate: string
  totals: {
    /** across the rendered window only — not the snapshot's lifetime total */
    seconds: number
    /** days with any tracked time, in the window */
    activeDays: number
    /** rolling 7 days ending today */
    last7Seconds: number
    /** window-scoped: days carrying a ring, and rings on them */
    prDays: number
    prs: number
    /** the longest run of consecutive tracked days in the window */
    streak: number
    /*
     * PR COUNTS ARE ALL-TIME, NOT WINDOW-SCOPED, and that is forced rather
     * than sloppy. The grid now starts at the first tracked day (2026-11-02),
     * while every upstream PR so far predates it — so a window-scoped count
     * would report 0 opened and 0 closed on a page whose whole second half is
     * about those PRs. The rings stay window-scoped, because a ring has to
     * land on a cell; these two numbers and the "Recent pull requests" list below
     * deliberately do not.
     */
    prsOpenedAllTime: number
    /** all-time, and "closed" means NOT OPEN — merged PRs are closed too, which
        is GitHub's own semantics and the natural pair for "opened". */
    prsClosedAllTime: number
  }
  /** the most recent PR days, newest first, grouped by the day opened. Not
      window-scoped, and capped at RECENT_PRS pull requests — see the note
      there. The last day shown is whole, so this can slightly exceed the cap. */
  prDaysAllTime: PRDay[]
  /** every bucket in the window, largest first */
  buckets: Array<{ label: string; seconds: number }>
  meta: {
    generatedAt: string
    openAtSync: boolean
    /* the zone the snapshot resolved its day keys in. Published so the page can
       render `generatedAt` as the LOCAL calendar day it belongs to — slicing
       the UTC date off the instant names the previous day whenever the sync
       ran between local midnight and the offset. */
    tzOffsetMinutes: number
    /** the snapshot's lifetime total, which may exceed the window */
    lifetimeSeconds: number
  }
}

/* ------------------------------------------------------------ date helpers */

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function fromKey(key: string): Date {
  return new Date(`${key}T00:00:00Z`)
}

function addDays(d: Date, n: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + n))
}

/*
 * "Today" in the zone the snapshot was taken in. Shifting the instant by the
 * recorded offset and then reading UTC getters yields that zone's calendar
 * date, which is the one the day keys are in.
 */
function todayInSnapshotZone(now: Date, offsetMinutes: number): Date {
  const shifted = new Date(now.getTime() + offsetMinutes * 60_000)
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()))
}

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const

/* ------------------------------------------------------------ the builder */

interface SnapshotShape {
  version: number
  generatedAt: string
  tzOffsetMinutes: number
  openAtSync: boolean
  totalSeconds: number
  days: Record<string, { seconds: number; buckets: Record<string, number> }>
}

type PRByDate = Map<string, ActivityCell['prs']>

/*
 * `now` and `prsByDate` are injectable so the tests can pass a fixed clock and
 * a synthetic PR set — the same shape lib/work.ts uses for its curated lists,
 * and for the same reason: the real inputs are a wall clock and a network
 * fetch, neither of which belongs in a unit test.
 */
export function buildGrid(
  now: Date = new Date(),
  prsByDate: PRByDate = new Map(),
  data: SnapshotShape = snapshot as SnapshotShape
): ActivityGrid {
  if (data.version !== SNAPSHOT_VERSION) {
    throw new Error(
      `content/timelog.json is version ${data.version}, but lib/timelog.ts expects ` +
        `${SNAPSHOT_VERSION}. Re-run: node scripts/sync-timelog.mjs`
    )
  }

  const today = todayInSnapshotZone(now, data.tzOffsetMinutes)

  /*
   * The last column is the week containing today, so the grid ends on the
   * current partial week exactly as GitHub's does.
   *
   * The FIRST column is the week containing the earliest tracked day — not a
   * fixed 52 weeks back — capped at MAX_WEEKS so the grid stops growing after
   * a year and starts sliding instead. An empty snapshot falls back to the
   * current week, which keeps the grid a valid rectangle rather than zero
   * columns wide.
   */
  const dayKeys = Object.keys(data.days).sort()
  const thisSunday = addDays(today, -today.getUTCDay())
  const earliestTracked = dayKeys.length > 0 ? fromKey(dayKeys[0]) : today
  /* Days before this are holes, not zeroes: the grid should not claim a day
     went untracked when tracking had not begun. Clamped to the window so a
     snapshot older than MAX_WEEKS does not mark the whole first column. */
  const firstTracked = earliestTracked

  const earliestSunday = addDays(earliestTracked, -earliestTracked.getUTCDay())
  const cappedStart = addDays(thisSunday, -(MAX_WEEKS - 1) * DAYS_PER_WEEK)
  const start = earliestSunday > cappedStart ? earliestSunday : cappedStart

  /* Inclusive count of week columns between start and this week. */
  const weeks =
    Math.round((thisSunday.getTime() - start.getTime()) / (7 * 86_400_000)) + 1

  const columns: ActivityCell[][] = []
  const monthLabels: Array<{ column: number; label: string }> = []
  let previousMonth = -1

  const windowBuckets = new Map<string, number>()
  let windowSeconds = 0
  let activeDays = 0
  let prDays = 0
  let prCount = 0
  let streak = 0
  let run = 0

  /* Rolling 7-day total, ending today. Collected in the same pass. */
  const weekAgo = addDays(today, -6)
  let last7Seconds = 0

  /*
   * The all-time PR view, built straight from the bucketed map rather than
   * from the grid. Everything the page shows about pull requests other than
   * the rings comes from here, because the grid window now starts at the first
   * tracked day and every PR so far predates it — read off the grid, the
   * counts and the "Recent pull requests" list would all be empty.
   */
  const everyPRDay: PRDay[] = Array.from(prsByDate.entries())
    .map(([date, prs]) => ({ date, seconds: data.days[date]?.seconds ?? 0, prs }))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))

  /* The COUNTS are over everything fetched; only the rendered LIST is capped.
     Truncating before counting would make "PRs opened" quietly mean "PRs
     opened among the ones we happened to render", which is not a number
     anybody would guess from the label. */
  const allPRs = everyPRDay.flatMap((d) => d.prs)

  /*
   * Capped on PULL REQUESTS, not on days — capping days was the first attempt
   * and it is unpredictable: PRs cluster heavily (several merged to this site
   * on one afternoon), so 15 days rendered 52 rows. Walking the days in order
   * and stopping once RECENT_PRS have been taken keeps the list a knowable
   * length whatever the clustering, and never splits a day across the
   * boundary — the last day shown is whole.
   */
  const prDaysAllTime: PRDay[] = []
  let taken = 0
  for (const prDay of everyPRDay) {
    if (taken >= RECENT_PRS) break
    prDaysAllTime.push(prDay)
    taken += prDay.prs.length
  }

  for (let w = 0; w < weeks; w += 1) {
    const column: ActivityCell[] = []

    for (let d = 0; d < DAYS_PER_WEEK; d += 1) {
      const date = addDays(start, w * DAYS_PER_WEEK + d)
      const key = dateKey(date)
      /* `outside` covers BOTH ends: days after today, and days in the first
         column that precede the earliest tracked day. Both are holes rather
         than zeroes — the grid must not claim a day went untracked before
         tracking existed, any more than it claims one for tomorrow. */
      const future = date > today
      const preStart = date < firstTracked
      const outside = future || preStart

      const day = data.days[key]
      const seconds = outside ? 0 : (day?.seconds ?? 0)
      /* `future ? {} :` — a future cell must be blank in EVERY field, not just
         in `seconds`. It used to keep its buckets while reporting zero hours,
         which is an inconsistent cell that happened to render correctly only
         because cellTitle() bails out on future cells before reading them. */
      const buckets = Object.entries(outside ? {} : (day?.buckets ?? {})).map(([label, s]) => ({
        label,
        seconds: s,
      }))
      const prs = outside ? [] : (prsByDate.get(key) ?? [])

      if (!outside) {
        windowSeconds += seconds
        if (date >= weekAgo) last7Seconds += seconds
        if (seconds > 0) {
          activeDays += 1
          run += 1
          /* Tracked inside the loop rather than after it: the grid is walked
             column-major, but the cells within a column are consecutive days
             and the columns are in order, so this traversal IS chronological.
             That is worth stating because it is the one place the column-major
             shape could silently produce a wrong answer if it were not. */
          if (run > streak) streak = run
        } else {
          run = 0
        }
        if (prs.length > 0) {
          prDays += 1
          prCount += prs.length
        }
        for (const b of buckets) {
          windowBuckets.set(b.label, (windowBuckets.get(b.label) ?? 0) + b.seconds)
        }
      }

      column.push({
        date: key,
        seconds,
        intensity: intensityFor(seconds),
        buckets,
        prs,
        future,
        preStart,
      })
    }

    /* Label a column when its first day falls in a new month — the same rule
       GitHub uses, which is why its labels sit slightly left of the month's
       real start. The column's Sunday is the anchor. */
    const columnMonth = addDays(start, w * DAYS_PER_WEEK).getUTCMonth()
    if (columnMonth !== previousMonth) {
      monthLabels.push({ column: w, label: MONTHS[columnMonth] })
      previousMonth = columnMonth
    }

    columns.push(column)
  }

  return {
    columns,
    monthLabels,
    firstDate: dateKey(start),
    lastDate: dateKey(today),
    totals: {
      seconds: windowSeconds,
      activeDays,
      last7Seconds,
      prDays,
      prs: prCount,
      streak,
      prsOpenedAllTime: allPRs.length,
      prsClosedAllTime: allPRs.filter((p) => p.status !== 'open').length,
    },
    prDaysAllTime,
    /* Array.from, not a spread: tsconfig.json sets no `target`, so spreading a
       Map iterator needs downlevelIteration. Array.from needs neither. */
    buckets: Array.from(windowBuckets.entries())
      .map(([label, seconds]) => ({ label, seconds }))
      .sort((a, b) => b.seconds - a.seconds),
    meta: {
      generatedAt: data.generatedAt,
      openAtSync: data.openAtSync,
      tzOffsetMinutes: data.tzOffsetMinutes,
      lifetimeSeconds: data.totalSeconds,
    },
  }
}

/*
 * Buckets the build-time PR fetch onto calendar dates in the snapshot's zone.
 *
 * `created_at` is the date used, not `merged_at`: the graph is about the day
 * work happened, and opening the PR is that day. A PR merged weeks later by
 * someone else is not activity on the merge date.
 */
export function bucketPRs(
  prs: Awaited<ReturnType<typeof getRecentPRs>>,
  offsetMinutes: number
): PRByDate {
  const byDate: PRByDate = new Map()

  for (const pr of prs) {
    const created = new Date(pr.created_at)
    if (Number.isNaN(created.getTime())) continue
    const key = dateKey(todayInSnapshotZone(created, offsetMinutes))

    const list = byDate.get(key) ?? []
    list.push({
      number: pr.number,
      title: pr.title,
      url: pr.html_url,
      repo: pr.repository.full_name,
      status: getPRStatus(pr),
    })
    byDate.set(key, list)
  }

  return byDate
}

/* The one call the page makes. Async only because the PR half is a network
   fetch — same shape and same constraint as getWorkEntries() in lib/work.ts,
   so this must stay server-side. */
export async function getActivityGrid(): Promise<ActivityGrid> {
  const data = snapshot as SnapshotShape
  const prs = await getRecentPRs()
  return buildGrid(new Date(), bucketPRs(prs, data.tzOffsetMinutes), data)
}

/** "3h 41m", "41m", "—". Used in the cell titles and the summary row. */
export function formatDuration(seconds: number): string {
  if (seconds <= 0) return '—'
  const total = Math.round(seconds / 60)
  const h = Math.floor(total / 60)
  const m = total % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

/** "Mon 2 Nov 2026" — the cell tooltip's date half. */
export function formatCellDate(key: string): string {
  const d = fromKey(key)
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getUTCDay()]
  return `${weekday} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}

/**
 * The local calendar day an instant falls on, in the snapshot's own zone.
 *
 * Exists because `generatedAt` is a UTC instant while every date the page
 * renders is a local key, and `generatedAt.slice(0, 10)` therefore names the
 * PREVIOUS day whenever the sync ran between local midnight and the offset
 * (00:00–05:30 local at UTC+5:30). That is the same class of mistake this
 * module's header exists to warn about, so it should not be done inline.
 */
export function localDayOf(instant: string, offsetMinutes: number): string {
  return dateKey(todayInSnapshotZone(new Date(instant), offsetMinutes))
}
