import Link from 'next/link'
import type { PostMeta } from '@lib/posts'
import { formatMonthYear } from '@lib/format'

export default function PostCard({ post }: { post: PostMeta }) {
  return (
    <Link href={`/writing/${post.slug}`} className="block group">
      <article className="border border-border rounded-sm p-6 bg-surface/20 hover:border-accent/40 hover:-translate-y-1 transition-all duration-300">
        <time className="block font-mono text-xs text-muted tracking-wider mb-3">
          {formatMonthYear(post.date)}
        </time>

        <h3 className="font-mono text-xl tracking-tight text-text group-hover:text-accent transition-colors duration-200 mb-2 leading-snug">
          {post.title}
        </h3>

        <p className="font-sans text-sm text-muted leading-relaxed mb-4">
          {post.excerpt}
        </p>

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
      </article>
    </Link>
  )
}
