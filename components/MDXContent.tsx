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
