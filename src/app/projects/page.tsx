import type { Metadata } from 'next'
import { getAllProjects } from '@lib/projects'
import ProjectCard from '@components/ProjectCard'

export const metadata: Metadata = {
  title: 'Projects',
  description: 'Technical projects, case studies, and the tools I have built.',
}

export default function ProjectsPage() {
  const projects = getAllProjects()

  return (
    <main className="pt-32 pb-24 px-6">
      <div className="max-w-article mx-auto">
        <h1 className="font-mono text-4xl sm:text-5xl lg:text-6xl tracking-tight mb-4 text-text">
          Projects.
        </h1>
        <p className="font-sans text-lg text-muted mb-16 leading-relaxed">
          Things I have built, shipped, and learned from.
        </p>

        {projects.length > 0 ? (
          <div className="flex flex-col gap-6">
            {projects.map((project) => (
              <ProjectCard key={project.slug} project={project} />
            ))}
          </div>
        ) : (
          <p className="font-sans text-muted">No projects yet — check back soon.</p>
        )}
      </div>
    </main>
  )
}
