import Link from 'next/link'
import DocSidebar from '@components/DocSidebar'
import AiDocNotice from '@components/AiDocNotice'
import { DOC_PROJECTS, isDocProject } from '@lib/project-docs'

// Deliberately at [...docSlug]/ and NOT at [slug]/: a layout one level up would
// also wrap the project overview page (/projects/BankX), which has no sidebar or
// doc top-bar. Scoping it to the catch-all leaf preserves that split.
export default function ProjectDocLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { slug: string }
}) {
  // Unreachable for a generated route — every param comes from getAllDocParams()
  // — but a doc tree's chrome is meaningless without a known project, so fall
  // through to bare content rather than throwing during a build.
  if (!isDocProject(params.slug)) return <>{children}</>

  const project = DOC_PROJECTS[params.slug]

  return (
    <div className="min-h-screen pt-16">
      {/* Top bar */}
      <div className="border-b border-border bg-surface/60 backdrop-blur-sm sticky top-16 z-30">
        <div className="max-w-[1200px] mx-auto px-6 py-3 flex items-center gap-3">
          <Link
            href="/work"
            className="font-mono text-xs text-muted hover:text-accent tracking-wider transition-colors duration-200"
          >
            Work
          </Link>
          <span className="text-border font-mono text-xs">/</span>
          <Link
            href={`/projects/${params.slug}`}
            className="font-mono text-xs text-muted hover:text-accent tracking-wider transition-colors duration-200"
          >
            {project.label}
          </Link>
          <span className="text-border font-mono text-xs">/</span>
          <span className="font-mono text-xs text-accent tracking-wider">Docs</span>
          <div className="ml-auto">
            <AiDocNotice />
          </div>
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto flex">
        <DocSidebar project={params.slug} label={project.label} navId={project.navId} />

        {/* Main content */}
        <main className="flex-1 min-w-0 px-6 lg:px-12 py-12">
          <div className="max-w-[780px]">{children}</div>
        </main>
      </div>
    </div>
  )
}
