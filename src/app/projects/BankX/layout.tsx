import Link from 'next/link'
import BankXDocSidebar from '@components/BankXDocSidebar'

export default function BankXDocLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen pt-16">
      {/* Top bar */}
      <div className="border-b border-border bg-surface/60 backdrop-blur-sm sticky top-16 z-30">
        <div className="max-w-[1200px] mx-auto px-6 py-3 flex items-center gap-3">
          <Link
            href="/projects"
            className="font-mono text-xs text-muted hover:text-accent tracking-wider transition-colors duration-200"
          >
            Projects
          </Link>
          <span className="text-border font-mono text-xs">/</span>
          <Link
            href="/projects/BankX"
            className="font-mono text-xs text-muted hover:text-accent tracking-wider transition-colors duration-200"
          >
            BankX Protocol
          </Link>
          <span className="text-border font-mono text-xs">/</span>
          <span className="font-mono text-xs text-accent tracking-wider">Docs</span>
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto flex">
        <BankXDocSidebar />

        {/* Main content */}
        <main className="flex-1 min-w-0 px-6 lg:px-12 py-12">
          <div className="max-w-[780px]">{children}</div>
        </main>
      </div>
    </div>
  )
}
