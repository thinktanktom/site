// Date formatters shared by the cards and the article/doc headers.
//
// There are deliberately TWO of these, not one. The five copied `formatDate`
// helpers these replaced looked interchangeable but rendered different strings,
// so collapsing them into a single function would have quietly changed the
// visible date on several pages. Measured output for 2025-04-27:
//
//   formatMonthYear  "Apr 2025"       — post and project cards
//   formatLongDate   "April 27, 2025" — post and project page headers
//
// There was a third, `formatShortDate` ("Apr 27, 2025"), used only by the
// /contributions list. It was removed on 2026-10-26 with that page: /work
// renders PR clusters with a year label rather than a full date. Note that it
// differed from formatLongDate ONLY in the month being abbreviated, because
// en-US orders the parts by locale and NOT by the order the options are
// written -- {day, month, year} does not produce "27 Apr 2025". Keep that in
// mind before adding a third back.
//
// Client-safe: no Node.js imports, so client components can use these too.

/* `timeZone: 'UTC'` IS LOAD-BEARING, not boilerplate.
 *
 * Frontmatter dates are bare `YYYY-MM-DD`, which `new Date()` parses as UTC
 * midnight. Without an explicit zone, `toLocaleDateString` then resolves in
 * whatever zone the machine happens to be in, so any host behind UTC renders
 * the PREVIOUS day. Seven of the ten content dates are the 1st of a month, so
 * that shift crosses a month boundary and `formatMonthYear` prints the wrong
 * month outright: `2021-10-01` renders "Sep 2021" in America/Los_Angeles.
 *
 * It is currently invisible — this machine is IST (+05:30) and Actions runners
 * are UTC, both ahead of or equal to UTC — which is exactly why it is worth
 * pinning rather than leaving to the host. On a post page the drifted date also
 * contradicts the `<time dateTime>` attribute and the JSON-LD `datePublished`
 * on the same page, which are both taken from the raw string.
 *
 * It matters doubly given the note above: these are advertised as client-safe,
 * and a client component would resolve them in each READER's zone, producing a
 * hydration mismatch and per-reader wrong dates.
 */
export function formatMonthYear(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

export function formatLongDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
}
