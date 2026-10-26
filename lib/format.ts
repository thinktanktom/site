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

export function formatMonthYear(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  })
}

export function formatLongDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}
