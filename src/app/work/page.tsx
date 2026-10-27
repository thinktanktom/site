import type { Metadata } from 'next'
import { getWorkEntries, countEntries } from '@lib/work'
import WorkEntryRow from '@components/WorkEntryRow'

/*
 * /work replaced /projects, /experience and /contributions on 2026-10-26 --
 * one reverse-chronological spine instead of three pages with three different
 * organizing ideas. Those three routes were DELETED and now 404; that was a
 * deliberate URL break, chosen over canonical signpost pages. See the note in
 * src/app/sitemap.ts.
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

  /*
   * A zero-PR build is REACHABLE, not hypothetical: lib/github.ts publishes an
   * empty list rather than failing the build when the search API 403s on the
   * shared unauthenticated rate limit or the 8s timeout fires. Without these
   * two guards that build shipped an empty <aside> with the heading
   * "Upstream · 0 repos", a live "Upstream · 0" pill whose rule hides the
   * spine -- leaving a page whose entire body was one bottom-bordered heading
   * -- and, at lg, the 272px rail track reserved for nothing, which is exactly
   * the hole the grid-collapse rules in globals.css exist to prevent.
   *
   * So: drop any pill whose set is empty (never "All", which is the reset), and
   * omit the rail entirely rather than rendering it empty. `work-layout-solo`
   * is what collapses the grid when the rail is absent, since no filter is
   * checked in that state for the ID-specificity rules to match on.
   */
  const hasUpstream = upstream.length > 0
  const visibleFilters = FILTERS.filter((f) => f.id === 'wf-all' || counts[f.countKey] > 0)

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
            page free of client JavaScript.

            A plain <div>, deliberately NOT a <fieldset>. The sibling selectors
            only need the radios and the targets to share a parent, so the
            fieldset bought nothing -- while costing real accessibility: it has
            to enclose the lists to keep that sibling relationship, so every
            entry and the <aside> complementary landmark sat inside a
            role="group" named "Filter by kind of work". A screen-reader user
            reading four years of BankX work was told they were still inside the
            filter. Valid HTML, which is why it survived review.

            The radios keep their own grouping natively -- same `name`, so they
            are announced as "N of 4" -- and each takes its accessible name from
            its visible <label for>. */}
        {/* .work-filter carries NO styling — Tailwind preflight already zeroes the
            border, and this is a div rather than the fieldset it once was. It is a
            TEST HOOK: scripts/e2e-work.mjs selects
            `.work-filter input[type=radio]` through it. A 2026-10-27 sweep proved
            no CSS rule matched it and removed it as dead; the harness caught that
            within minutes. Same for .work-pill below. Grep scripts/ too. */}
        <div className="work-filter mb-14">
          {/* visibleFilters, NOT FILTERS: in a zero-PR build the Upstream pill
              is dropped (see the note above) but its radio used to stay --
              sr-only is focusable, and the four share a name, so arrow keys
              walked into a filter with no pill to label it. Its rule hides the
              spine and the rail is absent from the markup, leaving exactly the
              empty page the guard exists to prevent, reachable by keyboard. */}
          {visibleFilters.map(({ id }) => (
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
            {visibleFilters.map(({ id, label, glyph, countKey }) => (
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

          <div className={`work-layout mt-10${hasUpstream ? '' : ' work-layout-solo'}`}>
            {/* flex + gap, not space-y: `space-y` puts the margin on `* + *`, so
                a filtered-out first row would still give the next one a top
                margin. A flex gap is not applied to `display: none` children. */}
            <ol className="work-spine flex flex-col gap-8">
              {engagements.map((entry) => (
                <WorkEntryRow key={entry.id} entry={entry} />
              ))}
            </ol>

            {hasUpstream && (
              <aside className="work-rail" aria-labelledby="work-rail-heading">
                <h2
                  id="work-rail-heading"
                  className="font-mono text-xs tracking-widest uppercase text-muted mb-5 pb-3 border-b border-border"
                >
                  Upstream · {counts.upstream} {counts.upstream === 1 ? 'repo' : 'repos'}
                </h2>
                <ol className="flex flex-col gap-5">
                  {upstream.map((entry) => (
                    <WorkEntryRow key={entry.id} entry={entry} variant="rail" />
                  ))}
                </ol>
              </aside>
            )}
          </div>
        </div>

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
