import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { Github, ExternalLink } from 'lucide-react'
import { getAllProjects, getProjectBySlug } from '@lib/projects'
import MDXContent from '@components/MDXContent'

interface Props {
  params: { slug: string }
}

export function generateStaticParams() {
  return getAllProjects().map((p) => ({ slug: p.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const project = getProjectBySlug(params.slug)
  if (!project) return {}
  return {
    title: project.title,
    description: project.excerpt,
  }
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

const statusStyles = {
  active: 'text-accent border-accent/40 bg-accent/10',
  completed: 'text-muted border-border bg-surface/40',
  archived: 'text-muted/60 border-border/40',
}

const statusLabel = {
  active: '● Active',
  completed: '✓ Completed',
  archived: '○ Archived',
}

export default function ProjectPage({ params }: Props) {
  const project = getProjectBySlug(params.slug)
  if (!project) notFound()

  return (
    <main className="pt-32 pb-24 px-6">
      <div className="max-w-article mx-auto">
        <Link
          href="/projects"
          className="font-mono text-sm text-muted hover:text-accent tracking-wider transition-colors duration-200 mb-10 inline-block"
        >
          ← Back to projects
        </Link>

        <header className="mt-6 mb-12">
          <div className="flex flex-wrap items-center gap-3 mb-5">
            <time className="font-mono text-xs text-muted tracking-wider">
              {formatDate(project.date)}
            </time>
            <span className="text-border">·</span>
            <span
              className={`font-mono text-xs px-2 py-0.5 border rounded-sm tracking-wider ${statusStyles[project.status]}`}
            >
              {statusLabel[project.status]}
            </span>
          </div>

          <h1 className="font-mono text-3xl sm:text-4xl lg:text-5xl tracking-tight text-text mb-4 leading-tight">
            {project.title}
          </h1>

          <p className="font-sans text-base text-muted leading-relaxed mb-6">
            {project.excerpt}
          </p>

          {/* Tech stack */}
          <div className="flex flex-wrap gap-2 mb-6">
            {project.stack.map((tech) => (
              <span
                key={tech}
                className="font-mono text-xs px-2.5 py-1 bg-accent/10 border border-accent/30 text-accent/80 rounded-sm"
              >
                {tech}
              </span>
            ))}
          </div>

          {/* External links */}
          {(project.github || project.demo) && (
            <div className="flex flex-wrap gap-4 pt-4 border-t border-border">
              {project.github && (
                <a
                  href={project.github}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-sm text-muted hover:text-accent flex items-center gap-2 transition-colors duration-200"
                >
                  <Github size={14} />
                  View source
                </a>
              )}
              {project.demo && (
                <a
                  href={project.demo}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-sm text-muted hover:text-accent flex items-center gap-2 transition-colors duration-200"
                >
                  <ExternalLink size={14} />
                  Live site
                </a>
              )}
            </div>
          )}
        </header>

        <article>
          <MDXContent source={project.content} />
        </article>
      </div>
    </main>
  )
}
