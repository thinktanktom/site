import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import {
  DOC_PROJECTS,
  isDocProject,
  getAllDocParams,
  getDocBySlug,
  getAdjacentPages,
} from '@lib/project-docs'
import MDXContent from '@components/MDXContent'
import { ChevronLeft, ChevronRight } from 'lucide-react'

// One page for every project doc tree, replacing four copies that had already
// drifted: BasedAgents and FractalWebhook were missing both the canonical URL
// and the BreadcrumbList that BankX and RufloOrchestration shipped. With a
// single code path that divergence cannot recur.
//
// URLs are unchanged — /projects/BankX/introduction still resolves here, because
// the catch-all is nested under the existing [slug] segment rather than adding a
// /docs/ segment. App Router also forbids a second, differently-named dynamic
// sibling at this level, which [slug]/page.tsx already occupies.
interface Props {
  params: { slug: string; docSlug: string[] }
}

export function generateStaticParams() {
  return getAllDocParams()
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  if (!isDocProject(params.slug)) return {}
  const doc = getDocBySlug(params.slug, params.docSlug)
  if (!doc) return {}

  const project = DOC_PROJECTS[params.slug]
  const title = `${doc.title} — ${project.label}`
  const description = `${project.descriptionPrefix}: ${doc.title}`
  const canonical = `/projects/${params.slug}/${params.docSlug.join('/')}`

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      type: 'article',
      url: `https://thinktanktom.com${canonical}`,
      siteName: 'thinktanktom',
      images: ['/ttt_logo.png'],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ['/ttt_logo.png'],
    },
  }
}

export default function ProjectDocPage({ params }: Props) {
  if (!isDocProject(params.slug)) notFound()
  const doc = getDocBySlug(params.slug, params.docSlug)
  if (!doc) notFound()

  const project = DOC_PROJECTS[params.slug]
  const { prev, next } = getAdjacentPages(params.slug, params.docSlug)
  const basePath = `/projects/${params.slug}`
  const docPath = `${basePath}/${params.docSlug.join('/')}`

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://thinktanktom.com' },
      { '@type': 'ListItem', position: 2, name: 'Projects', item: 'https://thinktanktom.com/projects' },
      {
        '@type': 'ListItem',
        position: 3,
        name: project.label,
        item: `https://thinktanktom.com${basePath}`,
      },
      {
        '@type': 'ListItem',
        position: 4,
        name: doc.title,
        item: `https://thinktanktom.com${docPath}`,
      },
    ],
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <header className="mb-10">
        <p className="font-mono text-xs text-muted tracking-widest uppercase mb-3">
          {params.docSlug.length > 1 ? params.docSlug[0] : 'Overview'}
        </p>
        <h1 className="font-mono text-3xl sm:text-4xl tracking-tight text-text leading-tight">
          {doc.title}
        </h1>
      </header>

      <article className="prose-doc">
        <MDXContent source={doc.content} />
      </article>

      {/* Prev / Next navigation — hidden on the first page */}
      {!(params.docSlug.length === 1 && params.docSlug[0] === 'introduction') && (
        <nav className="mt-16 pt-8 border-t border-border flex items-center justify-between gap-4">
          {prev ? (
            <Link
              href={`${basePath}/${prev.slug.join('/')}`}
              className="group flex items-center gap-2 font-mono text-sm text-muted hover:text-accent transition-colors duration-200"
            >
              <ChevronLeft size={14} className="shrink-0" />
              <span className="text-left">
                <span className="block text-[10px] tracking-widest uppercase text-muted mb-0.5">
                  Previous
                </span>
                {prev.title}
              </span>
            </Link>
          ) : (
            <div />
          )}

          {next ? (
            <Link
              href={`${basePath}/${next.slug.join('/')}`}
              className="group flex items-center gap-2 font-mono text-sm text-muted hover:text-accent transition-colors duration-200 text-right"
            >
              <span className="text-right">
                <span className="block text-[10px] tracking-widest uppercase text-muted mb-0.5">
                  Next
                </span>
                {next.title}
              </span>
              <ChevronRight size={14} className="shrink-0" />
            </Link>
          ) : (
            <div />
          )}
        </nav>
      )}
    </>
  )
}
