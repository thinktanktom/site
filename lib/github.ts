/*
 * Only what /work actually renders. `id`, `body` and `labels` were dropped on
 * 2026-10-26 with the /contributions page that was their sole consumer: it used
 * `id` as a React key (clusters key on `number`), `body` for a stripped-down
 * excerpt, and `labels` for chips. Carrying `body` also meant ~1KB x 50 PRs of
 * build-time payload for nothing, and `labels[].color` was the one place in the
 * codebase that rendered a raw GitHub hex, which the "never hardcode a colour"
 * rule forbids. Re-add a field here only together with something that reads it.
 */
export interface PullRequest {
  number: number
  title: string
  html_url: string
  state: 'open' | 'closed'
  merged_at: string | null
  created_at: string
  repository: {
    full_name: string
    html_url: string
  }
}

export type PRStatus = 'merged' | 'open' | 'closed'

export function getPRStatus(pr: PullRequest): PRStatus {
  if (pr.merged_at) return 'merged'
  if (pr.state === 'open') return 'open'
  return 'closed'
}

/* The wire shape, narrowed to the fields that are actually mapped. The response
   carries far more; declaring only what is read keeps this honest about the
   dependency surface. `id`, `body` and `labels` went with PullRequest's copies
   on 2026-10-26 -- see the note there. */
interface GitHubSearchIssueItem {
  number: number
  title: string
  html_url: string
  state: 'open' | 'closed'
  created_at: string
  repository_url?: string
  pull_request?: { merged_at: string | null }
}

/*
 * Runs at BUILD time, in Node, never in the browser. That is what keeps the
 * token below out of the bundle — do not import this from a client component.
 *
 * Unauthenticated search is 10 requests/minute against a shared per-IP pool,
 * and GitHub Actions runners share those IPs, so CI would intermittently get
 * a 403 and publish an empty page. Authenticated it is 30/minute to the repo
 * token, which one build cannot exhaust. Locally there is usually no token and
 * the unauthenticated path is fine for a single request.
 */
export async function getOpenSourcePRs(): Promise<PullRequest[]> {
  /*
   * UPSTREAM ONLY — `-user:thinktanktom` is what makes this "contributions to
   * other people's projects", which is the whole organising idea of /work's
   * rail ("Upstream · N repos"). /activity needs a broader set and uses
   * searchPRs() directly; do not merge the two queries.
   */
  return searchPRs('type:pr+author:thinktanktom+is:public+-user:thinktanktom', 50)
}

/*
 * Every PUBLIC pull request, newest first, across every repository including
 * Tom's own. Feeds /activity, which showcases recent PR activity rather than
 * upstream contribution specifically.
 *
 * `is:public` IS THE WHOLE PRIVACY MODEL HERE, and it is evaluated at build
 * time on purpose. PRs in private repositories are simply never returned, so
 * nothing about them — not a title, not a repo name, not a count, not a date —
 * can reach the page. The corollary is the useful half: when a repository is
 * made public later, its pull requests start appearing on the next build with
 * no code change and no manual list to update.
 *
 * Deliberately NOT a token-authenticated search over private repos. That would
 * need a PAT with `repo` scope in CI secrets (the Actions token is scoped to
 * this repository alone and cannot see the others), which is broad read access
 * to every private repo in exchange for a row that says nothing.
 */
export async function getRecentPRs(): Promise<PullRequest[]> {
  /* 100 is the API maximum. Beyond that this would need pagination; the count
     is 65 today, and the page renders only the most recent handful anyway. */
  return searchPRs('type:pr+author:thinktanktom+is:public', 100)
}

async function searchPRs(query: string, perPage: number): Promise<PullRequest[]> {
  const token = process.env.GITHUB_TOKEN
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
  }
  if (token) headers.Authorization = `Bearer ${token}`

  let data: { items?: GitHubSearchIssueItem[] }
  try {
    const res = await fetch(
      `https://api.github.com/search/issues?q=${query}&sort=created&order=desc&per_page=${perPage}`,
      {
        headers,
        // A rejected connection was already handled below, but nothing bounded a
        // connection that is accepted and then never answered — that would hang
        // the build indefinitely rather than degrading to an empty list. The
        // typical call measures ~0.9s, so 8s is slack rather than a tight budget.
        signal: AbortSignal.timeout(8000),
        /*
         * NO `cache: 'no-store'` HERE, and that is load-bearing. Next treats an
         * uncached fetch as a signal that the route is dynamic, so adding it
         * opts /work and /activity into server rendering — and this site is
         * `output: 'export'`, which cannot express that. Tried on 2026-11-10:
         * the build still reported "Compiled successfully", listed both routes
         * as `ƒ (Dynamic)`, and simply **did not emit activity.html**. It also
         * turned 2 logical requests into 8 real ones, which trips the
         * unauthenticated 10/min search limit on its own.
         *
         * The staleness it was meant to fix is handled by the `prebuild`
         * script instead — see package.json.
         */
      }
    )

    if (!res.ok) {
      console.warn(`[github] search returned ${res.status}; publishing an empty list`)
      return []
    }

    /* READING THE BODY IS INSIDE THE TRY, and that is the whole point of this
       shape. It used to sit after the catch, which left three reachable ways to
       FAIL the build rather than degrade:

         - a 200 whose body is truncated, so JSON.parse throws;
         - a 200 carrying an HTML interstitial or captcha, which is how
           rate limiting on a shared runner IP commonly presents;
         - and the very case the 8s timeout was added for — a connection that
           is accepted, answers headers, then never finishes the body. fetch()
           RESOLVES there, so the old catch had already been passed, and the
           AbortSignal fired out of res.json() instead.

       The comment that used to sit on the signal asserted the opposite ("which
       the same catch takes"). True for the connection phase, false for the body
       read. CLAUDE.md and MEMORY.md both state degrade-to-empty as a contract,
       and the CI path (shared Actions runner IPs) is where it matters. */
    data = (await res.json()) as { items?: GitHubSearchIssueItem[] }
  } catch {
    // The build must not fail because GitHub is unreachable, too slow, or
    // answering with something that is not the JSON it promised.
    console.warn('[github] unreachable, timed out or unreadable; publishing an empty list')
    return []
  }

  return (data.items ?? []).flatMap((item) => {
    const repoMatch = item.repository_url?.match(/repos\/(.+)$/)
    const repoFullName = repoMatch ? repoMatch[1] : ''
    /* An item we cannot name a repo for is DROPPED rather than emitted with an
       empty name. lib/work.ts clusters by full_name, so an empty one collapses
       every such PR into a single unnamed row with href="" (which re-navigates
       to /work) and a wrong "Upstream · N repos" count. `repository_url` is
       optional in the wire type, so this is reachable from a malformed page of
       results rather than only from a total failure. */
    if (!repoFullName) return []
    const repoHtmlUrl = `https://github.com/${repoFullName}`

    return {
      number: item.number,
      title: item.title,
      html_url: item.html_url,
      state: item.state,
      merged_at: item.pull_request?.merged_at ?? null,
      created_at: item.created_at,
      repository: {
        full_name: repoFullName,
        html_url: repoHtmlUrl,
      },
    }
  })
}
