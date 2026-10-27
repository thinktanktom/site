'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X } from 'lucide-react'
import ThemeSwitcher from '@components/ThemeSwitcher'

/* TWO links since 2026-10-26: /about merged into / the same week /projects,
   /experience and /contributions merged into /work. All four of those routes
   were deleted and now 404 -- deliberate URL breaks, so there is nothing to
   link to even if we wanted it.

   The breakpoint stays `lg`, and that is a choice rather than a constraint.
   Re-measured in a real browser on 2026-10-26 with scrollbars VISIBLE (which is
   what invalidated an earlier reading), after /about left the row: the wordmark
   is 224px and this row (2 tracked uppercase links + the compact switcher) is
   221.7px, so an inner page needs 445.7px of chrome -- down from 519.5px with
   three links, and 643px with five. On / there is no wordmark at all, so it is
   221.7px. `nav.scrollWidth === nav.clientWidth` at 1024, 1280 and 1440.

   `md` leaves ~705px after `px-6` and a classic scrollbar, so md fits with
   ~260px of clearance and `md:flex` is viable on width alone. It was NOT
   lowered, because fitting is not the same as reading well: the full-screen
   overlay is the better experience on a tablet. Lowering it is a deliberate
   design change, not a cleanup. Measure before quoting any number here -- the
   e2e harness asserts no overflow rather than trusting this comment. */
const navLinks = [
  { href: '/writing', label: 'Writing' },
  { href: '/work', label: 'Work' },
]

/* The wordmark arrives as an already-rendered node from the server layout
   rather than being imported here, and that is a bundle-size decision, not a
   style one. This is a client component, so anything it imports joins the
   CLIENT graph -- importing ThemedLogo dragged components/logo/paths.ts, ~33KB
   of raw SVG path data, into layout-*.js on every page, shipping the geometry
   twice: once as HTML and again as JavaScript. Passing it as a prop keeps the
   geometry server-side.

   Measured, gzip: this layout chunk 14,596 -> 5,024 bytes, and the feature's
   total client-JS cost on / fell from +11,116 to +1,544 bytes against main.
   Do not re-import a logo component into this file. */
type NavProps = {
  /* rendered server-side; displayed in both the top bar and the mobile overlay */
  wordmark: React.ReactNode
}

export default function Nav({ wordmark }: NavProps) {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileOpen])

  // Keyboard support for the mobile overlay: close on Escape, and move focus
  // into the dialog on open so a keyboard user is not left behind the overlay.
  useEffect(() => {
    if (!mobileOpen) return

    closeButtonRef.current?.focus()

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [mobileOpen])

  // Dismissing the overlay returns focus to the hamburger that opened it.
  const closeMobileMenu = () => {
    setMobileOpen(false)
    menuButtonRef.current?.focus()
  }

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + '/')

  /* THE WORDMARK IS DROPPED ON THE LANDING PAGE ONLY, and the "only" is the
     whole decision. / renders the stacked lockup as its hero, so repeating the
     wordmark 100px above it is noise -- but that reason holds on exactly one
     route. The header lives in the root layout, so dropping it everywhere
     would leave /writing, /work, every post and every project doc page with no
     mark AND no way home: navLinks has no Home item, this wordmark is it.

     Consequence handled in the same commit: scripts/e2e-palette.mjs section 1
     used to select `nav .logo-mask` and runs on /, where there is now no such
     element. It selects the hero mark instead. If that had been left alone it
     would have failed on a page that is correct, and the tempting fix is
     deleting the check -- which is the 2026-10-17 switch-stutter guard. */
  const showWordmark = pathname !== '/'

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'bg-surface/90 backdrop-blur-md border-b border-border'
            : 'bg-transparent'
        }`}
      >
        <nav className="max-w-chrome mx-auto px-6 h-16 flex items-center justify-between">
          {showWordmark && (
            <Link
              href="/"
              className="flex items-center shrink-0"
              aria-label="thinktanktom, home"
            >
              {wordmark}
            </Link>
          )}

          {/* Desktop. Breakpoint is lg — see the measurement note above the
              navLinks array, which is the single current record of it.

              History, because the numbers in it keep getting quoted: the
              breakpoint was xl while the Hire me pill lived in this row, then
              lg once the pill moved to the hero, where the five-link row
              measured 643px against the 961px lg leaves. Both of those figures
              are now stale — the pill is gone from this file entirely and the
              row is two links. Do not reuse them.

              The e2e harness asserts nav scrollWidth === clientWidth rather
              than trusting any number written here. Below lg the full-screen
              overlay carries the navigation and the theme control. */}
          {/* ml-auto, not justify-between alone: on / the wordmark is gone, so
              this row (or the hamburger below it) is the nav's ONLY flex item,
              and justify-between puts a single item at the START. The first
              build of the merge shipped the links hard against the left edge
              because of exactly that. With two items ml-auto changes nothing. */}
          <div className="hidden lg:flex items-center gap-6 ml-auto">
            {navLinks.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={`nav-link font-mono text-sm tracking-widest uppercase transition-colors duration-200 ${
                  isActive(href) ? 'text-accent' : 'text-muted hover:text-text'
                }`}
              >
                {label}
              </Link>
            ))}
            <ThemeSwitcher variant="compact" />
          </div>

          {/* Mobile hamburger */}
          <button
            ref={menuButtonRef}
            className="lg:hidden ml-auto text-muted hover:text-text transition-colors"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav"
          >
            <Menu size={24} />
          </button>
        </nav>
      </header>

      {/* Mobile full-screen overlay */}
      {mobileOpen && (
        <div
          id="mobile-nav"
          role="dialog"
          aria-modal="true"
          aria-label="Mobile navigation"
          className="fixed inset-0 z-[100] bg-bg flex flex-col"
        >
          <div className="flex items-center justify-between px-6 h-16">
            {showWordmark && (
              <Link
                href="/"
                onClick={closeMobileMenu}
                aria-label="thinktanktom, home"
              >
                {wordmark}
              </Link>
            )}
            {/* ml-auto, not justify-between: with the wordmark gone on / this
                row has one child, and justify-between would float the close
                button to the LEFT. */}
            <button
              ref={closeButtonRef}
              onClick={closeMobileMenu}
              className="ml-auto text-muted hover:text-text transition-colors"
              aria-label="Close menu"
            >
              <X size={24} />
            </button>
          </div>

          <div className="flex flex-col items-center justify-center flex-1 gap-12">
            {navLinks.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                onClick={closeMobileMenu}
                className={`font-mono text-4xl tracking-widest uppercase transition-colors duration-200 ${
                  isActive(href) ? 'text-accent' : 'text-text hover:text-accent'
                }`}
              >
                {label}
              </Link>
            ))}
            {/* Appearance last, after the content nav. Picking a theme
                deliberately does NOT close the overlay, so the change can be
                seen applying behind the control. */}
            <ThemeSwitcher variant="full" className="w-64" />
          </div>
        </div>
      )}
    </>
  )
}
