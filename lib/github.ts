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

export async function getOpenSourcePRs(): Promise<PullRequest[]> {
  const res = await fetch(
    'https://api.github.com/search/issues?q=type:pr+author:thinktanktom+is:public+-user:thinktanktom&sort=created&order=desc&per_page=50',
    { headers: { Accept: 'application/vnd.github.v3+json' } }
  )

  if (!res.ok) return []

  const data = await res.json()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data.items ?? []).map((item: any) => {
    const repoMatch = item.repository_url?.match(/repos\/(.+)$/)
    const repoFullName = repoMatch ? repoMatch[1] : ''
    const repoHtmlUrl = repoFullName
      ? `https://github.com/${repoFullName}`
      : item.repository_url

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
