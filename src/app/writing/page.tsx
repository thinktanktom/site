import type { Metadata } from 'next'
import { getAllPosts } from '@lib/posts'
import PostCard from '@components/PostCard'

export const metadata: Metadata = {
  title: 'Writing',
  description: 'Thoughts on tech, tools, and the craft of building things.',
}

export default function WritingPage() {
  const posts = getAllPosts()

  return (
    <main className="pt-32 pb-24 px-6">
      <div className="max-w-article mx-auto">
        <h1 className="font-mono text-4xl sm:text-5xl lg:text-6xl tracking-tight mb-4 text-text">
          Writing.
        </h1>
        <p className="font-sans text-lg text-muted mb-16 leading-relaxed">
          Thoughts on tech, tools, and the craft of building things.
        </p>

        {posts.length > 0 ? (
          <div className="flex flex-col gap-6">
            {posts.map((post) => (
              <PostCard key={post.slug} post={post} />
            ))}
          </div>
        ) : (
          <p className="font-sans text-muted">No posts yet — check back soon.</p>
        )}
      </div>
    </main>
  )
}
