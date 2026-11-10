import type { Metadata } from 'next'
import Link from 'next/link'
import { getActivityGrid, formatCellDate, formatDuration, PR_FEED_DAYS } from '@lib/timelog'
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

  /* ALL-TIME, not read off the grid. It used to be derived from the cells so
     the list and the rings could not disagree — but the grid now starts at the
     first tracked day (2026-11-02) and every upstream PR predates that, so
     reading the cells would empty this section entirely. Both still come from
     the same bucketing in the snapshot's timezone, so they remain consistent
     where they overlap.

     Since 2026-11-10 the feed carries only the last PR_FEED_DAYS, so it is
     routinely EMPTY — the gap before the three PRs of 2026-11-09 was eleven
     days. The section renders either way; see the empty branch below. */
  const prDays = grid.prFeed

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
        {/* The ring clause is CONDITIONAL. Since the grid starts at the first
            tracked day and every upstream PR predates it, no cell currently
            carries a ring — promising one in the intro would send the reader
            hunting for a mark that is not on the page. It comes back on its
            own the moment a PR lands inside the window, which is the same
            condition that restores the ring's legend entry. */}
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
          . Darker is a longer day
          {grid.totals.prDays > 0 && '; a ring means something shipped'}.
        </p>
        {/* The "most of this grid is honestly empty" paragraph was removed on
            2026-11-09 along with the fixed 53-week window it was explaining.
            The grid now starts at the first tracked day, so there is nothing
            left to apologise for and the copy would be describing a shape the
            page no longer has. */}
        <p className="font-sans text-sm text-muted mb-12 leading-relaxed">
          The engagements behind the hours are on{' '}
          <Link
            href="/work"
            className="text-accent underline underline-offset-4 hover:text-accent-dim transition-colors duration-200"
          >
            work
          </Link>
          .
        </p>

        <ActivityGraph grid={grid} />

        {/* THE SECTION RENDERS UNCONDITIONALLY, even with nothing in it. It
            used to be gated on `prDays.length > 0`, which was fine when the
            feed was the most recent 15 PRs and therefore never empty. A
            seven-day window empties routinely — the gap before 2026-11-09 was
            eleven days — and a section that silently disappears leaves the
            lifetime "PRs opened / closed" counts sitting above a hole, with no
            way for the reader to tell whether it is a quiet week or a broken
            page. Saying "nothing this week" answers that. */}
        <section className="mt-16 pt-8 border-t border-border">
          <h2 className="font-mono text-xs uppercase tracking-widest text-accent mb-2">
            Recent pull requests
          </h2>
          {/* Names the WINDOW as well as the visibility. "Public" because the
              query is `is:public`, so work in private repositories is absent
              rather than redacted; "last 7 days" because otherwise a reader
              who knows the lifetime count is 65 would read three rows as a
              bug rather than as a week. */}
          <p className="font-sans text-sm text-muted mb-6">
            From public repositories, last {PR_FEED_DAYS} days.
          </p>

          {prDays.length === 0 ? (
            <p className="font-sans text-sm text-muted">
              Nothing opened in the last {PR_FEED_DAYS} days.
            </p>
          ) : (
            /* The real links. The grid's rings are aria-hidden decoration over
               this list, which is the half a screen reader and a crawler both
               actually get to use. */
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
          )}
        </section>
      </div>
    </main>
  )
}
