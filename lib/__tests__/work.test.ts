import { describe, expect, it, vi } from 'vitest'

/*
 * lib/projects.ts wraps its readers in React's `cache()`, which is only
 * callable inside a server render -- importing it in plain Node throws
 * "(0, cache) is not a function" before any test body runs. buildEntries never
 * calls them (it takes its inputs as arguments, which is the point), so a stub
 * is enough. `ProjectMeta` is a type-only import and is erased.
 *
 * Must be declared before the import of @lib/work, which pulls the module in.
 */
vi.mock('@lib/projects', () => ({
  getAllProjects: () => [],
  getProjectBySlug: () => null,
}))

import { experience, upworkProjects, type ExperienceEntry } from '@lib/experience'
import type { ProjectMeta } from '@lib/projects'
import type { PullRequest } from '@lib/github'
import { buildEntries, countEntries, monthYearToISO } from '@lib/work'

/**
 * Unit coverage for the /work join.
 *
 * `scripts/e2e-work.mjs` proves the PAGE works, but it needs a build and a
 * browser and it can only see the one dataset that happens to be on disk. The
 * things worth testing here are the ones it cannot reach: the date parser
 * against every real value, the two build-time throws, the clustering, and the
 * ordering invariant. The bug audit on 2026-10-26 flagged the absence of this
 * file as its own finding -- a parser plus two throws plus a comparator, with
 * no test runner touching any of it.
 *
 * `buildEntries` takes the curated lists as optional arguments precisely so
 * these tests can pass synthetic ones instead of mocking the module.
 */

/* A project that pairs with `entry` below, so the reconciliation check passes. */
function project(slug: string, extra: Partial<ProjectMeta> = {}): ProjectMeta {
  return {
    slug,
    title: slug,
    date: '2026-01-01',
    excerpt: '',
    stack: [],
    status: 'completed',
    ...extra,
  }
}

function entry(over: Partial<ExperienceEntry> = {}): ExperienceEntry {
  return {
    role: 'Engineer',
    start: 'Jan 2026',
    end: 'Present',
    summary: 's',
    stack: [],
    ...over,
  }
}

function pr(over: Partial<PullRequest> = {}): PullRequest {
  return {
    number: 1,
    title: 't',
    html_url: 'https://github.com/o/r/pull/1',
    state: 'closed',
    merged_at: '2026-01-02T00:00:00Z',
    created_at: '2026-01-01T00:00:00Z',
    repository: { full_name: 'o/r', html_url: 'https://github.com/o/r' },
    ...over,
  }
}

describe('monthYearToISO', () => {
  it('parses every start date in the real curated data', () => {
    const all = [...experience, ...upworkProjects]
    expect(all.length).toBeGreaterThan(0)
    for (const e of all) {
      expect(monthYearToISO(e.start), `start of "${e.role}" (${e.start})`).toMatch(/^\d{4}-\d{2}$/)
    }
  })

  it('returns null for the open-ended end values the data actually uses', () => {
    /* These are display strings, never sort keys. If one of them ever started
       parsing, it would mean the regex had been loosened into something that
       also accepts prose. */
    expect(monthYearToISO('Present')).toBeNull()
    expect(monthYearToISO('work completed')).toBeNull()
  })

  it('maps months to the right number, not the alphabetical position', () => {
    expect(monthYearToISO('Jan 2021')).toBe('2021-01')
    expect(monthYearToISO('Jun 2020')).toBe('2020-06')
    expect(monthYearToISO('Oct 2021')).toBe('2021-10')
    expect(monthYearToISO('Dec 2025')).toBe('2025-12')
  })

  it('tolerates longer and differently-cased month names', () => {
    expect(monthYearToISO('June 2020')).toBe('2020-06')
    expect(monthYearToISO('Sept 2023')).toBe('2023-09')
    expect(monthYearToISO('  JUL 2024 ')).toBe('2024-07')
  })

  it('rejects malformed input rather than inventing a month', () => {
    for (const bad of ['', '2021-10', 'Xyz 2021', 'Oct', '2021', 'Oct 21', 'Octopus']) {
      expect(monthYearToISO(bad), bad).toBeNull()
    }
  })
})

