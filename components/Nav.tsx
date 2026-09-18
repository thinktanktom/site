'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X } from 'lucide-react'

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

  // Keyboard support for the mobile overlay: close on Escape, move focus
  // into the dialog on open, and return it to the toggle button on close.
  useEffect(() => {
    if (!mobileOpen) return

    closeButtonRef.current?.focus()

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [mobileOpen])

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
          <Link href="/" className="flex items-center shrink-0">
            <Image
              src="/ttt_side_no_byline_logo.svg"
              alt="thinktanktom"
              width={224}
              height={32}
              className="object-contain"
              unoptimized
              priority
            />
          </Link>

          {/* Desktop */}
          <div className="hidden md:flex items-center gap-8">
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
            <a
              href="https://www.upwork.com/freelancers/~018a1dbf1094588c7e"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Hire me on Upwork (opens in new tab)"
              className="font-mono text-sm tracking-wider px-4 py-1.5 rounded-full bg-accent text-bg font-bold hover:bg-accent-dim transition-colors duration-200"
            >
              Hire me ↗
            </a>
          </div>

          {/* Mobile hamburger */}
          <button
            ref={menuButtonRef}
            className="md:hidden text-muted hover:text-text transition-colors"
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
            <Link href="/" onClick={closeMobileMenu}>
              <Image
                src="/ttt_side_no_byline_logo.svg"
                alt="thinktanktom"
                width={224}
                height={32}
                className="object-contain"
                unoptimized
              />
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
            <a
              href="https://www.upwork.com/freelancers/~018a1dbf1094588c7e"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Hire me on Upwork (opens in new tab)"
              onClick={closeMobileMenu}
              className="font-mono text-xl tracking-wider px-8 py-3 rounded-full bg-accent text-bg font-bold hover:bg-accent-dim transition-colors duration-200"
            >
              Hire me ↗
            </a>
          </div>
        </div>
      )}
    </>
  )
}
