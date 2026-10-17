import fs from 'fs'
import path from 'path'
import { cache } from 'react'
import matter from 'gray-matter'
import readingTime from 'reading-time'

const postsDirectory = path.join(process.cwd(), 'content/posts')

export interface PostMeta {
  slug: string
  title: string
  date: string
  excerpt: string
  tags: string[]
  readTime: string
  aiGenerated: boolean
}

export interface Post extends PostMeta {
  content: string
}

// Memoised per render pass: every post route calls getPostBySlug twice, once in
// generateMetadata and once in the page body, and getAllPosts is called by
// several routes in the same build. cache() keys on the arguments, which are
// primitives here, so the second call is free rather than a re-read and re-parse.
export const getAllPosts = cache((): PostMeta[] => {
  if (!fs.existsSync(postsDirectory)) return []

  const fileNames = fs.readdirSync(postsDirectory)
  return fileNames
    .filter((f) => f.endsWith('.mdx'))
    .map((fileName) => {
      const slug = fileName.replace(/\.mdx$/, '')
      const fullPath = path.join(postsDirectory, fileName)
      const fileContents = fs.readFileSync(fullPath, 'utf8')
      const { data, content } = matter(fileContents)
      const stats = readingTime(content)

      return {
        slug,
        title: data.title as string,
        date: data.date as string,
        excerpt: data.excerpt as string,
        tags: (data.tags as string[]) ?? [],
        readTime: stats.text,
        aiGenerated: (data.aiGenerated as boolean) ?? false,
      }
    })
    .sort((a, b) => (a.date < b.date ? 1 : -1))
})

export const getPostBySlug = cache((slug: string): Post | null => {
  const fullPath = path.join(postsDirectory, `${slug}.mdx`)
  if (!fs.existsSync(fullPath)) return null

  const fileContents = fs.readFileSync(fullPath, 'utf8')
  const { data, content } = matter(fileContents)
  const stats = readingTime(content)

  return {
    slug,
    title: data.title as string,
    date: data.date as string,
    excerpt: data.excerpt as string,
    tags: (data.tags as string[]) ?? [],
    readTime: stats.text,
    aiGenerated: (data.aiGenerated as boolean) ?? false,
    content,
  }
})
