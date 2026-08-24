import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { getAllPosts, getPostBySlug } from '@lib/posts'
import MDXContent from '@components/MDXContent'

interface Props {
  params: { slug: string }
}

export function generateStaticParams() {
  return getAllPosts().map((p) => ({ slug: p.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = getPostBySlug(params.slug)
  if (!post) return {}
  return {
    title: post.title,
    description: post.excerpt,
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: 'article',
      publishedTime: post.date,
      url: `https://thinktanktom.com/writing/${params.slug}`,
      siteName: 'thinktanktom',
      images: ['/ttt_logo.png'],
      tags: post.tags,
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.excerpt,
      images: ['/ttt_logo.png'],
    },
  }
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

export default function PostPage({ params }: Props) {
  const post = getPostBySlug(params.slug)
  if (!post) notFound()

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.excerpt,
    datePublished: post.date,
    keywords: post.tags.join(', '),
    author: {
      '@type': 'Person',
      name: 'Thomas Cyriac',
      url: 'https://thinktanktom.com',
    },
    publisher: {
      '@type': 'Person',
      name: 'Thomas Cyriac',
      url: 'https://thinktanktom.com',
    },
    url: `https://thinktanktom.com/writing/${params.slug}`,
    image: 'https://thinktanktom.com/ttt_logo.png',
  }

  return (
    <main className="pt-32 pb-24 px-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="max-w-article mx-auto">
        <Link
          href="/writing"
          className="font-mono text-sm text-muted hover:text-accent tracking-wider transition-colors duration-200 mb-10 inline-block"
        >
          ← Back to writing
        </Link>

        <header className="mt-6 mb-12">
          <div className="flex flex-wrap items-center gap-3 mb-5">
            <time dateTime={post.date} className="font-mono text-xs text-muted tracking-wider">
              {formatDate(post.date)}
            </time>
            <span className="text-border">·</span>
            <span className="font-mono text-xs text-muted">{post.readTime}</span>
          </div>

          <h1 className="font-mono text-3xl sm:text-4xl lg:text-5xl tracking-tight text-text mb-6 leading-tight">
            {post.title}
          </h1>

          <div className="flex flex-wrap gap-2">
            {post.tags.map((tag) => (
              <span
                key={tag}
                className="font-mono text-xs px-2 py-0.5 border border-border text-muted rounded-sm"
              >
                {tag}
              </span>
            ))}
          </div>
        </header>

        <article>
          <MDXContent source={post.content} />
        </article>
      </div>
    </main>
  )
}
