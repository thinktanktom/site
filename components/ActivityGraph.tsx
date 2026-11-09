import {
  BAND_LABELS,
  formatCellDate,
  formatDuration,
  localDayOf,
  type ActivityCell,
  type ActivityGrid,
} from '@lib/timelog'

/*
 * The /activity heatmap. A SERVER component — it renders 371 static cells and
 * has no state, so there is nothing for the client bundle to gain. Its only
 * interactivity is the native `title` tooltip, which costs no JavaScript and
 * works with scripting disabled, consistent with the /work filter and the
 * annotation round trip.
 *
 * THE ACCESSIBILITY MODEL IS A DELIBERATE CHOICE, not a shortcut. The grid is
 * one `role="img"` with a summarising `aria-label` and every cell inside it
 * aria-hidden — the same shape components/TrackingLogo.tsx uses for its three
 * mask layers. The alternative, a 371-cell table, is what GitHub ships and is
 * widely criticised for: a screen reader walks 371 cells, most of them "no
 * activity", to learn something a sentence conveys. So the information is given
 * twice instead — once as pixels for a sighted reader, and once as real prose
 * and a real list below the grid, which is where the PR links live too. The
 * cells are decoration over data that is also published in text.
 */

function cellTitle(cell: ActivityCell): string | undefined {
  /* Neither end of the range gets a tooltip: a day after today and a day
     before tracking began have nothing to report, and an empty tooltip reads
     as a broken one. */
  if (cell.future || cell.preStart) return undefined

  const date = formatCellDate(cell.date)
  /* "nothing tracked", not formatDuration's em-dash, when there is nothing to
     report. The dash is right in a table column and wrong after another dash:
     a PR opened on an untracked day rendered "Sun 1 Feb 2026 — —", which is
     most of the ringed cells for now. */
  const parts: string[] = [
    `${date} — ${cell.seconds > 0 ? formatDuration(cell.seconds) : 'nothing tracked'}`,
  ]

  if (cell.buckets.length > 0) {
    parts.push(cell.buckets.map((b) => `${b.label} ${formatDuration(b.seconds)}`).join(', '))
  }
  if (cell.prs.length > 0) {
    parts.push(
      cell.prs.length === 1
        ? `1 pull request: ${cell.prs[0].repo}#${cell.prs[0].number}`
        : `${cell.prs.length} pull requests`
    )
  }

  return parts.join('\n')
}

/* Mon/Wed/Fri only. Seven stacked labels do not fit beside 11px rows, and these
   three are enough to orient a reader in the week — the same three GitHub
   labels, for the same reason. */
const WEEKDAY_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', ''] as const

