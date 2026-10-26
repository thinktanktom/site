import { experience, upworkProjects, type ExperienceEntry } from '@lib/experience'
import { getAllProjects, type ProjectMeta } from '@lib/projects'
import { getOpenSourcePRs, getPRStatus, type PullRequest, type PRStatus } from '@lib/github'

/*
 * The join behind /work, which replaced /projects, /experience and
 * /contributions on 2026-10-26.
 *
 * This is the ONLY module that knows how the three content sets relate. The
 * three sources stay independent and unchanged -- lib/experience.ts is still a
 * curated list, lib/projects.ts still reads MDX frontmatter, lib/github.ts is
 * still a build-time fetch -- so each can be edited without reasoning about
 * the merged page.
 *
 * Two shapes come out, not three: an `engagement` (a role or an Upwork
 * contract, carrying its project writeup when it has one) and an `upstream`
 * cluster (every PR to one repository, as a single row). There is deliberately
 * no standalone `project` kind: every writeup belongs to an engagement, which
 * the reconciliation check at the bottom of buildEntries() enforces.
 *
 * getWorkEntries is async only because the PR half is a network fetch. Keep it
 * server-side -- it pulls in lib/github.ts, which reads process.env.GITHUB_TOKEN.
 */

export type WorkKind = 'engagement' | 'upstream'

export interface WorkClusterPR {
  number: number
  title: string
  url: string
  status: PRStatus
}

export interface WorkCluster {
  repo: string
  repoUrl: string
  merged: number
  open: number
  closed: number
  prs: WorkClusterPR[]
}

export interface WorkLink {
  href: string
  label: string
  external: boolean
}

export interface WorkEntry {
  id: string
  kind: WorkKind
  /* "yyyy-mm", for sorting only -- never rendered */
  sortKey: string
  /* the source strings verbatim, so the merge never re-words Tom's copy */
  dateLabel: string
  title: string
  org?: string
  orgLink?: string
  summary?: string
  stack: string[]
  /* drives the ◆ glyph and the "Built" filter */
  hasWriteup: boolean
  links: WorkLink[]
  channel?: 'upwork'
  cluster?: WorkCluster
}

/*
 * There is deliberately NO slug->entry pairing table. Every project is absorbed
 * by one generic rule -- an experience entry whose own `link.href` points into
 * /projects/ owns that writeup -- and all SEVEN now arrive that way.
 *
 * A one-entry `PROJECT_PAIRINGS` map existed briefly for BasedAgents, whose
 * Upwork entry linked to GitHub instead. It was removed on 2026-10-26 by fixing
 * the data rather than special-casing it: that entry's link now points at the
 * writeup, and the repo is surfaced from the project's own `github` frontmatter
 * (see toEngagement), so nothing was lost. Prefer that fix if an eighth project
 * ever fails to pair -- a hand-maintained table nothing validates is exactly
 * the failure mode the reconciliation check at the bottom of buildEntries()
 * exists to catch.
 */

const MONTHS: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
}

/*
 * lib/experience.ts stores dates as display strings ("Oct 2021", "Present",
 * "work completed") because they are rendered verbatim. Sorting needs an
 * orderable key, so parse what parses and return null for the rest -- callers
 * sort nulls last rather than throwing, since an unparseable START would be the
 * only real problem and there are none today.
 */
export function monthYearToISO(value: string): string | null {
  const match = /^([A-Za-z]{3})[a-z]*\s+(\d{4})$/.exec(value.trim())
  if (!match) return null
  const month = MONTHS[match[1].toLowerCase()]
  if (!month) return null
  return `${match[2]}-${month}`
}

function projectSlugFromHref(href: string): string | null {
  /* "/projects/BankX/introduction" -> "BankX"; external hrefs yield null */
  const match = /^\/projects\/([^/]+)/.exec(href)
  return match ? match[1] : null
}

function entryId(prefix: string, value: string): string {
  return `${prefix}-${value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`
}

