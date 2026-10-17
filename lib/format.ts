// Date formatters shared by the cards and the article/doc headers.
//
// There are deliberately THREE of these, not one. The five copied `formatDate`
// helpers these replaced looked interchangeable but rendered three different
// strings, so collapsing them into a single function would have quietly changed
// the visible date on several pages. Measured output for 2025-04-27:
//
//   formatMonthYear  "Apr 2025"       — post and project cards
//   formatLongDate   "April 27, 2025" — post and project page headers
//   formatShortDate  "Apr 27, 2025"   — the contributions list
//
// Note formatShortDate differs from formatLongDate only in the month being
// abbreviated: en-US orders the parts by locale, NOT by the order the options
// are written, so {day, month, year} does not produce "27 Apr 2025".
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

export function formatShortDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}
