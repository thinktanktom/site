import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { getAllDocSlugs, getDocBySlug, getAdjacentPages } from '@lib/bankx-docs'
import MDXContent from '@components/MDXContent'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface Props {
  params: { slug: string[] }
}

export function generateStaticParams() {
  return getAllDocSlugs().map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const doc = getDocBySlug(params.slug)
  if (!doc) return {}
  const title = `${doc.title} — BankX Protocol`
  const description = `BankX Protocol documentation: ${doc.title}`
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
      url: `https://thinktanktom.com/projects/BankX/${params.slug.join('/')}`,
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

export default function BankXDocPage({ params }: Props) {
  const doc = getDocBySlug(params.slug)
  if (!doc) notFound()

  const { prev, next } = getAdjacentPages(params.slug)

  return (
    <>
      <header className="mb-10">
        <p className="font-mono text-xs text-muted tracking-widest uppercase mb-3">
          {params.slug.length > 1 ? params.slug[0] : 'Overview'}
        </p>
        <h1 className="font-mono text-3xl sm:text-4xl tracking-tight text-text leading-tight">
          {doc.title}
        </h1>
      </header>

      <article className="prose-doc">
        <MDXContent source={doc.content} />
      </article>

      {/* Prev / Next navigation — hidden on the first page */}
      {!(params.slug.length === 1 && params.slug[0] === 'introduction') && (
        <nav className="mt-16 pt-8 border-t border-border flex items-center justify-between gap-4">
          {prev ? (
            <Link
              href={`/projects/BankX/${prev.slug.join('/')}`}
              className="group flex items-center gap-2 font-mono text-sm text-muted hover:text-accent transition-colors duration-200"
            >
              <ChevronLeft size={14} className="shrink-0" />
              <span className="text-left">
                <span className="block text-[10px] tracking-widest uppercase text-muted/50 mb-0.5">
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
              href={`/projects/BankX/${next.slug.join('/')}`}
              className="group flex items-center gap-2 font-mono text-sm text-muted hover:text-accent transition-colors duration-200 text-right"
            >
              <span className="text-right">
                <span className="block text-[10px] tracking-widest uppercase text-muted/50 mb-0.5">
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