/*
 * Keyed on role AND org, not role alone. All 23 ids are unique either way
 * today, but the role titles are generic -- "Network Engineer", "Blockchain
 * Developer", "Deep Learning Engineer" -- and org is the field that
 * distinguishes them. Two entries with the same title at different orgs would
 * collide into one React key. That is not abstract: the work-history record has
 * a pending entry (the Community Outreach droplet) for the SAME client as the
 * existing AgentXSD row.
 */
function engagementId(entry: ExperienceEntry): string {
  return entryId('eng', `${entry.role} ${entry.org ?? ''}`)
}

function toEngagement(
  entry: ExperienceEntry,
  project: ProjectMeta | undefined,
  channel: 'upwork' | undefined,
): WorkEntry {
  const links: WorkLink[] = []

  if (project) {
    /* The ENTRY's own href wins, because that is what claimed the project in
       the first place and it is the more specific destination. Falling straight
       through to `project.link` silently rewrote it: an entry pointing at
       /projects/Foo/architecture whose MDX carries no `link` field rendered
       /projects/Foo instead -- a wrong destination with no error. */
    links.push({
      href: entry.link?.href ?? project.link ?? `/projects/${project.slug}`,
      label: 'Project writeup',
      external: false,
    })

    /* Surface the project's repo from its own frontmatter. This is what makes
       "point the entry's link at the writeup" lossless: before it, absorbing a
       project REPLACED whatever the entry linked to, so BasedAgents would have
       traded its GitHub link for the writeup. Five of the seven projects carry
       a `github` field, so five rows gain this link. */
    if (project.github) {
      links.push({ href: project.github, label: 'GitHub', external: true })
    }
  }

  /* The entry's own link is kept when it is NOT the writeup link we just added
     -- an external repo or site on an entry with no project of its own. */
  if (entry.link && !projectSlugFromHref(entry.link.href)) {
    links.push({
      href: entry.link.href,
      label: entry.link.label,
      external: entry.link.href.startsWith('http'),
    })
  }

  return {
    id: engagementId(entry),
    kind: 'engagement',
    sortKey: monthYearToISO(entry.start) ?? '0000-00',
    dateLabel: `${entry.start} — ${entry.end}`,
    title: entry.role,
    org: entry.org,
    orgLink: entry.orgLink,
    summary: entry.summary,
    /* The entry's curated stack, not the project's: frontmatter stacks run to
       nine items and would swamp the row with chips. */
    stack: entry.stack,
    hasWriteup: Boolean(project),
    links,
    channel,
  }
}

function toClusters(prs: PullRequest[]): WorkEntry[] {
  /* Grouped with a plain record plus an explicit key order rather than a Map:
     tsconfig targets es5 without downlevelIteration, so spreading a
     `Map.entries()` iterator is a compile error here. */
  const byRepo: Record<string, PullRequest[]> = {}
  const order: string[] = []

  for (const pr of prs) {
    const repo = pr.repository.full_name
    if (byRepo[repo]) byRepo[repo].push(pr)
    else {
      byRepo[repo] = [pr]
      order.push(repo)
    }
  }

  return order.map((repo) => {
    /* A 3-way comparator, not `a < b ? 1 : -1`. For two PRs opened in the same
       second -- a scripted or batch push to one repo -- the 2-way form returns
       -1 for BOTH cmp(a,b) and cmp(b,a), which is not a total order, and the
       resulting order is then unspecified. `sorted[0]` feeds both `sortKey` and
       `repoUrl`, so it would become arbitrary. Matches the shape of the
       top-level comparator in buildEntries(). */
    const sorted = byRepo[repo]
      .slice()
      .sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0))
    const years = sorted.map((pr) => pr.created_at.slice(0, 4))
    const newest = years[0]
    const oldest = years[years.length - 1]

    const counts = { merged: 0, open: 0, closed: 0 }
    for (const pr of sorted) counts[getPRStatus(pr)] += 1

    return {
      /* The raw repo name, not a slug: slugifying collapses the separators, so
         'ethereum-optimism/actions' and 'ethereum/optimism-actions' would both
         become 'up-ethereum-optimism-actions'. A React key may contain any
         character, and full_name is already unique per repo. */
      id: 'up-' + repo,
      kind: 'upstream' as const,
      /* the most recent PR in the repo, so an active repo stays near the top */
      sortKey: sorted[0].created_at.slice(0, 7),
      dateLabel: newest === oldest ? newest : `${oldest} — ${newest}`,
      title: repo,
      stack: [],
      hasWriteup: false,
      links: [],
      cluster: {
        repo,
        repoUrl: sorted[0].repository.html_url,
        ...counts,
        prs: sorted.map((pr) => ({
          number: pr.number,
          title: pr.title,
          url: pr.html_url,
          status: getPRStatus(pr),
        })),
      },
    }
  })
}

