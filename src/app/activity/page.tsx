import type { Metadata } from 'next'
import Link from 'next/link'
import { getActivityGrid, formatCellDate, formatDuration } from '@lib/timelog'
import ActivityGraph from '@components/ActivityGraph'

/*
 * /activity — the tracked-hours heatmap, added 2026-11-03.
 *
 * ASYNC SERVER COMPONENT, and it must stay one for the same reason /work is:
 * getActivityGrid() pulls in lib/github.ts, whose PR fetch runs at build time
 * against process.env.GITHUB_TOKEN. The timewarrior half is a committed
 * snapshot (content/timelog.json) rather than a build-time read, because the
 * database exists only on Tom's machine and the CI runner that builds this site
 * has no access to it — scripts/sync-timelog.mjs carries the full argument.
 *
 * Nothing here is a client component. The grid's only interactivity is the
 * native `title` tooltip, so the page works with JavaScript disabled.
 */

const description =
  'Hours tracked and pull requests opened over the last twelve months, as a heatmap — what I have actually been working on, day by day.'

export const metadata: Metadata = {
  title: 'Activity',
  description,
  alternates: { canonical: '/activity' },
  openGraph: {
    title: 'Activity — thinktanktom',
    description,
    type: 'website',
    url: 'https://thinktanktom.com/activity',
    siteName: 'thinktanktom',
    images: ['/ttt_logo.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Activity — thinktanktom',
    description,
    images: ['/ttt_logo.png'],
  },
}

export default async function ActivityPage() {
  const grid = await getActivityGrid()

  /* The PR days, newest first. Derived from the grid rather than from the fetch
     so this list and the rings on the cells cannot disagree — both come from
     the same bucketing, in the snapshot's timezone. The grid is built
     column-major but its columns and the days within them are both in order, so
     flattening is chronological and one reverse puts it newest-first. */
  const prDays = grid.columns
    .flat()
    .filter((cell) => cell.prs.length > 0)
    .reverse()

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://thinktanktom.com' },
      { '@type': 'ListItem', position: 2, name: 'Activity', item: 'https://thinktanktom.com/activity' },
    ],
  }

  return (
    <main className="pt-32 pb-24 px-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* max-w-article, not max-w-chrome. The 53-column grid measures 739px, so
          it fits the reading measure with 41px to spare — there is nothing here
          that needs the chrome width, and / moved to the article measure on
          2026-10-29 for the same reason. */}
      <div className="max-w-article mx-auto">
        <h1 className="font-mono text-4xl sm:text-5xl lg:text-6xl tracking-tight mb-4 text-text">
          Activity.
        </h1>
        <p className="font-sans text-lg text-muted mb-4 leading-relaxed">
          Every hour I log with{' '}
          <a
            href="https://timewarrior.net"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent underline underline-offset-4 hover:text-accent-dim transition-colors duration-200"
          >
            timewarrior
          </a>
          , plus the days I opened a pull request upstream. Darker is a longer
          day; a ring means something shipped.
        </p>
        <p className="font-sans text-sm text-muted mb-12 leading-relaxed">
          I started tracking on 2 November 2026, so most of this grid is honestly
          empty — it fills in from the right. The engagements behind the hours are
          on <Link
            href="/work"
            className="text-accent underline underline-offset-4 hover:text-accent-dim transition-colors duration-200"
          >
            work
          </Link>.
        </p>

        <ActivityGraph grid={grid} />

        {prDays.length > 0 && (
          <section className="mt-16 pt-8 border-t border-border">
            <h2 className="font-mono text-xs uppercase tracking-widest text-accent mb-6">
              Shipped upstream
            </h2>
            {/* The real links. The grid's rings are aria-hidden decoration over
                this list, which is the half a screen reader and a crawler both
                actually get to use. */}
            <ol className="flex flex-col gap-6">
              {prDays.map((cell) => (
                <li key={cell.date}>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-muted mb-2">
                    <time dateTime={cell.date}>{formatCellDate(cell.date)}</time>
                    {cell.seconds > 0 && ` · ${formatDuration(cell.seconds)} tracked`}
                  </p>
                  <ul className="flex flex-col gap-1">
                    {cell.prs.map((pr) => (
                      <li key={`${pr.repo}#${pr.number}`} className="font-sans text-sm">
                        <a
                          href={pr.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-text hover:text-accent transition-colors duration-200"
                        >
                          <span className="font-mono text-xs text-muted">
                            {pr.repo}#{pr.number}
                          </span>{' '}
                          {pr.title}
                          <span className="sr-only"> (opens in new tab)</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>
    </main>
  )
}
