import type { MetadataRoute } from 'next'
import { getAllPosts } from '@lib/posts'
import { getAllProjects } from '@lib/projects'
import { getAllDocSlugs as getBankxDocSlugs } from '@lib/bankx-docs'
import { getAllDocSlugs as getBasedAgentsDocSlugs } from '@lib/based-agents-docs'
import { getAllDocSlugs as getRufloDocSlugs } from '@lib/ruflo-orchestration-docs'

export default function sitemap(): MetadataRoute.Sitemap {
  const posts = getAllPosts()
  const projects = getAllProjects()
  // Every doc tree has to be listed explicitly: each exports its own
  // getAllDocSlugs, so a new project is invisible to the sitemap until it is
  // added here.
  const docTrees: Array<[string, string[][]]> = [
    ['BankX', getBankxDocSlugs()],
    ['BasedAgents', getBasedAgentsDocSlugs()],
    ['RufloOrchestration', getRufloDocSlugs()],
  ]

  const postUrls: MetadataRoute.Sitemap = posts.map((p) => ({
    url: `https://thinktanktom.com/writing/${p.slug}`,
    lastModified: p.date,
  }))

  const projectUrls: MetadataRoute.Sitemap = projects.map((p) => ({
    url: `https://thinktanktom.com/projects/${p.slug}`,
    lastModified: p.date,
  }))

  const docUrls: MetadataRoute.Sitemap = docTrees.flatMap(([project, slugs]) =>
    slugs.map((slug) => ({
      url: `https://thinktanktom.com/projects/${project}/${slug.join('/')}`,
      lastModified: new Date(),
    }))
  )

  return [
    { url: 'https://thinktanktom.com', lastModified: new Date() },
    { url: 'https://thinktanktom.com/writing', lastModified: new Date() },
    { url: 'https://thinktanktom.com/about', lastModified: new Date() },
    { url: 'https://thinktanktom.com/projects', lastModified: new Date() },
    { url: 'https://thinktanktom.com/experience', lastModified: new Date() },
    { url: 'https://thinktanktom.com/contributions', lastModified: new Date() },
    ...postUrls,
    ...projectUrls,
    ...docUrls,
  ]
}
