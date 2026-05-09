'use client'

import { useEffect, useState } from 'react'
import { ExternalLink, GitPullRequest, GitMerge, GitPullRequestClosed } from 'lucide-react'
import { getOpenSourcePRs, getPRStatus, type PullRequest, type PRStatus } from '@lib/github'

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]+`/g, '')
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/#{1,6}\s+/g, '')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*>\s+/gm, '')
    .replace(/\n{2,}/g, ' ')
    .replace(/\n/g, ' ')
    .trim()
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return text.slice(0, max).trimEnd() + '…'
}

const statusConfig: Record<
  PRStatus,
  {
    label: string
    className: string
    Icon: React.ComponentType<{ size?: number; className?: string }>
  }
> = {
  merged: {
    label: 'Merged',
    className: 'text-accent border-accent/40 bg-accent/10',
    Icon: GitMerge,
  },
  open: {
    label: 'Open',
    className: 'text-green-400 border-green-400/40 bg-green-400/10',
    Icon: GitPullRequest,
  },
  closed: {
    label: 'Closed',
    className: 'text-muted border-border bg-surface',
    Icon: GitPullRequestClosed,
  },
}

function PRCard({ pr }: { pr: PullRequest }) {
  const status = getPRStatus(pr)
  const { label, className, Icon } = statusConfig[status]
  const description = pr.body ? truncate(stripMarkdown(pr.body), 220) : null

  return (
    <article className="border border-border rounded-sm p-6 bg-surface/20 hover:border-accent/40 transition-all duration-300">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <a
          href={pr.repository.html_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 font-mono text-xs text-muted hover:text-accent transition-colors duration-200 tracking-wider"
        >
          {pr.repository.full_name}
          <ExternalLink size={11} />
        </a>

        <span
          className={`flex items-center gap-1.5 font-mono text-xs px-2.5 py-1 border rounded-full ${className}`}
        >
          <Icon size={12} />
          {label}
        </span>
      </div>

      <a
        href={pr.html_url}
        target="_blank"
        rel="noopener noreferrer"
        className="group block mb-3"
      >
        <h3 className="font-mono text-lg tracking-tight text-text group-hover:text-accent transition-colors duration-200 leading-snug">
          <span className="text-muted mr-2">#{pr.number}</span>
          {pr.title}
        </h3>
      </a>

      {description && (
        <p className="font-sans text-sm text-muted leading-relaxed mb-4">{description}</p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {pr.labels.map((lbl) => (
            <span
              key={lbl.name}
              className="font-mono text-xs px-2 py-0.5 border border-border text-muted rounded-sm"
            >
              {lbl.name}
            </span>
          ))}
        </div>
        <time className="font-mono text-xs text-muted tracking-wider">
          {formatDate(pr.created_at)}
        </time>
      </div>
    </article>
  )
}

function SkeletonCard() {
  return (
    <div className="border border-border rounded-sm p-6 bg-surface/20 animate-pulse">
      <div className="flex justify-between mb-3">
        <div className="h-3 w-32 bg-border rounded" />
        <div className="h-5 w-16 bg-border rounded-full" />
      </div>
      <div className="h-5 w-3/4 bg-border rounded mb-3" />
      <div className="h-3 w-full bg-border rounded mb-2" />
      <div className="h-3 w-2/3 bg-border rounded" />
    </div>
  )
}

export default function ContributionsPage() {
  const [prs, setPrs] = useState<PullRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    getOpenSourcePRs()
      .then(setPrs)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  const merged = prs.filter((pr) => getPRStatus(pr) === 'merged')
  const open = prs.filter((pr) => getPRStatus(pr) === 'open')
  const closed = prs.filter((pr) => getPRStatus(pr) === 'closed')

  return (
    <main className="pt-24 pb-32 px-6">
      <div className="max-w-chrome mx-auto">
        <div className="mb-16">
          <h1 className="font-mono text-4xl sm:text-5xl tracking-tight text-text mb-4">
            Contributions.
          </h1>
          <p className="font-sans text-lg text-muted leading-relaxed max-w-[560px]">
            Open source pull requests — descriptions sourced live from GitHub.
          </p>

          {!loading && !error && (
            <div className="flex flex-wrap gap-6 mt-8 font-mono text-sm text-muted">
              <span>
                <span className="text-accent font-bold">{merged.length}</span> merged
              </span>
              <span>
                <span className="text-green-400 font-bold">{open.length}</span> open
              </span>
              {closed.length > 0 && (
                <span>
                  <span className="font-bold">{closed.length}</span> closed
                </span>
              )}
            </div>
          )}
        </div>

        {loading && (
          <div className="grid gap-4">
            {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        )}

        {error && (
          <p className="font-mono text-sm text-muted">
            Could not load contributions — GitHub API may be rate-limited. Try again shortly.
          </p>
        )}

        {!loading && !error && prs.length === 0 && (
          <p className="font-sans text-muted">No contributions found — check back soon.</p>
        )}

        {!loading && !error && prs.length > 0 && (
          <div className="space-y-16">
            {open.length > 0 && (
              <section>
                <h2 className="font-mono text-sm tracking-widest uppercase text-muted mb-6 pl-1 border-l-2 border-green-400">
                  Open
                </h2>
                <div className="grid gap-4">
                  {open.map((pr) => <PRCard key={pr.id} pr={pr} />)}
                </div>
              </section>
            )}

            {merged.length > 0 && (
              <section>
                <h2 className="font-mono text-sm tracking-widest uppercase text-muted mb-6 pl-1 border-l-2 border-accent">
                  Merged
                </h2>
                <div className="grid gap-4">
                  {merged.map((pr) => <PRCard key={pr.id} pr={pr} />)}
                </div>
              </section>
            )}

            {closed.length > 0 && (
              <section>
                <h2 className="font-mono text-sm tracking-widest uppercase text-muted mb-6 pl-1 border-l-2 border-border">
                  Closed
                </h2>
                <div className="grid gap-4">
                  {closed.map((pr) => <PRCard key={pr.id} pr={pr} />)}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
