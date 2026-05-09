'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X } from 'lucide-react'

const navLinks = [
  { href: '/writing', label: 'Writing' },
  { href: '/projects', label: 'Projects' },
  { href: '/contributions', label: 'Contributions' },
  { href: '/about', label: 'About' },
]

export default function Nav() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()

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
              src="/thinktanktom_logo.svg"
              alt="ThinkTankTom"
              width={44}
              height={44}
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
              href="https://www.upwork.com/freelancers/thinktanktom"
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-sm tracking-wider px-4 py-1.5 rounded-full bg-accent text-bg font-bold hover:bg-accent-dim transition-colors duration-200"
            >
              Hire me ↗
            </a>
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden text-muted hover:text-text transition-colors"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={24} />
          </button>
        </nav>
      </header>

      {/* Mobile full-screen overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-[100] bg-bg flex flex-col">
          <div className="flex items-center justify-between px-6 h-16">
            <Link href="/" onClick={() => setMobileOpen(false)}>
              <Image
                src="/thinktanktom_logo.svg"
                alt="ThinkTankTom"
                width={44}
                height={44}
                className="object-contain"
                unoptimized
              />
            </Link>
            <button
              onClick={() => setMobileOpen(false)}
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
                onClick={() => setMobileOpen(false)}
                className={`font-mono text-4xl tracking-widest uppercase transition-colors duration-200 ${
                  isActive(href) ? 'text-accent' : 'text-text hover:text-accent'
                }`}
              >
                {label}
              </Link>
            ))}
            <a
              href="https://www.upwork.com/freelancers/thinktanktom"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setMobileOpen(false)}
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
