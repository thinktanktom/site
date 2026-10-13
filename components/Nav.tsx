'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X } from 'lucide-react'
import { TttWordmark } from '@components/ThemedLogo'
import ThemeSwitcher from '@components/ThemeSwitcher'

const navLinks = [
  { href: '/writing', label: 'Writing' },
  { href: '/projects', label: 'Projects' },
  { href: '/experience', label: 'Experience' },
  { href: '/contributions', label: 'Contributions' },
  { href: '/about', label: 'About' },
]

export default function Nav() {
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
          <Link
            href="/"
            className="flex items-center shrink-0"
            aria-label="thinktanktom, home"
          >
            <TttWordmark height={32} priority />
          </Link>

          {/* Desktop. Breakpoint is lg. It was raised to xl while the Hire me
              pill was in this row: wordmark + 5 tracked uppercase links + the
              switcher + the pill needed more width than lg gives, and an
              earlier lg measurement that said otherwise had been taken with
              scrollbars hidden. Without the pill the row is 643px against the
              961px lg leaves after padding and a classic scrollbar — 94px of
              clearance, measured in a browser. Below lg the full-screen
              overlay carries the navigation and the theme control. */}
          <div className="hidden lg:flex items-center gap-6">
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
            className="lg:hidden text-muted hover:text-text transition-colors"
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
            <Link
              href="/"
              onClick={closeMobileMenu}
              aria-label="thinktanktom, home"
            >
              <TttWordmark height={32} />
            </Link>
            <button
              ref={closeButtonRef}
              onClick={closeMobileMenu}
              className="text-muted hover:text-text transition-colors"
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
