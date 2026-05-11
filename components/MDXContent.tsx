import { MDXRemote } from 'next-mdx-remote/rsc'
import remarkGfm from 'remark-gfm'
import rehypePrettyCode from 'rehype-pretty-code'
import type { BundledTheme } from 'shiki'

const prettyCodeOptions = {
  theme: 'one-dark-pro' as BundledTheme,
  keepBackground: true,
}

const components = {
  h2: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h2
      {...props}
      className="font-mono text-2xl tracking-wide mt-12 mb-4 pl-4 border-l-[3px] border-accent text-text"
    />
  ),
  h3: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h3
      {...props}
      className="font-mono text-xl tracking-wide mt-8 mb-3 pl-4 border-l-[3px] border-accent text-text"
    />
  ),
  h4: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h4
      {...props}
      className="font-mono text-base tracking-wide mt-6 mb-2 text-text"
    />
  ),
  code: (props: React.HTMLAttributes<HTMLElement>) => {
    // Block code is handled by rehype-pretty-code; only style inline code here
    const isInline = !('data-language' in props)
    if (!isInline) return <code {...props} />
    return (
      <code
        {...props}
        className="font-mono text-[0.85em] text-accent bg-surface border border-border px-1.5 py-0.5 rounded-sm"
      />
    )
  },
  table: (props: React.HTMLAttributes<HTMLTableElement>) => (
    <div className="overflow-x-auto my-6">
      <table
        {...props}
        className="w-full border-collapse font-mono text-sm"
      />
    </div>
  ),
  thead: (props: React.HTMLAttributes<HTMLTableSectionElement>) => (
    <thead {...props} className="border-b border-accent/40" />
  ),
  th: (props: React.ThHTMLAttributes<HTMLTableCellElement>) => (
    <th
      {...props}
      className="text-left py-2 px-3 font-mono text-xs tracking-widest uppercase text-muted"
    />
  ),
  td: (props: React.TdHTMLAttributes<HTMLTableCellElement>) => (
    <td
      {...props}
      className="py-2 px-3 border-b border-border text-text align-top"
    />
  ),
  tr: (props: React.HTMLAttributes<HTMLTableRowElement>) => (
    <tr {...props} className="hover:bg-surface/60 transition-colors duration-100" />
  ),
  p: (props: React.HTMLAttributes<HTMLParagraphElement>) => (
    <p {...props} className="font-sans text-base text-text leading-[1.75] mb-5" />
  ),
  a: (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a
      {...props}
      className="underline decoration-accent underline-offset-2 hover:text-accent transition-colors duration-200"
      target={props.href?.startsWith('http') ? '_blank' : undefined}
      rel={props.href?.startsWith('http') ? 'noopener noreferrer' : undefined}
    />
  ),
  blockquote: (props: React.HTMLAttributes<HTMLElement>) => (
    <blockquote
      {...props}
      className="border-l-[3px] border-accent pl-6 my-6 italic text-muted font-sans"
    />
  ),
  ul: (props: React.HTMLAttributes<HTMLUListElement>) => (
    <ul
      {...props}
      className="font-sans text-base text-text leading-[1.75] mb-5 pl-6 list-disc space-y-1"
    />
  ),
  ol: (props: React.HTMLAttributes<HTMLOListElement>) => (
    <ol
      {...props}
      className="font-sans text-base text-text leading-[1.75] mb-5 pl-6 list-decimal space-y-1"
    />
  ),
  img: (props: React.ImgHTMLAttributes<HTMLImageElement>) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      {...props}
      alt={props.alt ?? ''}
      className="w-full rounded-sm border border-border my-8 block"
    />
  ),
}

export default function MDXContent({ source }: { source: string }) {
  return (
    <MDXRemote
      source={source}
      components={components}
      options={{
        mdxOptions: {
          remarkPlugins: [remarkGfm],
          rehypePlugins: [[rehypePrettyCode, prettyCodeOptions]],
        },
      }}
    />
  )
}
