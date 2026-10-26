import type { MetadataRoute } from 'next'
import { getAllPosts } from '@lib/posts'
import { getAllProjects } from '@lib/projects'
import { getAllDocParams } from '@lib/project-docs'

export default function sitemap(): MetadataRoute.Sitemap {
  const posts = getAllPosts()
  const projects = getAllProjects()
  // Derived from the same DOC_PROJECTS registry the routes are generated from,
  // so a new doc tree appears here automatically. This used to be a hand-kept
  // list of three, which is how every FractalWebhook doc page came to be absent
  // from the sitemap.
  const docParams = getAllDocParams()

  const postUrls: MetadataRoute.Sitemap = posts.map((p) => ({
    url: `https://thinktanktom.com/writing/${p.slug}`,
    lastModified: p.date,
  }))

  const projectUrls: MetadataRoute.Sitemap = projects.map((p) => ({
    url: `https://thinktanktom.com/projects/${p.slug}`,
    lastModified: p.date,
  }))

  const docUrls: MetadataRoute.Sitemap = docParams.map(({ slug, docSlug }) => ({
    url: `https://thinktanktom.com/projects/${slug}/${docSlug.join('/')}`,
    lastModified: new Date(),
  }))

  return [
    { url: 'https://thinktanktom.com', lastModified: new Date() },
    { url: 'https://thinktanktom.com/writing', lastModified: new Date() },
    { url: 'https://thinktanktom.com/about', lastModified: new Date() },
    /* /projects, /experience and /contributions merged into /work on
       2026-10-26 and their routes were DELETED, so those three URLs now 404.
       That was a deliberate URL-breaking change, Tom's call, made after
       weighing a signpost page against it -- do not re-add the old entries
       here, and do not re-create the routes, without asking. The static export
       on GitHub Pages has no redirect mechanism, so there is nothing else to
       list. */
    { url: 'https://thinktanktom.com/work', lastModified: new Date() },
    ...postUrls,
    ...projectUrls,
    ...docUrls,
  ]
}
