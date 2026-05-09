import Link from 'next/link'
import { Github, ExternalLink } from 'lucide-react'
import type { ProjectMeta } from '@lib/projects'

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  })
}

const statusStyles: Record<ProjectMeta['status'], string> = {
  active: 'text-accent border-accent/40 bg-accent/10',
  completed: 'text-muted border-border bg-surface/40',
  archived: 'text-muted/60 border-border/40 bg-transparent',
}

const statusLabel: Record<ProjectMeta['status'], string> = {
  active: '● Active',
  completed: '✓ Completed',
  archived: '○ Archived',
}

export default function ProjectCard({ project }: { project: ProjectMeta }) {
  return (
    <Link href={`/projects/${project.slug}`} className="block group">
      <article className="border border-border rounded-sm p-6 bg-surface/20 hover:border-accent/40 hover:-translate-y-1 transition-all duration-300">
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <div className="flex items-center gap-3">
            <time className="font-mono text-xs text-muted tracking-wider">
              {formatDate(project.date)}
            </time>
            <span className="text-border">·</span>
            <span className="font-mono text-xs text-muted">{project.readTime}</span>
          </div>
          <span
            className={`font-mono text-xs px-2 py-0.5 border rounded-sm tracking-wider ${statusStyles[project.status]}`}
          >
            {statusLabel[project.status]}
          </span>
        </div>

        <h3 className="font-mono text-xl tracking-tight text-text group-hover:text-accent transition-colors duration-200 mb-2 leading-snug">
          {project.title}
        </h3>

        <p className="font-sans text-sm text-muted leading-relaxed mb-4">
          {project.excerpt}
        </p>

        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex flex-wrap gap-2">
            {project.stack.map((tech) => (
              <span
                key={tech}
                className="font-mono text-xs px-2 py-0.5 bg-accent/10 border border-accent/30 text-accent/80 rounded-sm"
              >
                {tech}
              </span>
            ))}
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {project.github && (
              <span
                className="font-mono text-xs text-muted flex items-center gap-1"
                aria-label="GitHub"
              >
                <Github size={12} />
                GitHub
              </span>
            )}
            {project.demo && (
              <span
                className="font-mono text-xs text-muted flex items-center gap-1"
                aria-label="Live demo"
              >
                <ExternalLink size={12} />
                Demo
              </span>
            )}
          </div>
        </div>
      </article>
    </Link>
  )
}