describe('buildEntries — the two build-time throws', () => {
  it('throws when a project belongs to no engagement', () => {
    expect(() => buildEntries([project('Orphan')], [], [], [])).toThrowError(
      /1 project\(s\) belong to no engagement: Orphan/,
    )
  })

  it('names every orphan, so one build surfaces all of them', () => {
    expect(() => buildEntries([project('A'), project('B')], [], [], [])).toThrowError(/A, B/)
  })

  it('throws when an entry claims a project that does not exist', () => {
    const claims = entry({ link: { href: '/projects/Nope/introduction', label: 'x' } })
    expect(() => buildEntries([], [], [claims], [])).toThrowError(
      /claims project "Nope", which does not exist/,
    )
  })

  it('throws when two engagements claim the same project', () => {
    /* Reachable only because pairing is link-driven: both entries are
       individually valid and the orphan check below would still pass, so
       without this guard the same writeup link renders on two rows. */
    const link = { href: '/projects/Shared/introduction', label: 'x' }
    const a = entry({ role: 'A', link })
    const b = entry({ role: 'B', link })
    expect(() => buildEntries([project('Shared')], [], [a, b], [])).toThrowError(
      /"Shared" is claimed by more than one engagement \(latest: "B"\)/,
    )
  })

  it('accepts the real data as it stands', () => {
    /* The guard against this test suite drifting from the shipped content:
       every project in content/projects must pair with a curated entry. */
    const slugs = [...experience, ...upworkProjects]
      .map((e) => e.link?.href.match(/^\/projects\/([^/]+)/)?.[1])
      .filter((s): s is string => Boolean(s))
    expect(() => buildEntries(slugs.map((s) => project(s)), [])).not.toThrow()
  })
})

describe('buildEntries — absorption', () => {
  it('marks an engagement that owns a writeup, and only that one', () => {
    const owner = entry({
      role: 'Owner',
      link: { href: '/projects/P/introduction', label: 'Project writeup' },
    })
    const plain = entry({ role: 'Plain' })
    const out = buildEntries([project('P')], [], [owner, plain], [])

    const byTitle = (t: string) => out.find((e) => e.title === t)!
    expect(byTitle('Owner').hasWriteup).toBe(true)
    expect(byTitle('Plain').hasWriteup).toBe(false)
  })

  it('keeps the ENTRY href as the writeup link rather than rewriting it', () => {
    /* The entry is the more specific destination and is what claimed the
       project. Falling through to the project's own `link` silently sent
       /projects/P/architecture to /projects/P. */
    const owner = entry({ link: { href: '/projects/P/architecture', label: 'Project writeup' } })
    const [built] = buildEntries([project('P', { link: '/projects/P/introduction' })], [], [owner], [])
    expect(built.links[0].href).toBe('/projects/P/architecture')
  })

  it("surfaces the project's repo alongside the writeup, so pairing is lossless", () => {
    const owner = entry({ link: { href: '/projects/P/introduction', label: 'Project writeup' } })
    const [built] = buildEntries(
      [project('P', { github: 'https://github.com/o/p' })],
      [],
      [owner],
      [],
    )
    expect(built.links.map((l) => [l.label, l.external])).toEqual([
      ['Project writeup', false],
      ['GitHub', true],
    ])
  })

  it('keeps an entry-only external link when there is no project', () => {
    const e = entry({ link: { href: 'https://example.com', label: 'GitHub' } })
    const [built] = buildEntries([], [], [e], [])
    expect(built.links).toEqual([{ href: 'https://example.com', label: 'GitHub', external: true }])
  })

  it('tags Upwork engagements and leaves direct ones untagged', () => {
    const out = buildEntries([], [], [entry({ role: 'D' })], [entry({ role: 'U' })])
    expect(out.find((e) => e.title === 'D')!.channel).toBeUndefined()
    expect(out.find((e) => e.title === 'U')!.channel).toBe('upwork')
  })
})

