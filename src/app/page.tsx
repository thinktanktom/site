import type { Metadata } from 'next'
import Link from 'next/link'
import TrackingLogoFull from '@components/TrackingLogo'

/*
 * The landing page IS the former /about, as of 2026-10-26.
 *
 * `/about` was deleted and now 404s -- Tom's call, the same class of deliberate
 * URL break as the /projects, /experience and /contributions removals when
 * /work landed. A static export on GitHub Pages has no redirect mechanism, so
 * there was no middle option. Do not re-create the route or re-add it to
 * sitemap.ts without asking.
 *
 * REWRITTEN 2026-10-29: the ten-paragraph bio became three, and two blocks
 * below it were DELETED. Both deletions are Tom's call, not a cleanup:
 *
 *  - THE FOOTNOTES, and the three annotations in the prose that pointed at
 *    them. The new copy has no annotations -- only hyperlinks. This page was
 *    the hand-rolled half of the #ref-N <-> #note-N round trip that
 *    components/MDXContent.tsx implements as components, so that duplication
 *    is gone and `scripts/e2e-annotations.mjs` now covers the post alone. The
 *    components and the `.annot*` classes in globals.css are untouched and
 *    still in use on posts -- nothing about the annotation feature was
 *    removed, only this page's copy of its markup.
 *  - THE CURRENTLY BOX, replaced the same day by the Stack panel below. It reuses the deleted box's shell verbatim -- same border, same
 *    bg-surface/30, same accent mono section label -- and nothing else. Its
 *    contact surface did NOT come back: paragraph two carries the mailto and
 *    the Upwork link, which is why there is no CTA button on the page any
 *    more, and the availability dot is gone with it. So `--success` has no
 *    consumer on the site, exactly like `.pixel-grid`. KEEP THE TOKEN --
 *    lib/palette/validate.ts still gates it (success/bg, min 4.5) and
 *    lib/palette/generate.ts still pins its hue to 152 degrees, so deleting it
 *    fails the calibration tests.
 *
 * Three things here are decisions rather than leftovers:
 *
 *  - NO HEADLINE. "Hi, I'm Thomas Cyriac." was removed as redundant beside a
 *    lockup that already says the name. That leaves the page with no visible
 *    heading, which is why the `sr-only` h1 below is load-bearing rather than
 *    decorative: the mark is a `role="img"` span, not a heading, so without it
 *    the page has none at all.
 *  - NO HERO CTAs. "Read my writing" is a nav item, and since the Currently
 *    box went, hiring is the plain Upwork link in paragraph two.
 *  - NO "LATEST WRITING" SECTION. It moved off the page entirely rather than
 *    down it; the header already carries a Writing link. That is why this file
 *    no longer imports getAllPosts or PostCard.
 *
 * The email address is a plain mailto, chosen knowingly: it will be harvested,
 * and that is survivable because thomas@ came with the domain and can be
 * retired in one line if it ever floods. The measure that would actually help
 * is a replaceable address, not obfuscation, and that is already in place. It
 * must NOT be added to the Person JSON-LD in layout.tsx -- that would publish
 * it in machine-readable form on every page of the site rather than on this
 * one.
 */

/* Keep this in step with the bio's OPENING SENTENCE -- it is a hand-written
   paraphrase of it, not a slice of it, so nothing fails when they drift. It
   already did once: the description was aligned to the bio on 2026-10-29 and
   then the bio was revised the same day, leaving the live <meta> saying "in
   Coimbatore" and "Web3, AI and networking" while the page said "based out of
   Coimbatore" and "web3, machine learning and networking". Caught only by
   decoding the deployed page. 150 characters, inside the ~160 that gets shown. */
const description =
  'Thomas Cyriac — software engineer and independent researcher based out of Coimbatore, India. Six years across web3, machine learning and networking.'

export const metadata: Metadata = {
  description,
  alternates: { canonical: '/' },
  /* /about's metadata folded in here, minus its `type: 'profile'`: the root
     layout already declares `type: 'website'` for this URL and that is the
     correct one for a site's landing page. Everything else -- title, images,
     metadataBase -- is inherited from layout.tsx, so only the description and
     the canonical need stating. */
}

