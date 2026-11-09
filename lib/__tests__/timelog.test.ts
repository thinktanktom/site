import { describe, expect, it } from 'vitest'
import {
  buildGrid,
  bucketPRs,
  intensityFor,
  formatDuration,
  formatCellDate,
  MAX_WEEKS,
  DAYS_PER_WEEK,
} from '@lib/timelog'
import type { PullRequest } from '@lib/github'
import realSnapshot from '../../content/timelog.json'

/*
 * lib/timelog.ts is the riskiest module added with /activity, and for the same
 * reasons lib/work.ts was singled out for a test: it is date arithmetic across
 * two timezone conventions, a windowing pass, a banding function and a streak
 * counter, and every one of its failure modes is a QUIETLY WRONG GRID rather
 * than a crash. A cell off by one day, a streak counted across a gap or a PR
 * bucketed in UTC instead of the snapshot's zone all render perfectly.
 *
 * `buildGrid` takes its clock, its PR map and its snapshot as optional
 * arguments defaulting to the real ones — the same injection shape
 * buildEntries() uses in lib/work.ts, and what lets these tests pass synthetic
 * data without mocking a module.
 */

/* UTC+5:30, the zone the real snapshot is taken in — so these tests exercise
   the offset that actually ships rather than a convenient zero. */
const TZ = 330

function snap(
  days: Record<string, { seconds: number; buckets: Record<string, number> }>,
  overrides: Partial<Parameters<typeof buildGrid>[2]> = {}
) {
  return {
    version: 1,
    generatedAt: '2026-11-03T04:38:03.513Z',
    tzOffsetMinutes: TZ,
    openAtSync: false,
    totalSeconds: Object.values(days).reduce((n, d) => n + d.seconds, 0),
    days,
    ...overrides,
  }
}

const day = (seconds: number, buckets: Record<string, number> = { Other: seconds }) => ({
  seconds,
  buckets,
})

/* A Tuesday, 10:00 local (04:30Z) — mid-week and mid-morning, so neither the
   week boundary nor the UTC day boundary is adjacent by accident. */
const NOW = new Date('2026-11-03T04:30:00Z')

describe('intensityFor', () => {
  it('bands on fixed hours, not on the data', () => {
    expect(intensityFor(0)).toBe(0)
    expect(intensityFor(-5)).toBe(0)
    expect(intensityFor(60)).toBe(1)
    expect(intensityFor(2 * 3600 - 1)).toBe(1)
    expect(intensityFor(2 * 3600)).toBe(2)
    expect(intensityFor(4 * 3600 - 1)).toBe(2)
    expect(intensityFor(4 * 3600)).toBe(3)
    expect(intensityFor(6 * 3600 - 1)).toBe(3)
    expect(intensityFor(6 * 3600)).toBe(4)
    expect(intensityFor(14 * 3600)).toBe(4)
  })

  /* The whole point of fixed bands over GitHub's quartiles: a single short day
     must NOT paint the darkest cell on the page just for being the only one. */
  it('does not promote a lone short day to the top band', () => {
    const grid = buildGrid(NOW, new Map(), snap({ '2026-11-03': day(600) }))
    const cell = grid.columns.flat().find((c) => c.date === '2026-11-03')
    expect(cell?.intensity).toBe(1)
  })
})

