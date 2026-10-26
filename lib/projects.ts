import fs from 'fs'
import path from 'path'
import { cache } from 'react'
import matter from 'gray-matter'

const projectsDirectory = path.join(process.cwd(), 'content/projects')

export interface ProjectMeta {
  slug: string
  title: string
  date: string
  excerpt: string
  stack: string[]
  status: 'active' | 'completed' | 'archived'
  github?: string
  demo?: string
  link?: string
}

export interface Project extends ProjectMeta {
  content: string
}

// Memoised per render pass — see the note in lib/posts.ts. getAllProjects is
// called by the overview route's generateStaticParams, the sitemap and
// lib/work.ts; getProjectBySlug twice per project route. (The /projects index
// was a caller until it merged into /work on 2026-10-26.)
export const getAllProjects = cache((): ProjectMeta[] => {
  if (!fs.existsSync(projectsDirectory)) return []

  const fileNames = fs.readdirSync(projectsDirectory)
  return fileNames
    .filter((f) => f.endsWith('.mdx'))
    .map((fileName) => {
      const slug = fileName.replace(/\.mdx$/, '')
      const fullPath = path.join(projectsDirectory, fileName)
      const fileContents = fs.readFileSync(fullPath, 'utf8')
      const { data } = matter(fileContents)

      return {
        slug,
        title: data.title as string,
        date: data.date as string,
        excerpt: data.excerpt as string,
        stack: (data.stack as string[]) ?? [],
        status: (data.status as ProjectMeta['status']) ?? 'completed',
        github: data.github as string | undefined,
        demo: data.demo as string | undefined,
        link: data.link as string | undefined,
      }
    })
    .sort((a, b) => (a.date < b.date ? 1 : -1))
})

export const getProjectBySlug = cache((slug: string): Project | null => {
  const fullPath = path.join(projectsDirectory, `${slug}.mdx`)
  if (!fs.existsSync(fullPath)) return null

  const fileContents = fs.readFileSync(fullPath, 'utf8')
  const { data, content } = matter(fileContents)

  return {
    slug,
    title: data.title as string,
    date: data.date as string,
    excerpt: data.excerpt as string,
    stack: (data.stack as string[]) ?? [],
    status: (data.status as ProjectMeta['status']) ?? 'completed',
    github: data.github as string | undefined,
    demo: data.demo as string | undefined,
    link: data.link as string | undefined,
    content,
  }
})