/* The one prose-link style on the site, verbatim from the `a` override in
   components/MDXContent.tsx so a link in this hand-written bio and a link in a
   post are the same pixels. Hoisted to a const because the new copy carries
   six of them; the emitted class string is unchanged either way. */
const link =
  'underline decoration-accent underline-offset-2 hover:text-accent transition-colors duration-200'

/* The Stack panel's content, 2026-10-29.
 *
 * It lives here rather than in lib/ ON PURPOSE. Everything under lib/ that
 * feeds a page is shared -- lib/experience.ts and lib/github.ts both feed
 * /work, and lib/work.ts exists precisely to relate them. This is page copy
 * with exactly one consumer, and moving it to lib/ would invite the next
 * reader to assume /work renders it too and to "fix" a drift that is not a
 * drift. The deleted Currently box made the same choice for the same reason,
 * and the only thing that went wrong there was a COMMENT claiming the box
 * could not drift from /work. So, plainly: this is hand-maintained, it is not
 * derived from lib/experience.ts, and it will drift unless edited. That is the
 * trade, not an oversight.
 *
 * A Domains section -- 8 titled one-sentence summaries -- shipped beside this
 * for part of 2026-10-29 and was then REMOVED at Tom's request as unnecessary.
 * Do not reinstate it from history; ask. The panel is the stack and nothing
 * else, which is why it carries a single h2 rather than two and no internal
 * divider.
 *
 * The chip class is lifted verbatim from the Stack component in
 * components/WorkEntryRow.tsx, and it is NEUTRAL (border-border, text-muted)
 * rather than accent-outlined. That is the "keep --accent disciplined" rule in
 * CLAUDE.md: /work renders its chips neutral because 22 rows of accent chips
 * would breach it, and 47 chips here is the same problem. Accent on this panel
 * is spent only on the two section labels. Do not reach for border-accent/30 --
 * it is documented for chips that carry an icon AND a label, and these carry
 * neither.
 */
const STACK: { category: string; items: string[] }[] = [
  { category: 'Languages', items: ['Solidity', 'Rust', 'TypeScript', 'JavaScript', 'Python', 'Java'] },
  { category: 'Smart Contracts', items: ['Hardhat', 'Foundry', 'OpenZeppelin', 'Chainlink', 'Soroban SDK', 'Circom / snarkjs'] },
  { category: 'Chains', items: ['Ethereum', 'BNB Chain', 'Arbitrum', 'Optimism', 'Avalanche', 'Polygon', 'Base', 'PulseChain', 'Stellar'] },
  { category: 'AI & Agents', items: ['Anthropic Claude', 'Claude Code', 'MCP', 'Ruflo / claude-flow', 'Multi-agent orchestration'] },
  { category: 'Backend & Infrastructure', items: ['Node.js', 'Spring Boot', 'MongoDB', 'SQLite', 'Docker', 'Caddy', 'DigitalOcean', 'AWS', 'Linux', 'GitHub Actions'] },
  { category: 'Frontend', items: ['React', 'Vite', 'Tailwind CSS', 'Shopify Liquid', 'Vercel'] },
  { category: 'Earlier Work', items: ['TensorFlow', 'PyTorch', 'OpenCV', 'dlib', 'MikroTik RouterOS', 'OpenWRT'] },
]


const chip = 'font-mono text-xs px-2 py-0.5 border border-border text-muted rounded-sm'

