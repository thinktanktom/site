import type { Metadata } from 'next'
import { getWorkEntries, countEntries } from '@lib/work'
import WorkEntryRow from '@components/WorkEntryRow'

/*
 * /work replaced /projects, /experience and /contributions on 2026-10-26 --
 * one reverse-chronological spine instead of three pages with three different
 * organizing ideas. The three old routes survive as canonical stubs so their
 * indexed URLs keep resolving; see the header comment in each.
 *
 * This is an ASYNC SERVER COMPONENT and must stay one: getWorkEntries() pulls
 * in lib/github.ts, whose PR fetch runs at build time against
 * process.env.GITHUB_TOKEN. Nothing on this page is a client component -- the
 * kind filter is four radios plus general-sibling CSS in globals.css, and the
 * upstream rows are native <details> -- so the whole thing works with JS off.
 */

const description =
  'Everything I have built and shipped, newest first — client engagements, project writeups, and open source pull requests on one timeline.'

export const metadata: Metadata = {
  title: 'Work',
  description,
  alternates: { canonical: '/work' },
  openGraph: {
    title: 'Work — thinktanktom',
    description,
    type: 'website',
    url: 'https://thinktanktom.com/work',
    siteName: 'thinktanktom',
    images: ['/ttt_logo.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Work — thinktanktom',
    description,
    images: ['/ttt_logo.png'],
  },
}

const FILTERS = [
  { id: 'wf-all', label: 'All', glyph: null, countKey: 'all' },
  { id: 'wf-built', label: 'Built', glyph: '◆', countKey: 'built' },
  { id: 'wf-roles', label: 'Roles', glyph: '▸', countKey: 'engagements' },
  { id: 'wf-upstream', label: 'Upstream', glyph: '↗', countKey: 'upstream' },
] as const

export default async function WorkPage() {
  const entries = await getWorkEntries()
  const counts = countEntries(entries)

  /* The rail splits the one spine into two columns at lg. Both halves keep the
     engine's single reverse-chronological order; they are just rendered in
     different places, so the arrays are filtered, never re-sorted.

     Accepted trade, and the reason the rail was a separate decision: the
     clusters are NO LONGER interleaved into the dated spine at any width.
     Below lg they follow it as their own "Upstream" block. Each cluster still
     carries its own date label, so nothing becomes undated -- but you can no
     longer read one column and see a PR land between two engagements. */
  const engagements = entries.filter((e) => e.kind === 'engagement')
  const upstream = entries.filter((e) => e.kind === 'upstream')

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://thinktanktom.com' },
      { '@type': 'ListItem', position: 2, name: 'Work', item: 'https://thinktanktom.com/work' },
    ],
  }

  return (
    <main className="pt-32 pb-24 px-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* max-w-chrome, not max-w-article, because the rail needs the full
          1100px at lg. The measure is preserved rather than widened: the grid
          in globals.css is `minmax(0,1fr) 17rem` with a 3rem gap, so
          1100 − 272 − 48 = 780px of main column — exactly max-w-article. Below
          lg each block caps itself back to the article measure, so nothing
          between 780px and 1024px reads wider than it did before. */}
      <div className="max-w-chrome mx-auto">
        <div className="max-w-article lg:max-w-none">
          <h1 className="font-mono text-4xl sm:text-5xl lg:text-6xl tracking-tight mb-4 text-text">
            Work.
          </h1>
          <p className="font-sans text-lg text-muted mb-12 leading-relaxed max-w-article">
            Six years of smart contract work, AI agent infrastructure, and the machine learning
            roles that started it all — plus what I have shipped upstream.
          </p>
        </div>

        {/* The radios come BEFORE both the pill row and the list so the filter
            rules in globals.css can reach them with the general sibling
            combinator. Uncontrolled (defaultChecked), which is what keeps this
            page free of client JavaScript. */}
        <fieldset className="work-filter mb-14">
          <legend className="sr-only">Filter by kind of work</legend>

          {FILTERS.map(({ id }) => (
            <input
              key={id}
              type="radio"
              name="work-filter"
              id={id}
              className="sr-only"
              defaultChecked={id === 'wf-all'}
            />
          ))}

          <div className="work-pills flex flex-wrap gap-2">
            {FILTERS.map(({ id, label, glyph, countKey }) => (
              <label
                key={id}
                htmlFor={id}
                className="work-pill font-mono text-xs tracking-widest uppercase px-3 py-1.5 border border-border text-muted rounded-full cursor-pointer transition-colors duration-200 hover:text-accent"
              >
                {glyph && <span aria-hidden="true">{glyph} </span>}
                {label} · {counts[countKey]}
              </label>
            ))}
          </div>

          <div className="work-layout mt-10">
            {/* flex + gap, not space-y: `space-y` puts the margin on `* + *`, so
                a filtered-out first row would still give the next one a top
                margin. A flex gap is not applied to `display: none` children. */}
            <ol className="work-spine flex flex-col gap-8">
              {engagements.map((entry) => (
                <WorkEntryRow key={entry.id} entry={entry} />
              ))}
            </ol>

            <aside className="work-rail" aria-labelledby="work-rail-heading">
              <h2
                id="work-rail-heading"
                className="font-mono text-xs tracking-widest uppercase text-muted mb-5 pb-3 border-b border-border"
              >
                Upstream · {counts.upstream} repos
              </h2>
              <ol className="flex flex-col gap-5">
                {upstream.map((entry) => (
                  <WorkEntryRow key={entry.id} entry={entry} variant="rail" />
                ))}
              </ol>
            </aside>
          </div>
        </fieldset>

        <div className="mt-16 pt-8 border-t border-border max-w-article">
          <h2 className="font-mono text-xs tracking-widest uppercase text-muted mb-4">
            Education &amp; certifications
          </h2>
          <div className="font-sans text-base text-text leading-[1.75] space-y-1">
            <p>B.Tech, Computer Science — SRM Institute of Science and Technology, 2017–2021</p>
            <p className="text-muted">
              MTCNA (MikroTik Certified Network Associate), issued 2024
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}