export default function ActivityGraph({ grid }: { grid: ActivityGrid }) {
  const { columns, monthLabels, totals, meta } = grid

  /*
   * Drop a month label that would collide with the next one.
   *
   * In practice this only ever fires on the FIRST label, and it drops it. The
   * grid's column 0 is a partial week, so when it holds only a few days of the
   * outgoing month the next month's label lands 1-2 columns later and the two
   * overlap at an 11px pitch. Simulated over 1500 consecutive values of
   * "today": the filter fires on 689 of them, and on every one of those it is
   * monthLabels[0] that goes. No mid-grid pair can collide — the minimum gap
   * between any other adjacent pair is 4 columns (56px) against an ~18px
   * label.
   *
   * So the survivor is the LATER label, which is correct and is what GitHub
   * does: the dropped one is a stub for a month with barely any columns, and
   * every label that remains stays in register with its own month. An earlier
   * version of this comment claimed the opposite ("keeping the EARLIER of the
   * pair"); do not "fix" the code to match that, it reintroduces the overlap.
   *
   * The last column is also excluded below, because a label there cannot be
   * read — see the note on `hm-months` padding in globals.css.
   */
  const visibleMonths = monthLabels.filter((m, i) => {
    const next = monthLabels[i + 1]
    return !next || next.column - m.column >= 3
  })

  /* "since <first tracked day>", not "the last 12 months": the grid now starts
     where the log does rather than a fixed year back, so the old wording would
     have described a window that no longer exists. */
  const summary =
    `Tracked work since ${formatCellDate(grid.firstDate)}: ` +
    `${formatDuration(totals.seconds)} across ${totals.activeDays} ` +
    `${totals.activeDays === 1 ? 'day' : 'days'}` +
    (totals.prs > 0
      ? `, and ${totals.prs} upstream pull ${totals.prs === 1 ? 'request' : 'requests'} opened on ` +
        `${totals.prDays} ${totals.prDays === 1 ? 'day' : 'days'}.`
      : '.')

  /* The ring key is dropped when nothing in the window carries a ring —
     currently the case, since every upstream PR predates the log. A legend
     entry for a mark that appears nowhere on the grid is just a puzzle. */
  const anyRings = totals.prDays > 0

  return (
    <div className="hm">
      {/*
        tabIndex=0 on the SCROLLER, not on anything inside it. The grid is
        739px and overflows below ~830px of viewport (and under zoom), and a
        scroll container with no focusable descendant cannot be scrolled by
        keyboard at all — WCAG 2.1.1. That is worse here than it sounds,
        because `direction: rtl` parks the resting position at the recent
        edge, so what a keyboard user could not reach was the entire older
        half of the year.

        The role="img" and its label live here too rather than on the inner
        wrapper, so the focusable element is the labelled one and a screen
        reader announces the summary when it lands.
      */}
      <div className="hm-scroll" tabIndex={0} role="img" aria-label={summary}>
        <div className="flex">
          <div
            className="hm-days mt-4 font-mono text-[10px] text-muted"
            aria-hidden="true"
          >
            {WEEKDAY_LABELS.map((label, i) => (
              <div key={i} className="hm-day">
                {label}
              </div>
            ))}
          </div>

          <div>
            <div className="hm-months font-mono text-[10px] text-muted" aria-hidden="true">
              {visibleMonths.map(({ column, label }) => (
                <span
                  key={`${column}-${label}`}
                  className="hm-month"
                  /* Positioned from the column pitch rather than laid out as
                     flex items: a label is wider than its 11px column, so flex
                     would push every later label out of register with the grid
                     it is meant to annotate. */
                  style={{ left: `calc((var(--hm-cell) + var(--hm-gap)) * ${column})` }}
                >
                  {label}
                </span>
              ))}
            </div>

            <div className="hm-grid" aria-hidden="true">
              {columns.map((column, w) => (
                <div key={w} className="hm-col">
                  {column.map((cell) => (
                    <div
                      key={cell.date}
                      className={
                        `hm-cell ${
                          cell.future || cell.preStart ? 'hm-future' : `hm-${cell.intensity}`
                        }` + (cell.prs.length > 0 ? ' hm-pr' : '')
                      }
                      title={cellTitle(cell)}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* The legend. Its swatches are .hm-cell at the same size and the same
          classes as the grid, so the scale shown is literally the scale
          painted — it cannot drift from the ramp the way a hand-drawn key
          would. */}
      <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 font-mono text-[10px] uppercase tracking-widest text-muted">
        <div className="hm-legend">
          <span>Less</span>
          {[0, 1, 2, 3, 4].map((level) => (
            <span
              key={level}
              className={`hm-cell hm-${level}`}
              title={BAND_LABELS[level]}
              aria-hidden="true"
            />
          ))}
          <span>More</span>
        </div>

        {anyRings && (
          <div className="hm-legend">
            <span className="hm-cell hm-0 hm-pr" aria-hidden="true" />
            <span className="ml-1">Shipped a PR</span>
          </div>
        )}
      </div>

      {/*
        THE BANDS AS TEXT, and this is required rather than decorative.
        Until it existed, "under 2h / 2–4h / 4–6h / over 6h" lived only in the
        `title` of an aria-hidden swatch — unreachable by touch (no hover), by
        keyboard, and by any screen reader, which left those readers a legend
        reading precisely "Less … More".

        It is also the payoff the fixed-band design is justified by: the whole
        argument for bands over GitHub's quartiles (see lib/timelog.ts) is that
        the thresholds CAN be stated, which a quartile scale cannot do. Stating
        them only in a tooltip gave that up.
      */}
      <p className="mt-3 font-mono text-[10px] tracking-wide text-muted">
        Each step is a day&apos;s tracked time: {BAND_LABELS.slice(1).join(' · ')}.
      </p>

      {/* The accessible half of the "twice" above: the same figures as prose,
          for a reader who gets nothing from 371 divs. Not sr-only — a sighted
          reader wants the totals too, and a heatmap is bad at exact numbers. */}
      <dl className="mt-10 grid grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-4">
        {[
          { label: 'Tracked', value: formatDuration(totals.seconds) },
          /* Rolling 7 days ending today, not the calendar week — "this week"
             would reset every Monday and read as a drop rather than a
             boundary. */
          { label: 'Last 7 days', value: formatDuration(totals.last7Seconds) },
          /* Both PR figures are ALL-TIME, deliberately out of step with the
             two beside them. The grid window now starts at the first tracked
             day and every upstream PR predates it, so window-scoped counts
             would both read 0 on a page that lists ten of them below. */
          { label: 'PRs opened', value: String(totals.prsOpenedAllTime) },
          { label: 'PRs closed', value: String(totals.prsClosedAllTime) },
        ].map(({ label, value }) => (
          <div key={label}>
            <dt className="font-mono text-[10px] uppercase tracking-widest text-muted">{label}</dt>
            {/* text-text, not text-accent. "Keep --accent disciplined" lists
                CTAs, active states, code accents and heading decorations —
                four large numerals are none of those, and accent is already
                carrying both h2 labels, three links and all 371 ramp cells on
                this page. `text-2xl text-accent` appears nowhere else in the
                repo; this is the same restraint /work applies to its 22 rows
                of chips and / to its 47. */}
            <dd className="font-mono text-2xl text-text mt-1">{value}</dd>
          </div>
        ))}
      </dl>


      {/* The as-of line. A heatmap with no date on it silently claims to be
          live, and this one is a committed snapshot that is exactly as current
          as the last `node scripts/sync-timelog.mjs`. Saying so is the honest
          rendering of the trade that snapshot makes. */}
      <p className="mt-10 font-mono text-[10px] uppercase tracking-widest text-muted">
        Snapshot taken{' '}
        <time dateTime={meta.generatedAt}>
          {formatCellDate(localDayOf(meta.generatedAt, meta.tzOffsetMinutes))}
        </time>
      </p>
    </div>
  )
}