export default function HomePage() {
  return (
    <main className="pt-32 pb-24 px-6">
      {/* max-w-article (780px), NOT max-w-chrome. This page ran at 1100px until
          2026-10-29, which made it the only prose on the site that did not
          match its own reading measure: src/app/writing/page.tsx and
          writing/[slug]/page.tsx both wrap their bodies in max-w-article, and
          CLAUDE.md reserves 1100px for page chrome rather than body copy.

          Measured on the same text, 1100px against 780px: 9 lines becomes 13,
          and the average line falls from 109 characters to 76 (the worst
          paragraph from 127 to 85) -- 76 sits inside the ~55-75 a reader scans
          comfortably, 109 does not. It also drops the panel 112px further down
          the page, which is the other half of why this changed.

          The panel narrows with it deliberately --
          leaving it at chrome width would make it wider than the prose above
          it, and unlike /work (a 780px spine beside a 272px rail) there is
          nothing here to occupy the remainder. */}
      <div className="max-w-article mx-auto">
        {/* The page's only heading. See the note above -- it is not optional. */}
        <h1 className="sr-only">
          Thomas Cyriac — software engineer and independent researcher
        </h1>

        {/* Logo as title. The header deliberately drops its wordmark on this
            route (see components/Nav.tsx) because this is what replaces it. */}
        <div className="mb-16 flex justify-center">
          <TrackingLogoFull height={225} />
        </div>

        {/* Bio */}
        <div className="font-sans text-base text-text leading-[1.75] space-y-5">
          <p>
            I&rsquo;m Thomas, a software engineer and independent researcher based out of
            Coimbatore, India, with six years of experience across web3, machine learning and
            networking. From 2021 to 2026
            I was the lead smart contract engineer on{' '}
            <Link href="/projects/BankX/introduction" className={link}>BankX</Link>, a stablecoin
            protocol deployed across eight blockchains and audited by{' '}
            <a href="https://www.coinfabrik.com/" target="_blank" rel="noopener noreferrer" className={link}>
              CoinFabrik<span className="sr-only"> (opens in new tab)</span>
            </a>
            . I&rsquo;ve also built{' '}
            <Link href="/projects/RufloOrchestration/introduction" className={link}>self-hosted AI agent</Link>
            {' '}platforms for clients and{' '}
            <Link href="/projects/CtrlbitSDWAN" className={link}>SD-WAN tooling</Link> for MikroTik
            routers.
          </p>
          <p>
            Most of my work happens directly with the people who need it and I deeply enjoy
            simplifying complicated ideas into well-defined systems. If you have something
            you&rsquo;d like to build, or an idea you want to pressure-test, email me at{' '}
            <a href="mailto:thomas@thinktanktom.com" className={link}>thomas@thinktanktom.com</a>
            {' '}or find me on{' '}
            <a href="https://www.upwork.com/freelancers/~018a1dbf1094588c7e" target="_blank" rel="noopener noreferrer" className={link}>
              Upwork<span className="sr-only"> (opens in new tab)</span>
            </a>
            .
          </p>
          <p>
            Outside work, I play amateur football, surf and teach yoga as a certified instructor.
            I read widely across fiction, history and research oriented literature, and write{' '}
            <Link href="/writing" className={link}>essays</Link> that untangle technology and
            mathematics for people who find them overwhelming.
          </p>
        </div>

        {/* Stack, in the shell the deleted Currently box used. It is a <dl>
            because it is label-to-value pairs rather than a list: a category to
            its tools. The dt/dd groups are wrapped in <div>s, which HTML allows
            inside <dl> and which is what lets each one be a grid row. */}
        <section className="mt-16 p-6 border border-border rounded-sm bg-surface/30">
          <h2 className="font-mono text-xs tracking-widest uppercase text-accent">Stack</h2>

          {/* Label beside its chips from sm up, stacked below it below that --
              any label gutter wide enough for these is most of a 375px
              viewport.

              13rem is MEASURED, not picked. The gutter has to clear the longest
              label on one line: "Backend & Infrastructure" needs 191px in Space
              Mono 12px uppercase at tracking-wider, and "Smart Contracts" (the
              longest that is obviously safe) measures 119px. At 11rem/176px the
              long one wrapped to two lines at EVERY width -- stable, so it read
              as a mistake rather than as reflow. 13rem/208px puts all seven on
              one line with 17px spare. Re-measure with a Range over the text
              node if a category is renamed: the <dt> element box is stretched
              to the grid row height and tells you nothing about wrapping. */}
          <dl className="mt-5 space-y-4">
            {STACK.map(({ category, items }) => (
              <div key={category} className="sm:grid sm:grid-cols-[13rem_1fr] sm:gap-4">
                <dt className="font-mono text-xs tracking-wider uppercase text-muted sm:pt-1">
                  {category}
                </dt>
                <dd className="mt-2 flex flex-wrap gap-2 sm:mt-0">
                  {items.map((item) => (
                    <span key={item} className={chip}>
                      {item}
                    </span>
                  ))}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </main>
  )
}
