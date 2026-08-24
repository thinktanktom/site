import type { MetadataRoute } from 'next'
import { getAllPosts } from '@lib/posts'
import { getAllProjects } from '@lib/projects'

export default function sitemap(): MetadataRoute.Sitemap {
  const posts = getAllPosts()
  const projects = getAllProjects()

  const postUrls: MetadataRoute.Sitemap = posts.map((p) => ({
    url: `https://thinktanktom.com/writing/${p.slug}`,
    lastModified: p.date,
  }))

  const projectUrls: MetadataRoute.Sitemap = projects.map((p) => ({
    url: `https://thinktanktom.com/projects/${p.slug}`,
    lastModified: p.date,
  }))

  return [
    { url: 'https://thinktanktom.com', lastModified: new Date() },
    { url: 'https://thinktanktom.com/writing', lastModified: new Date() },
    { url: 'https://thinktanktom.com/about', lastModified: new Date() },
    { url: 'https://thinktanktom.com/projects', lastModified: new Date() },
    { url: 'https://thinktanktom.com/contributions', lastModified: new Date() },
    ...postUrls,
    ...projectUrls,
  ]
}
