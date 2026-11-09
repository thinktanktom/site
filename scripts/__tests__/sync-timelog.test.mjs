import { describe, expect, it } from 'vitest'
import {
  bucketFor,
  localDateKey,
  nextLocalMidnight,
  parseStamp,
  aggregate,
  PUBLIC_TAGS,
  OTHER,
  SNAPSHOT_VERSION,
} from '../sync-timelog.mjs'

/*
 * The producer half of /activity had NO automated coverage until this file,
 * and an audit named that the highest-leverage gap in the feature: the
 * consumer (lib/timelog.ts) had 21 tests while the module that does the
 * sanitising and the hard date arithmetic had none. `vitest.config.ts` globbed
 * only `lib/**` and `components/**`, and importing the script ran the whole
 * CLI as a side effect — so it gained a `scripts/**` glob and the script gained
 * a main-module guard.
 *
 * `bucketFor` is the single function standing between a client-named
 * timewarrior tag and a committed, crawled file. Both of its failure modes are
 * silent: a leak publishes a real client name, and a mis-bucket renders
 * plausible hours. Neither is a build error.
 */

describe('bucketFor — the privacy control', () => {
  const PUBLIC_LABELS = new Set(Object.values(PUBLIC_TAGS))

  it('maps every allowlisted tag to its label', () => {
    for (const [tag, label] of Object.entries(PUBLIC_TAGS)) {
      expect(bucketFor([tag])).toBe(label)
    }
  })

  /* The property that actually matters: the codomain is CLOSED. No input can
     produce a string that is not a label we chose. A truthiness check instead
     of Object.hasOwn would leak `constructor`, `toString` and friends — those
     are in the list below for exactly that reason. */
  it('never emits a string that is not a hardcoded label', () => {
    const hostile = [
      'acme-audit',
      'ClientName',
      '__proto__',
      'constructor',
      'toString',
      'hasOwnProperty',
      'valueOf',
      'prototype',
      '',
      ' ',
      'site ', // trailing space — not the allowlisted `site`
      'SITE', // case variant
      'Sit', // substring
      'sitex', // superstring
      'Upwork · feed work', // a LABEL used as a tag
      'Other',
      '../../etc/passwd',
      '<script>alert(1)</script>',
    ]
    for (const tag of hostile) {
      const out = bucketFor([tag])
      expect(PUBLIC_LABELS.has(out) || out === OTHER).toBe(true)
    }
  })

  it('sends an unlisted tag to Other, so its hours still count but it is never named', () => {
    expect(bucketFor(['acme-audit'])).toBe(OTHER)
    expect(bucketFor(['acme-audit', 'another-client'])).toBe(OTHER)
  })

  it('handles an interval with no tags at all', () => {
    expect(bucketFor(undefined)).toBe(OTHER)
    expect(bucketFor([])).toBe(OTHER)
  })

  /* Deterministic, and specifically NOT dependent on the order timewarrior
     happened to store the tags in — otherwise the same interval could land in
     different buckets on different syncs. */
  it('resolves a multi-tag interval to one bucket, independent of tag order', () => {
    expect(bucketFor(['Feed', 'Upwork'])).toBe(PUBLIC_TAGS.Feed)
    expect(bucketFor(['Upwork', 'Feed'])).toBe(PUBLIC_TAGS.Feed)
    expect(bucketFor(['site', 'Upwork'])).toBe(bucketFor(['Upwork', 'site']))
  })

  /* A known attribution limit rather than a leak: a client tag sitting beside
     an allowlisted one reports those hours under the PUBLIC label. Nothing is
     disclosed — the client tag is still never named — but the hours are
     attributed to the wrong bucket. Asserted so the behaviour is a decision
     rather than a surprise. */
  it('attributes a mixed public/private interval to the public label', () => {
    expect(bucketFor(['acme-audit', 'site'])).toBe('This site')
  })
})

describe('date helpers', () => {
  it('parses timewarrior compact UTC stamps', () => {
    expect(parseStamp('20261102T050210Z').toISOString()).toBe('2026-11-02T05:02:10.000Z')
  })

  it('rejects a stamp it does not recognise rather than producing Invalid Date', () => {
    expect(() => parseStamp('2026-11-02T05:02:10Z')).toThrow(/unrecognised/)
    expect(() => parseStamp('')).toThrow(/unrecognised/)
  })

  it('formats a local calendar key, zero-padded', () => {
    expect(localDateKey(new Date(2026, 0, 5, 13, 0))).toBe('2026-01-05')
    expect(localDateKey(new Date(2026, 10, 2, 0, 0))).toBe('2026-11-02')
  })

  /* The termination invariant of the midnight-split loop: the next boundary is
     always strictly after the cursor. If this can ever be false the loop in
     aggregate() does not terminate. */
  it('always advances strictly forward', () => {
    for (let i = 0; i < 400; i += 1) {
      const d = new Date(2026, 0, 1 + i, 23, 30)
      expect(nextLocalMidnight(d).getTime()).toBeGreaterThan(d.getTime())
    }
  })
})

