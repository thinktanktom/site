import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import readingTime from 'reading-time'

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
  readTime: string
}

export interface Project extends ProjectMeta {
  content: string
}

export function getAllProjects(): ProjectMeta[] {
  if (!fs.existsSync(projectsDirectory)) return []

  const fileNames = fs.readdirSync(projectsDirectory)
  return fileNames
    .filter((f) => f.endsWith('.mdx'))
    .map((fileName) => {
      const slug = fileName.replace(/\.mdx$/, '')
      const fullPath = path.join(projectsDirectory, fileName)
      const fileContents = fs.readFileSync(fullPath, 'utf8')
      const { data, content } = matter(fileContents)
      const stats = readingTime(content)

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
        readTime: stats.text,
      }
    })
    .sort((a, b) => (a.date < b.date ? 1 : -1))
}

export function getProjectBySlug(slug: string): Project | null {
  const fullPath = path.join(projectsDirectory, `${slug}.mdx`)
  if (!fs.existsSync(fullPath)) return null

  const fileContents = fs.readFileSync(fullPath, 'utf8')
  const { data, content } = matter(fileContents)
  const stats = readingTime(content)

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
    readTime: stats.text,
    content,
  }
}
