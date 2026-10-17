'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Menu, X } from 'lucide-react'
import { isSidebarGroup, type SidebarEntry, type SidebarLeaf } from '@lib/doc-sidebar-types'
import { sidebarNav as BankX } from '@lib/bankx-sidebar'
import { sidebarNav as BasedAgents } from '@lib/based-agents-sidebar'
import { sidebarNav as FractalWebhook } from '@lib/fractal-webhook-sidebar'
import { sidebarNav as RufloOrchestration } from '@lib/ruflo-orchestration-sidebar'

// One sidebar for every project doc tree, replacing four 123-line client
// components that differed in 16 lines each and whose separate chunks each
// carried their own copy of the lucide icon factory, the Menu/X icon defs and
// this nav logic.
//
// The nav data is imported HERE, into the one shared chunk, rather than passed
// down as a prop from the server layout. That looks like the wasteful choice —
// every doc reader downloads all four projects' navs — but it is the cheaper
// one, because there is now a single route and therefore a single client chunk,
// so the alternatives are worse (measured, gzip, BankX):
//
//   prop from the layout  1,973 B chunk + 467 B in EVERY page's RSC payload
//   imported here         ~2,700 B chunk, cached once, 0 B per page
//
// The prop form is cheaper for a reader of one page and worse from the third
// page on; this form is flat. The old four-chunk design was actually the most
// efficient for a single-project reader (each chunk held only its own nav), so
// this is a deliberate small trade for having one implementation — not a win.
// next/dynamic per project would beat both, at the cost of hydrating the
// navigation late, which is not worth it for a sidebar.
const NAVS: Record<string, SidebarEntry[]> = {
  BankX,
  BasedAgents,
  FractalWebhook,
  RufloOrchestration,
}

interface DocSidebarProps {
  /** URL segment, e.g. 'BankX' — the doc tree's base path and NAVS key. */
  project: string
  /** Display name for the back-link and the dialog's accessible name. */
  label: string
  /** Prefix for the mobile-nav id, kept stable per project. */
  navId: string
}

function NavLink({
  item,
  basePath,
  onClick,
}: {
  item: SidebarLeaf
  basePath: string
  onClick?: () => void
}) {
  const pathname = usePathname()
  const href = `${basePath}/${item.slug.join('/')}`
  const isActive = pathname === href

  return (
    <Link
      href={href}
      onClick={onClick}
      className={`block py-1.5 px-3 rounded-sm font-mono text-xs tracking-wide transition-colors duration-150 ${
        isActive
          ? 'text-accent bg-accent/10 border-l-2 border-accent'
          : 'text-muted hover:text-text border-l-2 border-transparent hover:border-border'
      }`}
    >
      {item.title}
    </Link>
  )
}

function SidebarContent({
  basePath,
  label,
  nav,
  onLinkClick,
}: {
  basePath: string
  label: string
  nav: SidebarEntry[]
  onLinkClick?: () => void
}) {
  return (
    <nav className="py-6 px-4">
      <Link
        href={basePath}
        className="block mb-6 font-mono text-xs text-muted hover:text-accent tracking-widest uppercase transition-colors duration-150"
      >
        ← {label}
      </Link>

      <div className="space-y-6">
        {nav.map((entry, i) => {
          if (isSidebarGroup(entry)) {
            return (
              <div key={i}>
                <p className="font-mono text-[10px] tracking-widest uppercase text-muted mb-2 px-3">
                  {entry.title}
                </p>
                <div className="space-y-0.5">
                  {entry.items.map((item) => (
                    <NavLink
                      key={item.slug.join('/')}
                      item={item}
                      basePath={basePath}
                      onClick={onLinkClick}
                    />
                  ))}
                </div>
              </div>
            )
          }
          return (
            <NavLink
              key={entry.slug.join('/')}
              item={entry}
              basePath={basePath}
              onClick={onLinkClick}
            />
          )
        })}
      </div>
    </nav>
  )
}

export default function DocSidebar({ project, label, navId }: DocSidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const basePath = `/projects/${project}`
  const mobileNavId = `${navId}-mobile-nav`
  const nav = NAVS[project] ?? []

  useEffect(() => {
    if (!mobileOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [mobileOpen])

  return (
    <>
      {/* Mobile toggle button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed bottom-6 right-6 z-50 w-12 h-12 bg-accent text-bg rounded-full flex items-center justify-center shadow-lg"
        aria-label="Open navigation"
        aria-expanded={mobileOpen}
        aria-controls={mobileNavId}
      >
        <Menu size={18} />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          id={mobileNavId}
          role="dialog"
          aria-modal="true"
          aria-label={`${label} documentation navigation`}
          className="lg:hidden fixed inset-0 z-50 flex"
        >
          <div
            className="absolute inset-0 bg-bg/80 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative w-72 bg-surface border-r border-border overflow-y-auto">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-4 text-muted hover:text-text"
              aria-label="Close navigation"
            >
              <X size={18} />
            </button>
            <SidebarContent
              basePath={basePath}
              label={label}
              nav={nav}
              onLinkClick={() => setMobileOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden lg:block w-60 shrink-0 border-r border-border min-h-[calc(100vh-4rem)] overflow-y-auto sticky top-[7rem] self-start max-h-[calc(100vh-7rem)]">
        <SidebarContent basePath={basePath} label={label} nav={nav} />
      </aside>
    </>
  )
}