describe('buildGrid geometry', () => {
  /* A snapshot starting Mon 2026-11-02, two days before NOW (Tue 2026-11-03).
     The window is therefore ONE column: the week of Sun 2026-11-01. */
  const grid = buildGrid(NOW, new Map(), snap({ '2026-11-02': day(3600) }))

  it('is a full rectangle, whatever its width', () => {
    expect(grid.columns.length).toBeGreaterThan(0)
    for (const column of grid.columns) expect(column).toHaveLength(DAYS_PER_WEEK)
  })

  /* The headline change of 2026-11-09: the grid begins at the first tracked
     week, not a fixed 52 weeks back. With two days of data that is one column,
     not 53 — which is what let the "most of this grid is empty" paragraph go. */
  it('starts at the week of the first tracked day, not a year back', () => {
    expect(grid.firstDate).toBe('2026-11-01')
    expect(grid.columns).toHaveLength(1)
  })

  it('grows a column per week as the log lengthens', () => {
    const older = buildGrid(NOW, new Map(), snap({ '2026-10-12': day(3600) }))
    expect(older.firstDate).toBe('2026-10-11')
    expect(older.columns).toHaveLength(4)
  })

  /* ...and stops growing at MAX_WEEKS, after which the window slides and the
     grid is the GitHub-shaped 53 columns it was originally. */
  it('caps at MAX_WEEKS once the log is older than that', () => {
    const ancient = buildGrid(NOW, new Map(), snap({ '2020-01-01': day(3600) }))
    expect(ancient.columns).toHaveLength(MAX_WEEKS)
  })

  it('starts on a Sunday and ends on the week containing today', () => {
    expect(new Date(`${grid.firstDate}T00:00:00Z`).getUTCDay()).toBe(0)
    /* 2026-11-03 is a Tuesday, so today sits at index 2 of the last column and
       the four cells after it are future. */
    const last = grid.columns[grid.columns.length - 1]
    expect(last[2].date).toBe('2026-11-03')
    expect(last.map((c) => c.future)).toEqual([false, false, false, true, true, true, true])
  })

  /* Days in the opening column that precede the first tracked day are holes,
     not zeroes — the grid must not claim a day went untracked before tracking
     existed. Sun 2026-11-01 sits before the Mon 2026-11-02 start. */
  it('marks days before the first tracked day as preStart holes', () => {
    const first = grid.columns[0]
    expect(first[0].date).toBe('2026-11-01')
    expect(first[0].preStart).toBe(true)
    expect(first[0].seconds).toBe(0)
    expect(first[1].date).toBe('2026-11-02')
    expect(first[1].preStart).toBe(false)
  })

  it('covers consecutive days with no gap or repeat', () => {
    const wide = buildGrid(NOW, new Map(), snap({ '2026-08-01': day(3600) }))
    const dates = wide.columns.flat().map((c) => c.date)
    expect(new Set(dates).size).toBe(wide.columns.length * DAYS_PER_WEEK)
    for (let i = 1; i < dates.length; i += 1) {
      const prev = new Date(`${dates[i - 1]}T00:00:00Z`).getTime()
      const here = new Date(`${dates[i]}T00:00:00Z`).getTime()
      expect(here - prev).toBe(86_400_000)
    }
  })

  it('resolves today in the snapshot zone, not the runner zone', () => {
    /* 2026-11-02T19:00Z is already 2026-11-03 00:30 local at UTC+5:30. A grid
       built from the UTC date would stop a day short and leave the real last
       tracked day sitting in a `future` cell, unpainted. */
    const g = buildGrid(new Date('2026-11-02T19:00:00Z'), new Map(), snap({}))
    expect(g.lastDate).toBe('2026-11-03')
  })

  it('labels a month exactly once and in reading order', () => {
    const labels = buildGrid(NOW, new Map(), snap({ '2020-01-01': day(3600) })).monthLabels
    expect(labels.length).toBeGreaterThanOrEqual(12)
    for (let i = 1; i < labels.length; i += 1) {
      expect(labels[i].column).toBeGreaterThan(labels[i - 1].column)
      expect(labels[i].label).not.toBe(labels[i - 1].label)
    }
  })

  /* An empty snapshot must still be a valid rectangle rather than zero columns
     wide — reachable on a fresh clone before the first sync. */
  it('renders one column for an empty snapshot', () => {
    const empty = buildGrid(NOW, new Map(), snap({}))
    expect(empty.columns).toHaveLength(1)
    expect(empty.columns[0]).toHaveLength(DAYS_PER_WEEK)
  })
})

