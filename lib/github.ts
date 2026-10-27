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
  const token = process.env.GITHUB_TOKEN
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
  }
  if (token) headers.Authorization = `Bearer ${token}`

  let data: { items?: GitHubSearchIssueItem[] }
  try {
    const res = await fetch(
      'https://api.github.com/search/issues?q=type:pr+author:thinktanktom+is:public+-user:thinktanktom&sort=created&order=desc&per_page=50',
      // A rejected connection was already handled below, but nothing bounded a
      // connection that is accepted and then never answered — that would hang
      // the build indefinitely rather than degrading to an empty list. The
      // typical call measures ~0.9s, so 8s is slack rather than a tight budget.
      { headers, signal: AbortSignal.timeout(8000) }
    )

    if (!res.ok) {
      console.warn(`[work] GitHub returned ${res.status}; publishing an empty list`)
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
    console.warn('[work] GitHub unreachable, timed out or unreadable; publishing an empty list')
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
