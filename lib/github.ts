export interface PullRequest {
  id: number
  number: number
  title: string
  body: string | null
  html_url: string
  state: 'open' | 'closed'
  merged_at: string | null
  created_at: string
  repository: {
    full_name: string
    html_url: string
  }
  labels: Array<{ name: string; color: string }>
}

export type PRStatus = 'merged' | 'open' | 'closed'

export function getPRStatus(pr: PullRequest): PRStatus {
  if (pr.merged_at) return 'merged'
  if (pr.state === 'open') return 'open'
  return 'closed'
}

interface GitHubSearchIssueItem {
  id: number
  number: number
  title: string
  body: string | null
  html_url: string
  state: 'open' | 'closed'
  created_at: string
  repository_url?: string
  pull_request?: { merged_at: string | null }
  labels?: Array<{ name: string; color: string }>
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

  let res: Response
  try {
    res = await fetch(
      'https://api.github.com/search/issues?q=type:pr+author:thinktanktom+is:public+-user:thinktanktom&sort=created&order=desc&per_page=50',
      // A rejected connection was already handled below, but nothing bounded a
      // connection that is accepted and then never answered — that would hang
      // the build indefinitely rather than degrading to an empty list. The
      // typical call measures ~0.9s, so 8s is slack rather than a tight budget.
      // AbortSignal.timeout throws a TimeoutError, which the same catch takes.
      { headers, signal: AbortSignal.timeout(8000) }
    )
  } catch {
    // The build must not fail because GitHub is unreachable or too slow.
    console.warn('[contributions] GitHub unreachable or timed out; publishing an empty list')
    return []
  }

  if (!res.ok) {
    console.warn(`[contributions] GitHub returned ${res.status}; publishing an empty list`)
    return []
  }

  const data = (await res.json()) as { items?: GitHubSearchIssueItem[] }

  return (data.items ?? []).map((item) => {
    const repoMatch = item.repository_url?.match(/repos\/(.+)$/)
    const repoFullName = repoMatch ? repoMatch[1] : ''
    const repoHtmlUrl = repoFullName
      ? `https://github.com/${repoFullName}`
      : (item.repository_url ?? '')

    return {
      id: item.id,
      number: item.number,
      title: item.title,
      body: item.body ?? null,
      html_url: item.html_url,
      state: item.state,
      merged_at: item.pull_request?.merged_at ?? null,
      created_at: item.created_at,
      repository: {
        full_name: repoFullName,
        html_url: repoHtmlUrl,
      },
      labels: item.labels ?? [],
    }
  })
}