describe('buildGrid totals', () => {
  it('sums only the window, and only the past', () => {
    const grid = buildGrid(
      NOW,
      new Map(),
      snap({
        /* inside the window */
        '2026-11-02': day(3600),
        '2026-11-03': day(1800),
        /* outside it: well before the 53-week start, and after today */
        '2020-01-01': day(99_999),
        '2026-12-25': day(99_999),
      })
    )
    expect(grid.totals.seconds).toBe(5400)
    expect(grid.totals.activeDays).toBe(2)
    /* The snapshot's lifetime total is reported separately and DOES include
       what the window excludes — the page distinguishes the two. */
    expect(grid.meta.lifetimeSeconds).toBe(3600 + 1800 + 99_999 + 99_999)
  })

  it('never paints or counts a future day even when the snapshot has one', () => {
    const grid = buildGrid(NOW, new Map(), snap({ '2026-11-07': day(7200) }))
    const cell = grid.columns.flat().find((c) => c.date === '2026-11-07')
    expect(cell?.future).toBe(true)
    expect(cell?.seconds).toBe(0)
    expect(cell?.intensity).toBe(0)
    /* buckets too, not just seconds: the code genuinely leaves a future cell's
       buckets populated while zeroing its seconds, and nothing caught it. It
       is invisible today only because cellTitle() bails on future cells. */
    expect(cell?.buckets).toEqual([])
    expect(grid.totals.activeDays).toBe(0)
    expect(grid.buckets).toEqual([])
  })

  it('counts the longest streak, not the latest run', () => {
    const grid = buildGrid(
      NOW,
      new Map(),
      snap({
        '2026-10-05': day(3600),
        '2026-10-06': day(3600),
        '2026-10-07': day(3600),
        '2026-10-08': day(3600),
        /* gap */
        '2026-11-02': day(3600),
        '2026-11-03': day(3600),
      })
    )
    expect(grid.totals.streak).toBe(4)
  })

  /* The grid is walked column-major, so a streak spanning a week boundary is
     the case that would break if the traversal were not chronological. */
  it('counts a streak across a week boundary', () => {
    const grid = buildGrid(
      NOW,
      new Map(),
      snap({
        /* Fri 30 Oct -> Mon 2 Nov: Sat/Sun end one column, Mon starts the next */
        '2026-10-30': day(3600),
        '2026-10-31': day(3600),
        '2026-11-01': day(3600),
        '2026-11-02': day(3600),
      })
    )
    expect(grid.totals.streak).toBe(4)
  })

  it('merges buckets across days, largest first', () => {
    const grid = buildGrid(
      NOW,
      new Map(),
      snap({
        /* Insertion order deliberately puts the SMALLER bucket first, so the
           expected output below can only be produced by the sort. With the
           fixture already in descending order the assertion passed with the
           sort deleted -- found by mutation testing. */
        '2026-11-02': day(3600, { Other: 2400, 'This site': 1200 }),
        '2026-11-03': day(3600, { 'This site': 3600 }),
      })
    )
    expect(grid.buckets).toEqual([
      { label: 'This site', seconds: 4800 },
      { label: 'Other', seconds: 2400 },
    ])
  })

  it('refuses a snapshot written under different aggregation rules', () => {
    expect(() => buildGrid(NOW, new Map(), snap({}, { version: 2 }))).toThrow(/version 2/)
  })

  /* Rolling 7 days ending today, not the calendar week — a calendar week
     resets every Monday and would read as a drop rather than a boundary. */
  it('totals the last 7 days inclusive of today, excluding the 8th', () => {
    const grid = buildGrid(
      NOW,
      new Map(),
      snap({
        '2026-11-03': day(3600), // today
        '2026-10-29': day(3600), // 5 days ago — in
        '2026-10-28': day(3600), // 6 days ago — in (the boundary)
        '2026-10-27': day(3600), // 7 days ago — OUT
        '2026-10-20': day(3600), // well out
      })
    )
    expect(grid.totals.last7Seconds).toBe(3 * 3600)
    /* ...while the window total still counts everything rendered. */
    expect(grid.totals.seconds).toBe(5 * 3600)
  })
})

