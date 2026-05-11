'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { Menu, X } from 'lucide-react'
import { sidebarNav, isSidebarGroup, type SidebarLeaf } from '@lib/bankx-sidebar'

function slugToHref(slug: string[]) {
  return `/projects/BankX/${slug.join('/')}`
}

function NavLink({ item, onClick }: { item: SidebarLeaf; onClick?: () => void }) {
  const pathname = usePathname()
  const href = slugToHref(item.slug)
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

function SidebarContent({ onLinkClick }: { onLinkClick?: () => void }) {
  return (
    <nav className="py-6 px-4">
      <Link
        href="/projects/BankX"
        className="block mb-6 font-mono text-xs text-muted hover:text-accent tracking-widest uppercase transition-colors duration-150"
      >
        ← BankX Protocol
      </Link>

      <div className="space-y-6">
        {sidebarNav.map((entry, i) => {
          if (isSidebarGroup(entry)) {
            return (
              <div key={i}>
                <p className="font-mono text-[10px] tracking-widest uppercase text-muted/50 mb-2 px-3">
                  {entry.title}
                </p>
                <div className="space-y-0.5">
                  {entry.items.map((item) => (
                    <NavLink key={item.slug.join('/')} item={item} onClick={onLinkClick} />
                  ))}
                </div>
              </div>
            )
          }
          return <NavLink key={entry.slug.join('/')} item={entry} onClick={onLinkClick} />
        })}
      </div>
    </nav>
  )
}

export default function BankXDocSidebar() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <>
      {/* Mobile toggle button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed bottom-6 right-6 z-50 w-12 h-12 bg-accent text-bg rounded-full flex items-center justify-center shadow-lg"
        aria-label="Open navigation"
      >
        <Menu size={18} />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
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
            <SidebarContent onLinkClick={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden lg:block w-60 shrink-0 border-r border-border min-h-[calc(100vh-4rem)] overflow-y-auto sticky top-[7rem] self-start max-h-[calc(100vh-7rem)]">
        <SidebarContent />
      </aside>
    </>
  )
}