/*
 * Exported for lib/__tests__/work.test.ts, not for callers -- use
 * getWorkEntries(). Taking its two inputs as arguments is what makes this
 * module testable without `fs` or a network: the tests feed it synthetic
 * experience/project/PR data to exercise the two throws, the clustering and the
 * ordering, none of which a browser harness can reach.
 */
export function buildEntries(
  projects: ProjectMeta[],
  prs: PullRequest[],
  /* The curated lists default to the real data, so getWorkEntries() reads
     normally; the tests pass synthetic ones instead of mocking the module. */
  direct: ExperienceEntry[] = experience,
  upwork: ExperienceEntry[] = upworkProjects,
): WorkEntry[] {
  const bySlug: Record<string, ProjectMeta> = {}
  for (const project of projects) bySlug[project.slug] = project

  const absorbed: Record<string, true> = {}

  const engagementFor = (entry: ExperienceEntry, channel: 'upwork' | undefined): WorkEntry => {
    /* The one rule: an entry whose own link points into /projects/ owns that
       writeup. All seven projects arrive this way. */
    const slug = entry.link ? projectSlugFromHref(entry.link.href) : null

    if (slug && !bySlug[slug]) {
      throw new Error(
        `lib/work.ts: "${entry.role}" claims project "${slug}", which does not exist in ` +
          `content/projects/. Either the slug is wrong or the MDX file was renamed.`,
      )
    }

    /* Two entries claiming one writeup would render the same "Project writeup"
       link on two rows and still satisfy the orphan check below, so it has to
       be caught here. */
    if (slug && absorbed[slug]) {
      throw new Error(
        `lib/work.ts: project "${slug}" is claimed by more than one engagement ` +
          `(latest: "${entry.role}"). One writeup belongs to one engagement.`,
      )
    }

    if (slug) absorbed[slug] = true
    return toEngagement(entry, slug ? bySlug[slug] : undefined, channel)
  }

  const engagements = [
    ...direct.map((entry) => engagementFor(entry, undefined)),
    ...upwork.map((entry) => engagementFor(entry, 'upwork')),
  ]

  /*
   * Reconciliation. A mistyped slug or a renamed role would otherwise produce
   * an EMPTY result for that project -- a silently missing row in the static
   * export rather than a build error. This is the same failure class CLAUDE.md
   * records for DOC_PROJECTS, so it fails loudly instead.
   */
  const orphans = projects.filter((p) => !absorbed[p.slug])
  if (orphans.length > 0) {
    throw new Error(
      `lib/work.ts: ${orphans.length} project(s) belong to no engagement: ` +
        `${orphans.map((p) => p.slug).join(', ')}. Point the owning entry's link at the ` +
        `writeup -- that is the only pairing mechanism, by design (see the note above).`,
    )
  }

  return [...engagements, ...toClusters(prs)].sort((a, b) =>
    a.sortKey < b.sortKey ? 1 : a.sortKey > b.sortKey ? -1 : 0,
  )
}

export async function getWorkEntries(): Promise<WorkEntry[]> {
  const [projects, prs] = await Promise.all([
    Promise.resolve(getAllProjects()),
    getOpenSourcePRs(),
  ])
  return buildEntries(projects, prs)
}

export interface WorkCounts {
  all: number
  built: number
  engagements: number
  upstream: number
}

export function countEntries(entries: WorkEntry[]): WorkCounts {
  return {
    all: entries.length,
    built: entries.filter((e) => e.hasWriteup).length,
    engagements: entries.filter((e) => e.kind === 'engagement').length,
    upstream: entries.filter((e) => e.kind === 'upstream').length,
  }
}