describe('all-time PR counts', () => {
  const pr = (number: number, created_at: string, state: 'open' | 'closed', merged = false) =>
    ({
      number,
      title: `PR ${number}`,
      html_url: `https://github.com/acme/repo/pull/${number}`,
      state,
      merged_at: merged ? '2026-06-01T00:00:00Z' : null,
      created_at,
      repository: { full_name: 'acme/repo', html_url: 'https://github.com/acme/repo' },
    }) as PullRequest

  /*
   * The counts and the "Shipped upstream" list are deliberately NOT scoped to
   * the grid window. Since 2026-11-09 the grid starts at the first tracked day,
   * and every upstream PR so far predates that — window-scoped, both numbers
   * would read 0 on a page that lists ten PRs underneath them.
   */
  const prs = bucketPRs(
    [
      pr(1, '2026-05-13T06:00:00Z', 'closed', true), // merged
      pr(2, '2026-03-30T06:00:00Z', 'closed', false), // closed unmerged
      pr(3, '2026-02-01T06:00:00Z', 'open'),
      pr(4, '2026-02-01T07:00:00Z', 'open'),
    ],
    TZ
  )
  const grid = buildGrid(NOW, prs, snap({ '2026-11-02': day(3600) }))

  it('counts every PR regardless of the window', () => {
    expect(grid.columns).toHaveLength(1) // window really is one week
    expect(grid.totals.prsOpenedAllTime).toBe(4)
  })

  /* "Closed" means NOT OPEN. A merged PR is closed on GitHub too, and that is
     the natural pair for "opened". */
  it('counts merged and closed-unmerged together as closed', () => {
    expect(grid.totals.prsClosedAllTime).toBe(2)
  })

  it('still reports zero rings when no PR falls inside the window', () => {
    expect(grid.totals.prs).toBe(0)
    expect(grid.totals.prDays).toBe(0)
    expect(grid.columns.flat().every((c) => c.prs.length === 0)).toBe(true)
  })

  it('lists the PR days newest first, grouped by day', () => {
    expect(grid.prDaysAllTime.map((d) => d.date)).toEqual([
      '2026-05-13',
      '2026-03-30',
      '2026-02-01',
    ])
    expect(grid.prDaysAllTime[2].prs).toHaveLength(2)
    /* A PR day that predates the log carries no tracked time, and says so
       rather than inventing one. */
    expect(grid.prDaysAllTime[0].seconds).toBe(0)
  })
})

describe('bucketPRs', () => {
  const pr = (number: number, created_at: string): PullRequest => ({
    number,
    title: `PR ${number}`,
    html_url: `https://github.com/acme/repo/pull/${number}`,
    state: 'closed',
    merged_at: '2026-11-02T00:00:00Z',
    created_at,
    repository: { full_name: 'acme/repo', html_url: 'https://github.com/acme/repo' },
  })

  /* The reason bucketPRs takes an offset at all. 18:45Z is 2026-11-03 00:15 in
     the snapshot's zone, so the PR belongs to the 3rd. Bucketed in UTC — which
     is what a GitHub Actions runner's local time is — it would land on the 2nd,
     and the ring would sit on the cell beside the one whose hours it belongs
     with, for exactly the evening sessions that are most of the data. */
  it('buckets onto the snapshot zone day, not the UTC day', () => {
    const byDate = bucketPRs([pr(1, '2026-11-02T18:45:00Z')], TZ)
    expect(Array.from(byDate.keys())).toEqual(['2026-11-03'])
  })

  it('groups several PRs on one day and keeps their detail', () => {
    const byDate = bucketPRs(
      [pr(1, '2026-11-02T06:00:00Z'), pr(2, '2026-11-02T07:00:00Z')],
      TZ
    )
    expect(byDate.get('2026-11-02')).toHaveLength(2)
    expect(byDate.get('2026-11-02')?.[0]).toMatchObject({
      number: 1,
      repo: 'acme/repo',
      status: 'merged',
    })
  })

  it('drops a PR with an unparseable timestamp rather than keying NaN', () => {
    expect(bucketPRs([pr(1, 'not-a-date')], TZ).size).toBe(0)
  })

  it('reaches the grid as a ring, but only inside the window', () => {
    const grid = buildGrid(
      NOW,
      bucketPRs([pr(1, '2026-11-02T06:00:00Z'), pr(2, '2026-10-20T06:00:00Z')], TZ),
      snap({ '2026-11-02': day(3600) })
    )

    /* The window opens at the first tracked day's week (Sun 2026-11-01), so
       only the first PR can carry a ring. The second is outside the grid
       entirely — which is why the counts and the "Shipped upstream" list are
       all-time rather than read off these cells. */
    expect(grid.totals.prs).toBe(1)
    expect(grid.totals.prDays).toBe(1)
    expect(grid.columns.flat().find((c) => c.date === '2026-10-20')).toBeUndefined()

    const cell = grid.columns.flat().find((c) => c.date === '2026-11-02')
    expect(cell?.prs).toHaveLength(1)

    /* ...and both still appear in the all-time view. */
    expect(grid.totals.prsOpenedAllTime).toBe(2)
    expect(grid.prDaysAllTime.map((d) => d.date)).toEqual(['2026-11-02', '2026-10-20'])
  })

  /* A ring on a day with no tracked hours was the COMMON case before the
     window changed, and stays reachable: a PR opened today during a gap in
     logging. The cell must still paint its ring on a level-0 fill. */
  it('rings a day inside the window that has no tracked time', () => {
    const grid = buildGrid(
      NOW,
      bucketPRs([pr(1, '2026-11-03T06:00:00Z')], TZ),
      snap({ '2026-11-02': day(3600) })
    )
    const cell = grid.columns.flat().find((c) => c.date === '2026-11-03')
    expect(cell?.seconds).toBe(0)
    expect(cell?.intensity).toBe(0)
    expect(cell?.prs).toHaveLength(1)
  })
})

