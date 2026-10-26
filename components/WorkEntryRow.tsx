import Link from 'next/link'
import { ExternalLink, GitMerge, GitPullRequest, GitPullRequestClosed } from 'lucide-react'
import type { WorkEntry } from '@lib/work'

/*
 * One row of the /work spine. A server component on purpose -- the whole page
 * is server-rendered and its only interactivity (the kind filter, the upstream
 * disclosures) is CSS and native <details>, so nothing here needs 'use client'.
 *
 * `data-writeup` is what the "Built" filter rule in globals.css selects on --
 * do not rename it without changing that rule. There is no `data-kind`: it was
 * written here and read by nothing (the other filters hide whole COLUMNS,
 * `.work-spine` / `.work-rail`, not individual rows), and the comment claiming
 * it was load-bearing was wrong. It cost ~24 bytes per row twice over, since
 * Next inlines the RSC flight payload beside the markup.
 */

const STATUS_ICON = {
  merged: GitMerge,
  open: GitPullRequest,
  closed: GitPullRequestClosed,
} as const

function Stack({ stack }: { stack: string[] }) {
  if (stack.length === 0) return null
  return (
    <>
      {stack.map((tech) => (
        <span
          key={tech}
          className="font-mono text-xs px-2 py-0.5 border border-border text-muted rounded-sm"
        >
          {tech}
        </span>
      ))}
    </>
  )
}

function EntryLink({ href, label, external }: { href: string; label: string; external: boolean }) {
  const className =
    'font-mono text-xs text-muted hover:text-accent tracking-wider transition-colors duration-200'

  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {label} ↗<span className="sr-only"> (opens in new tab)</span>
      </a>
    )
  }

  return (
    <Link href={href} className={className}>
      {label} →
    </Link>
  )
}

function UpstreamCluster({ entry }: { entry: WorkEntry }) {
  const cluster = entry.cluster
  if (!cluster) return null

  const counts = [
    cluster.merged > 0 ? `${cluster.merged} merged` : null,
    cluster.open > 0 ? `${cluster.open} open` : null,
    cluster.closed > 0 ? `${cluster.closed} closed` : null,
  ].filter(Boolean)

  return (
    <details className="border border-border rounded-sm px-4 py-3 bg-surface/30">
      <summary className="work-summary font-mono text-sm text-text cursor-pointer flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-accent" aria-hidden="true">
          ↗
        </span>
        <span className="min-w-0 break-words">{cluster.repo}</span>
        <span className="text-muted text-xs">{counts.join(' · ')}</span>
      </summary>

      <ul className="mt-3 space-y-1.5">
        {cluster.prs.map((pr) => {
          const Icon = STATUS_ICON[pr.status]
          return (
            <li key={pr.number} className="font-mono text-xs leading-relaxed">
              <a
                href={pr.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted hover:text-accent transition-colors duration-200 inline-flex items-start gap-1.5"
              >
                <Icon size={12} className="mt-0.5 shrink-0" aria-hidden="true" />
                <span>
                  {/* Inherits the link's `text-muted`. It was `text-border`
                      (42 42 42), which composites to 1.42:1 against this row's
                      bg-surface/30 -- effectively invisible, and a PR number is
                      content, not a separator. `--border` is gated with a
                      contrast WINDOW against --bg and never a text floor, so no
                      palette makes it readable; `text-muted` measures 5.90:1.
                      The `text-border` uses elsewhere are decorative `·`. */}
                  <span>#{pr.number}</span> {pr.title}
                  <span className="sr-only"> ({pr.status}, opens in new tab)</span>
                </span>
              </a>
            </li>
          )
        })}
      </ul>

      <a
        href={cluster.repoUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="font-mono text-xs text-muted hover:text-accent tracking-wider transition-colors duration-200 inline-flex items-center gap-1.5 mt-3"
      >
        {cluster.repo}
        <ExternalLink size={11} aria-hidden="true" />
        <span className="sr-only"> (opens in new tab)</span>
      </a>
    </details>
  )
}

/*
 * `rail` is the narrow variant used by the upstream column at lg (see
 * .work-layout in globals.css). The only difference is the date gutter: the
 * spine puts the date in a 6rem grid column at sm and up, which a ~272px rail
 * cannot spare, so the rail stacks it above instead. Everything else is shared
 * deliberately -- the left rule, the hover and the disclosure are the same
 * component in both places.
 *
 * In practice the page pairs them one-to-one -- engagements render as `spine`
 * and clusters as `rail` -- so the cluster-in-a-spine and engagement-in-a-rail
 * combinations never occur. The branch stays general rather than being split
 * into two components because the shared half is most of the file.
 */
export default function WorkEntryRow({
  entry,
  variant = 'spine',
}: {
  entry: WorkEntry
  variant?: 'spine' | 'rail'
}) {
  const isUpstream = entry.kind === 'upstream'

  return (
    <li
      {...(entry.hasWriteup ? { 'data-writeup': '' } : {})}
      className={`border-l-[3px] border-border hover:border-accent transition-colors duration-200 pl-5 ${
        variant === 'rail'
          ? ''
          : 'sm:pl-6 sm:grid sm:grid-cols-[6rem_minmax(0,1fr)] sm:gap-x-6'
      }`}
    >
      <span className="block font-mono text-xs text-muted tracking-widest uppercase sm:pt-1 leading-relaxed">
        {entry.dateLabel}
      </span>

      <div className="min-w-0">
        {isUpstream ? (
          <UpstreamCluster entry={entry} />
        ) : (
          <>
            <h2 className="font-mono text-lg text-text mt-1 sm:mt-0 mb-0.5 leading-snug flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="text-accent" aria-hidden="true">
                {entry.hasWriteup ? '◆' : '▸'}
              </span>
              <span className="min-w-0">{entry.title}</span>
              {entry.channel === 'upwork' && (
                <span className="font-mono text-[0.625rem] tracking-widest uppercase text-muted border border-border rounded-sm px-1.5 py-0.5">
                  Upwork
                </span>
              )}
            </h2>

            {entry.org && (
              <p className="font-mono text-sm text-accent mb-3">
                {entry.orgLink ? (
                  <a
                    href={entry.orgLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-accent-dim transition-colors underline underline-offset-4"
                  >
                    {entry.org}
                    <span className="sr-only"> (opens in new tab)</span>
                  </a>
                ) : (
                  entry.org
                )}
              </p>
            )}

            {entry.summary && (
              <p className="font-sans text-base text-text leading-[1.75] mb-4">{entry.summary}</p>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <Stack stack={entry.stack} />
              {entry.links.map((link) => (
                <span key={link.href} className="ml-1">
                  <EntryLink {...link} />
                </span>
              ))}
            </div>
          </>
        )}
      </div>
    </li>
  )
}
