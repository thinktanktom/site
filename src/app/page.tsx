import Image from 'next/image'
import Link from 'next/link'
import { getAllPosts } from '@lib/posts'
import PostCard from '@components/PostCard'

export default function HomePage() {
  const posts = getAllPosts().slice(0, 3)

  return (
    <>
      {/* Hero */}
      <section className="min-h-screen flex flex-col items-center justify-center relative px-6 overflow-hidden">
        <div className="pixel-grid absolute inset-0 opacity-40" />

        <div className="relative z-10 flex flex-col items-center text-center max-w-article mx-auto">
          <div className="animate-fade-up" style={{ animationDelay: '0ms' }}>
            <Image
              src="/ttt_icon.svg"
              alt="thinktanktom"
              width={96}
              height={96}
              className="mx-auto mb-8 object-contain"
              unoptimized
              priority
            />
          </div>

          <h1
            className="font-mono text-4xl sm:text-5xl lg:text-6xl tracking-tight leading-tight mb-6 animate-fade-up"
            style={{ animationDelay: '150ms' }}
          >
            Hi, I&apos;m{' '}
            <span className="text-accent">Thomas Cyriac.</span>
          </h1>

          <p
            className="font-sans text-lg sm:text-xl text-muted leading-relaxed mb-10 max-w-[560px] animate-fade-up"
            style={{ animationDelay: '300ms' }}
          >
            A modern day engineer with a penchant for dry humour.
          </p>

          <div
            className="flex flex-col sm:flex-row gap-4 animate-fade-up"
            style={{ animationDelay: '450ms' }}
          >
            <Link
              href="/writing"
              className="font-mono text-sm tracking-wider px-6 py-3 bg-accent text-bg font-bold hover:bg-accent-dim transition-colors duration-200 rounded-sm"
            >
              Read my writing →
            </Link>
            <a
              href="https://www.upwork.com/freelancers/thinktanktom"
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-sm tracking-wider px-6 py-3 border border-accent text-accent hover:bg-accent hover:text-bg transition-all duration-200 rounded-sm"
            >
              Hire me on Upwork ↗
            </a>
          </div>
        </div>
      </section>

      {/* Latest writing */}
      <section className="py-24 px-6">
        <div className="max-w-chrome mx-auto">
          <h2 className="font-mono text-2xl sm:text-3xl tracking-wide mb-12 text-text">
            Latest writing.
          </h2>

          {posts.length > 0 ? (
            <>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {posts.map((post) => (
                  <PostCard key={post.slug} post={post} />
                ))}
              </div>
              <div className="mt-12">
                <Link
                  href="/writing"
                  className="font-mono text-sm text-muted hover:text-accent tracking-wider transition-colors duration-200"
                >
                  View all writing →
                </Link>
              </div>
            </>
          ) : (
            <p className="font-sans text-muted">No posts yet — check back soon.</p>
          )}
        </div>
      </section>

    </>
  )
}