describe('buildEntries — upstream clustering', () => {
  it('collapses every PR to one row per repository', () => {
    const prs = [
      pr({ number: 1, repository: { full_name: 'a/x', html_url: 'https://github.com/a/x' } }),
      pr({ number: 2, repository: { full_name: 'a/x', html_url: 'https://github.com/a/x' } }),
      pr({ number: 3, repository: { full_name: 'b/y', html_url: 'https://github.com/b/y' } }),
    ]
    const clusters = buildEntries([], prs, [], []).filter((e) => e.kind === 'upstream')
    expect(clusters).toHaveLength(2)
    expect(clusters.find((c) => c.title === 'a/x')!.cluster!.prs).toHaveLength(2)
  })

  it('counts merged, open and closed separately', () => {
    const prs = [
      pr({ number: 1, merged_at: '2026-01-02T00:00:00Z' }),
      pr({ number: 2, merged_at: null, state: 'open' }),
      pr({ number: 3, merged_at: null, state: 'closed' }),
    ]
    const [cluster] = buildEntries([], prs, [], [])
    expect(cluster.cluster).toMatchObject({ merged: 1, open: 1, closed: 1 })
  })

  it('labels a single year plainly and a span as a range', () => {
    const one = buildEntries([], [pr({ created_at: '2026-03-01T00:00:00Z' })], [], [])
    expect(one[0].dateLabel).toBe('2026')

    const span = buildEntries(
      [],
      [pr({ number: 1, created_at: '2026-03-01T00:00:00Z' }), pr({ number: 2, created_at: '2020-11-01T00:00:00Z' })],
      [],
      [],
    )
    expect(span[0].dateLabel).toBe('2020 — 2026')
  })

  it('sorts PRs within a repo newest first and keys the cluster on the newest', () => {
    const prs = [
      pr({ number: 1, created_at: '2024-01-01T00:00:00Z' }),
      pr({ number: 2, created_at: '2026-05-01T00:00:00Z' }),
    ]
    const [cluster] = buildEntries([], prs, [], [])
    expect(cluster.cluster!.prs.map((p) => p.number)).toEqual([2, 1])
    expect(cluster.sortKey).toBe('2026-05')
  })

  it('orders PRs deterministically when timestamps tie', () => {
    /* A 2-way comparator returns -1 for both cmp(a,b) and cmp(b,a) on equal
       values, which is not a total order and leaves the result unspecified --
       and `sorted[0]` feeds both sortKey and repoUrl. A batch push to one repo
       produces identical timestamps. */
    const same = '2026-02-02T00:00:00Z'
    const prs = [1, 2, 3, 4, 5].map((n) => pr({ number: n, created_at: same }))
    const first = buildEntries([], prs, [], [])[0].cluster!.prs.map((p) => p.number)
    const again = buildEntries([], prs.slice(), [], [])[0].cluster!.prs.map((p) => p.number)
    expect(first).toEqual(again)
    expect(first).toHaveLength(5)
  })

  it('returns no clusters at all for an empty PR list', () => {
    /* The reachable degraded build: lib/github.ts publishes [] rather than
       failing when the search API rate-limits or times out. The page relies on
       this being empty, not a one-row placeholder, to omit the rail. */
    expect(buildEntries([], [], [], [])).toEqual([])
  })
})

describe('buildEntries — ordering and identity', () => {
  it('sorts strictly newest-first across both kinds', () => {
    const out = buildEntries(
      [],
      [pr({ created_at: '2023-06-01T00:00:00Z' })],
      [entry({ role: 'New', start: 'Jul 2026' }), entry({ role: 'Old', start: 'Feb 2020' })],
      [],
    )
    expect(out.map((e) => e.sortKey)).toEqual(['2026-07', '2023-06', '2020-02'])
  })

  it('is a total order — equal keys do not reshuffle between runs', () => {
    const mk = () => [entry({ role: 'A', start: 'Jan 2026' }), entry({ role: 'B', start: 'Jan 2026' })]
    expect(buildEntries([], [], mk(), []).map((e) => e.title)).toEqual(
      buildEntries([], [], mk(), []).map((e) => e.title),
    )
  })

  it('sorts an unparseable start last rather than throwing', () => {
    const out = buildEntries([], [], [entry({ role: 'Bad', start: 'sometime' }), entry({ role: 'Ok' })], [])
    expect(out[out.length - 1].title).toBe('Bad')
  })

  it('gives every entry a unique id, including same-titled roles at different orgs', () => {
    /* ids key React lists. The role titles in the real data are generic
       ("Network Engineer", "Blockchain Developer"), so org is what separates
       them -- keying on role alone collided. */
    const out = buildEntries(
      [],
      [],
      [entry({ role: 'Engineer', org: 'One' }), entry({ role: 'Engineer', org: 'Two' })],
      [],
    )
    expect(new Set(out.map((e) => e.id)).size).toBe(out.length)
  })

  it('keeps repo ids distinct where a slug would have collapsed them', () => {
    const prs = [
      pr({ number: 1, repository: { full_name: 'ethereum-optimism/actions', html_url: 'u' } }),
      pr({ number: 2, repository: { full_name: 'ethereum/optimism-actions', html_url: 'u' } }),
    ]
    const ids = buildEntries([], prs, [], []).map((e) => e.id)
    expect(new Set(ids).size).toBe(2)
  })

  it('renders dateLabel from the source strings verbatim', () => {
    const [built] = buildEntries([], [], [entry({ start: 'Oct 2021', end: 'Dec 2025' })], [])
    expect(built.dateLabel).toBe('Oct 2021 — Dec 2025')
  })
})

describe('countEntries', () => {
  it('counts each pill independently, with Built a subset of Roles', () => {
    const owner = entry({ role: 'O', link: { href: '/projects/P/introduction', label: 'w' } })
    const out = buildEntries([project('P')], [pr()], [owner, entry({ role: 'X' })], [])
    expect(countEntries(out)).toEqual({ all: 3, built: 1, engagements: 2, upstream: 1 })
  })

  it('reports zero upstream for a degraded build, which is what hides the rail', () => {
    expect(countEntries(buildEntries([], [], [entry()], []))).toMatchObject({
      upstream: 0,
      engagements: 1,
    })
  })
})