describe('formatters', () => {
  it('formats durations the way the tooltips read', () => {
    expect(formatDuration(0)).toBe('—')
    expect(formatDuration(-1)).toBe('—')
    expect(formatDuration(777)).toBe('13m')
    expect(formatDuration(3600)).toBe('1h')
    expect(formatDuration(13_299)).toBe('3h 42m')
    expect(formatDuration(7260)).toBe('2h 1m')
  })

  it('formats a cell date without drifting on the zone', () => {
    expect(formatCellDate('2026-11-02')).toBe('Mon 2 Nov 2026')
    expect(formatCellDate('2026-01-01')).toBe('Thu 1 Jan 2026')
  })
})

describe('the committed snapshot', () => {
  /* Guards the real content/timelog.json rather than a fixture: a hand-edited
     or half-written file would otherwise only show up as a wrong page.

     The clock comes from the snapshot's OWN generatedAt, not the module-level
     NOW and not `new Date()`. A hardcoded date rots — the snapshot moves on as
     Tom logs more, and the day it drifts out of a fixed window this test starts
     failing on data that is perfectly fine. The real clock would make it
     time-dependent in the other direction. Pairing the file with the moment it
     was written is the only stable choice, and it is also the pairing the page
     actually renders. */
  it('builds a grid from the file on disk', () => {
    const grid = buildGrid(new Date(realSnapshot.generatedAt))
    /* A range rather than a fixed 53: the width now grows with the log. The
       floor of 1 is the empty-snapshot case; the ceiling is the cap. */
    expect(grid.columns.length).toBeGreaterThanOrEqual(1)
    expect(grid.columns.length).toBeLessThanOrEqual(MAX_WEEKS)
    for (const column of grid.columns) expect(column).toHaveLength(DAYS_PER_WEEK)
    expect(grid.totals.seconds).toBeGreaterThan(0)
    expect(grid.meta.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  /* Every snapshot day that falls INSIDE the window must be rendered and
     counted. A day that is simply too old is not a defect — the window is 53
     weeks and the log is open-ended — so the assertion is scoped to the window
     rather than to the whole file. An earlier version compared against every
     day in the snapshot and would have started failing on perfectly good data
     around Nov 2027, which is the same rot it was written to avoid. */
  it('renders and counts every snapshot day that falls inside the window', () => {
    const grid = buildGrid(new Date(realSnapshot.generatedAt))
    const rendered = new Map(grid.columns.flat().map((c) => [c.date, c]))

    let expectedTotal = 0
    let inWindow = 0
    for (const [key, day] of Object.entries(realSnapshot.days)) {
      const cell = rendered.get(key)
      if (!cell || cell.future) continue
      inWindow += 1
      expectedTotal += day.seconds
      expect(cell.seconds).toBe(day.seconds)
    }

    expect(inWindow).toBeGreaterThan(0)
    expect(grid.totals.seconds).toBe(expectedTotal)
  })

  /* Shape guards on the real file. `null` and string values both slipped
     through before: each side coerces, so a day with `"seconds": null` simply
     vanished from the grid AND the totals while every assertion still held,
     and a string bucket made windowBuckets concatenate instead of add. */
  it('carries well-formed numbers for every day', () => {
    for (const [key, day] of Object.entries(realSnapshot.days)) {
      expect(typeof day.seconds, `${key}.seconds`).toBe('number')
      expect(Number.isFinite(day.seconds), `${key}.seconds finite`).toBe(true)
      /* A day cannot hold more than a day. Overlapping intervals or a
         hand-edit would otherwise publish "27h 47m" as an ordinary band-4
         cell. */
      expect(day.seconds, `${key}.seconds <= 24h`).toBeLessThanOrEqual(86_400)

      let summed = 0
      for (const [label, s] of Object.entries(day.buckets)) {
        expect(typeof s, `${key}.buckets[${label}]`).toBe('number')
        expect(Number.isFinite(s)).toBe(true)
        summed += s
      }
      expect(summed, `${key} buckets sum to the day`).toBe(day.seconds)
    }
  })
})
