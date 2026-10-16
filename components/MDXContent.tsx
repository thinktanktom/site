import { MDXRemote } from 'next-mdx-remote/rsc'
import remarkGfm from 'remark-gfm'
import rehypePrettyCode from 'rehype-pretty-code'
import type { Options } from 'rehype-pretty-code'

// An object `theme` makes rehype-pretty-code pass defaultColor:false to Shiki,
// which emits --shiki-funky / --shiki-dark / --shiki-light per token span (and
// the -bg pair on the <pre>) instead of a baked-in `color`. The keys become the
// variable suffixes verbatim. The CSS that selects between them lives in
// src/app/globals.css, anchored at html[data-theme=…] because
// rehype-pretty-code sets its own data-theme attribute on every <pre>/<code>.
//
// IMPORTANT: 'dark' and 'light' are NOT page themes — the site ships only funky
// and random. They are kept here purely as the two POLARITY variable sets the
// random theme borrows: Shiki runs at build time and a randomly generated
// palette does not exist then, so globals.css maps
// html[data-theme='random'][data-polarity='dark'|'light'] onto --shiki-dark /
// --shiki-light. Delete either key and every random-theme reader gets unstyled
// code blocks. For the same reason there is deliberately no 'random' key: it
// would emit a set of variables nothing could ever select.
const prettyCodeOptions = {
  theme: {
    funky: 'one-dark-pro',
    dark: 'vesper',
    light: 'vitesse-light',
  },
  keepBackground: true,
} satisfies Options

// Unicode superscript digits, as used for the footnote markers on /about
const superscripts = ['', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹']

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
  a: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => {
    const isExternal = props.href?.startsWith('http')
    return (
      <a
        {...props}
        className="underline decoration-accent underline-offset-2 hover:text-accent transition-colors duration-200"
        target={isExternal ? '_blank' : undefined}
        rel={isExternal ? 'noopener noreferrer' : undefined}
      >
        {children}
        {isExternal && <span className="sr-only"> (opens in new tab)</span>}
      </a>
    )
  },
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
  // Inline annotation: the phrase is set in --accent with a solid accent
  // underline, followed by an accent superscript that refers to a numbered note
  // in the <Notes> block at the foot of the post.
  //
  // The phrase and its marker together are one <a> pointing at #note-N, and the
  // note's number points back at #ref-N. The round trip is plain HTML anchors —
  // no JavaScript, no history API, no scroll listener — so it works in the
  // static export and with JS off. The whole phrase is the hit target rather
  // than the ~6px superscript, which carries one constraint: an Annotated
  // phrase must NOT contain a markdown link, because that nests <a> inside <a>.
  // The parser drops the inner one and the annotation stops working.
  //
  // The .annot / .annot-phrase / .annot-note classes carry the styling and the
  // scroll-margin that clears the fixed nav; see globals.css for why they are
  // real classes rather than the equivalent Tailwind utility strings.
  //
  // NO aria-label on this one, deliberately. An aria-label REPLACES a link's
  // text as its accessible name, and this link's text is a phrase in the middle
  // of a sentence — labelling it "Jump to note 1" deletes the phrase from the
  // prose for anyone using a screen reader, leaving a hole in the paragraph. An
  // sr-only suffix adds the cue instead of overwriting the sentence, which is
  // the same pattern /about already uses for "(opens in new tab)".
  Annotated: ({ n, children }: { n: number; children?: React.ReactNode }) => (
    <a id={`ref-${n}`} href={`#note-${n}`} className="annot">
      <span className="annot-phrase">{children}</span>
      {superscripts[n] ?? n}
      <span className="sr-only"> (see note {n})</span>
    </a>
  ),
  Notes: (props: { children?: React.ReactNode }) => (
    <div className="mt-16 pt-6 border-t border-border">
      <div className="font-mono text-xs leading-relaxed space-y-1">{props.children}</div>
    </div>
  ),
  // The back-link DOES take an aria-label: its text is a bare "1.", which is
  // not prose and means nothing read aloud on its own, so there is no sentence
  // to damage by naming it.
  Note: ({ n, children }: { n: number; children?: React.ReactNode }) => (
    <p id={`note-${n}`} className="annot-note">
      <a href={`#ref-${n}`} className="annot" aria-label={`Back to annotation ${n} in the text`}>
        {n}.
      </a>
      <span className="text-muted"> {children}</span>
    </p>
  ),
  img: (props: React.ImgHTMLAttributes<HTMLImageElement>) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      loading="lazy"
      decoding="async"
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