describe('aggregate', () => {
  const iv = (start, end, tags) => (end ? { start, end, tags } : { start, tags })
  const NOW = new Date('2026-11-09T12:00:00Z')

  it('sums a simple interval into one local day', () => {
    const { days } = aggregate([iv('20261102T050210Z', '20261102T051856Z')], NOW)
    expect(days.get('2026-11-02').seconds) // 16m46s
      .toBe(1006)
  })

  /*
   * The invariant the whole file rests on: a day's `seconds` must equal the
   * sum of its buckets. Per-slice rounding could in principle break this; it
   * cannot, because `add` increments both with the same rounded value — this
   * pins that.
   */
  it('keeps each day seconds equal to the sum of its buckets', () => {
    const { days } = aggregate(
      [
        iv('20261102T050210Z', '20261102T051856Z'),
        iv('20261102T052949Z', '20261102T053002Z', ['Feed', 'Upwork']),
        iv('20261102T053014Z', '20261102T060546Z', ['UpworkFeed']),
        iv('20261101T180000Z', '20261101T230000Z', ['acme-private']),
      ],
      NOW
    )
    for (const [, day] of days) {
      const summed = Array.from(day.buckets.values()).reduce((n, s) => n + s, 0)
      expect(day.seconds).toBe(summed)
    }
  })

  /* The reason the split exists. An interval crossing local midnight belongs
     to both days in proportion, not wholly to either. */
  it('splits an interval across local midnight', () => {
    // 22:00 -> 02:00 local, at UTC+5:30 that is 16:30Z -> 20:30Z
    const start = new Date(2026, 10, 3, 22, 0)
    const end = new Date(2026, 10, 4, 2, 0)
    const fmt = (d) =>
      d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
    const { days } = aggregate([iv(fmt(start), fmt(end), ['site'])], NOW)

    expect(days.get('2026-11-03').seconds).toBe(2 * 3600)
    expect(days.get('2026-11-04').seconds).toBe(2 * 3600)
    expect(days.size).toBe(2)
  })

  it('spans an interval left running overnight across every day it touches', () => {
    const start = new Date(2026, 10, 1, 10, 0)
    const end = new Date(2026, 10, 4, 10, 0)
    const fmt = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
    const { days } = aggregate([iv(fmt(start), fmt(end), ['site'])], NOW)
    expect(Array.from(days.keys()).sort()).toEqual([
      '2026-11-01',
      '2026-11-02',
      '2026-11-03',
      '2026-11-04',
    ])
    const total = Array.from(days.values()).reduce((n, d) => n + d.seconds, 0)
    expect(total).toBe(3 * 24 * 3600)
  })

  it('clamps an open interval to the sync time and reports it', () => {
    const { days, openCount, openDays } = aggregate(
      [iv('20261109T110000Z', undefined, ['site'])],
      NOW
    )
    expect(openCount).toBe(1)
    expect(openDays.size).toBe(1)
    expect(days.get(Array.from(openDays)[0]).seconds).toBe(3600)
  })

  /* openCount must be counted BEFORE the zero-length guard, or a session
     started inside the current second reports openAtSync:false and --check
     then compares a day that is in fact still growing. */
  it('still reports a zero-length open interval as open', () => {
    const { openCount } = aggregate([iv('20261109T120000Z', undefined, ['site'])], NOW)
    expect(openCount).toBe(1)
  })

  it('drops a zero-length or reversed interval rather than emitting a day', () => {
    const { days } = aggregate(
      [
        iv('20261102T050000Z', '20261102T050000Z', ['site']),
        iv('20261102T060000Z', '20261102T050000Z', ['site']),
      ],
      NOW
    )
    expect(days.size).toBe(0)
  })

  it('never emits a bucket key that is not a hardcoded label', () => {
    const { days } = aggregate(
      [iv('20261102T050000Z', '20261102T060000Z', ['acme-audit', 'secret-client'])],
      NOW
    )
    const labels = new Set(Object.values(PUBLIC_TAGS))
    for (const [, day] of days) {
      for (const key of day.buckets.keys()) {
        expect(labels.has(key) || key === OTHER).toBe(true)
      }
    }
  })
})

describe('the two-sided version contract', () => {
  /*
   * SNAPSHOT_VERSION is declared independently in this script (the producer)
   * and in lib/timelog.ts (the consumer, which throws at build on a mismatch).
   * Nothing but this test asserts the two agree — and an audit showed the gate
   * cannot catch the two likeliest mistakes on its own, because in both of
   * them the file and the lib still read the same number.
   */
  it('agrees with the constant lib/timelog.ts enforces', async () => {
    const { readFileSync } = await import('node:fs')
    const { fileURLToPath } = await import('node:url')
    const { dirname, join } = await import('node:path')
    const repo = dirname(dirname(dirname(fileURLToPath(import.meta.url))))
    const src = readFileSync(join(repo, 'lib', 'timelog.ts'), 'utf8')
    const match = /const SNAPSHOT_VERSION = (\d+)/.exec(src)
    expect(match, 'lib/timelog.ts must declare SNAPSHOT_VERSION').not.toBeNull()
    expect(Number(match[1])).toBe(SNAPSHOT_VERSION)
  })

  it('agrees with the committed snapshot on disk', async () => {
    const { readFileSync } = await import('node:fs')
    const { fileURLToPath } = await import('node:url')
    const { dirname, join } = await import('node:path')
    const repo = dirname(dirname(dirname(fileURLToPath(import.meta.url))))
    const snap = JSON.parse(readFileSync(join(repo, 'content', 'timelog.json'), 'utf8'))
    expect(snap.version).toBe(SNAPSHOT_VERSION)
  })
})
