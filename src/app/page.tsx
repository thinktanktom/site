import type { Metadata } from 'next'
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
 * Three things here are decisions rather than leftovers:
 *
 *  - NO HEADLINE. "Hi, I'm Thomas Cyriac." was removed as redundant beside a
 *    lockup that already says the name. That leaves the page with no visible
 *    heading, which is why the `sr-only` h1 below is load-bearing rather than
 *    decorative: the mark is a `role="img"` span, not a heading, so without it
 *    the page has none at all.
 *  - NO HERO CTAs. "Read my writing" is a nav item and "Hire me on Upwork" is
 *    the button inside the Currently box, so the hero is just the lockup.
 *  - NO "LATEST WRITING" SECTION. It moved off the page entirely rather than
 *    down it; the header already carries a Writing link. That is why this file
 *    no longer imports getAllPosts or PostCard.
 */

const description =
  'Thomas Cyriac — DeFi Protocol Developer, Smart Contract Engineer, Open Source Contributor.'

export const metadata: Metadata = {
  description,
  alternates: { canonical: '/' },
  /* /about's metadata folded in here, minus its `type: 'profile'`: the root
     layout already declares `type: 'website'` for this URL and that is the
     correct one for a site's landing page. Everything else -- title, images,
     metadataBase -- is inherited from layout.tsx, so only the description and
     the canonical need stating. */
}

export default function HomePage() {
  return (
    <main className="pt-32 pb-24 px-6">
      <div className="max-w-chrome mx-auto">
        {/* The page's only heading. See the note above -- it is not optional. */}
        <h1 className="sr-only">
          Thomas Cyriac — DeFi protocol developer and smart contract engineer
        </h1>

        {/* Logo as title. The header deliberately drops its wordmark on this
            route (see components/Nav.tsx) because this is what replaces it. */}
        <div className="mb-16 flex justify-center">
          <TrackingLogoFull height={225} />
        </div>

        {/* Bio */}
        <div className="mb-16">
          <div className="font-sans text-base text-text leading-[1.75] space-y-5">
            <p>
              &ldquo;What do you actually do?&rdquo; People have asked me this for years, my relations most of all,
              and my answer never quite lands, no matter how I phrase it. The trouble is not that I lack an answer.
              It is that the honest one sounds absurd: I am an engineer who refused, on principle, to become any
              particular kind of engineer.
            </p>
            <p>
              That refusal was deliberate. To specialise seemed to me a small tragedy, like marrying young and
              forever wondering about all the marvellous problems you never courted. So I turned down the corporate
              label, and the pretentious posture that tends to come stapled to it, and gave myself instead to the
              one thing I genuinely enjoyed: solving puzzles.
            </p>
            <p>
              The first puzzle found me at university, where I tumbled by happy accident into image processing.
              I read the papers. I redid <a id="ref-1" href="#note-1" className="annot"><span className="annot-phrase">the mathematics by hand</span>¹<span className="sr-only"> (see note 1)</span></a> and then helped developers at a string of startups turn that arithmetic
              into something that actually ran, in Python and in C++. They were splendid years, and they left me
              with one article of faith I came to hold rather fanatically: that anything a human mind had dreamt
              up, my mind could learn. Nothing lay beyond the reach of learning.
            </p>
            <p>
              That certainty was promptly put to the test. Fortified by it, I strode into a blockchain department
              — and was fired by the end of the week.
            </p>
            <p>
              I declined to take the hint; one cannot, after all, fire a belief. So in 2021 I joined Nord Finance
              and spent three months learning to build, test, break, and deploy. They offered me a full-time post,
              a flattering gesture, but my freelancing had by then grown plump enough to feed itself.
            </p>
            <p>
              That same year brought the{' '}
              <a href="https://bankx.io" target="_blank" rel="noopener noreferrer" className="underline decoration-accent underline-offset-2 hover:text-accent transition-colors duration-200">BankX<span className="sr-only"> (opens in new tab)</span></a>
              {' '}contract, my first big break and the most interesting and ambitious project I&apos;d taken up
              so far. It has since been deployed on 8 chains and is in the early stages of marketing and promotion.
            </p>
            <p>
              Alongside it I&apos;ve built smart contracts in Rust as well as Solidity, a signal pipeline for a
              futures-trading bot, agentic server boxes and workflows, and the occasional patch to
              OpenZeppelin&apos;s open-source code.
            </p>
            <p>
              Outside work, I play amateur football, surf at an intermediate level, teach yoga as a certified
              instructor, and am an avid reader of all things <a id="ref-2" href="#note-2" className="annot"><span className="annot-phrase">fiction and historical</span>²<span className="sr-only"> (see note 2)</span></a>.
            </p>
            <p>
              All of which brings me, at last, to the point of this page. I grew up on science fiction, on drunk
              inventors and mad scientists and the moral tangles their contraptions left behind. I idolised those
              characters, and I loved most the quiet introspection each story left me with at the end. I have not
              yet built anything that threatens the <a id="ref-3" href="#note-3" className="annot"><span className="annot-phrase">species</span>³<span className="sr-only"> (see note 3)</span></a>, but the instinct remains the
              same: to dream of a better future, to wander toward the impossible, to build with enthusiasm, and
              then to sit with what it all means. That is what I actually do.
            </p>
          </div>
        </div>

        {/* Footnotes. Hand-rolled here, but deliberately the same markup as the
            Annotated / Notes / Note components in components/MDXContent.tsx —
            including the #ref-N ↔ #note-N anchor round trip. Change one, change
            both. scroll-mt-24 (96px) clears the fixed 64px nav. */}
        <div className="mb-16 pt-6 border-t border-border">
          <div className="font-mono text-xs leading-relaxed space-y-1">
            <p id="note-1" className="annot-note"><a href="#ref-1" className="annot" aria-label="Back to annotation 1 in the text">1.</a><span className="text-muted"> for I have never believed an equation simply because it asked nicely</span></p>
            <p id="note-2" className="annot-note"><a href="#ref-2" className="annot" aria-label="Back to annotation 2 in the text">2.</a><span className="text-muted"> I keep a one arms distance from self-help books</span></p>
            <p id="note-3" className="annot-note"><a href="#ref-3" className="annot" aria-label="Back to annotation 3 in the text">3.</a><span className="text-muted"> which my relations will find reassuring</span></p>
          </div>
        </div>

        {/* Currently — rewritten 2026-10-26 from a list of what Tom is working
            on into the place someone hires him from. The three lines are drawn
            from lib/experience.ts rather than written fresh, so this box cannot
            drift from what /work says.

            The address is a plain mailto, chosen knowingly: it will be
            harvested, and that is survivable because thomas@ came with the
            domain and can be retired in one line if it ever floods. The
            measure that would actually help is a replaceable address, not
            obfuscation, and that is already in place. It must NOT be added to
            the Person JSON-LD in layout.tsx — that would publish it in
            machine-readable form on every page of the site rather than on this
            one. */}
        <div className="mb-16 p-6 border border-border rounded-sm bg-surface/30">
          <h2 className="font-mono text-xs tracking-widest uppercase text-accent mb-5">
            Currently
          </h2>

          <p className="font-sans text-base text-text leading-[1.75] flex items-start gap-3">
            {/* Availability indicator. --success is the token that exists for
                exactly this and was otherwise unused on the site. aria-hidden
                because the sentence beside it already says the same thing —
                the dot is reinforcement, not information. */}
            <span
              aria-hidden="true"
              className="mt-[0.6em] h-2 w-2 shrink-0 rounded-full bg-success"
            />
            <span>I take contract work through Upwork, or mail me about opportunities.</span>
          </p>

          <ul className="font-sans text-base text-text leading-[1.75] space-y-2 list-disc pl-4 mt-5">
            <li>
              <strong className="font-medium">Smart contracts and protocol work.</strong> Solidity and
              Rust, multi-chain deploys across Ethereum, Polygon, PulseChain, BSC and Base.
            </li>
            <li>
              <strong className="font-medium">Anything AI.</strong> Inference, reinforcement learning,
              building products, and self-hosted agent-orchestration infrastructure. I like exploring
              how it is landing in different fields.
            </li>
            <li>
              <strong className="font-medium">Anything technically challenging.</strong> I am generally
              open, including problems outside both lists.
            </li>
          </ul>

          <div className="mt-6">
            <a
              href="https://www.upwork.com/freelancers/~018a1dbf1094588c7e"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block font-mono text-sm tracking-wider px-6 py-3 bg-accent text-bg font-bold hover:bg-accent-dim transition-colors duration-200 rounded-sm"
            >
              Hire me on Upwork ↗
              <span className="sr-only"> (opens in new tab)</span>
            </a>
          </div>

          <div className="mt-6 pt-6 border-t border-border">
            <p className="font-sans text-base text-muted leading-[1.75]">
              Not hiring? I read and argue about new tech for fun. If you have something genuinely
              interesting going on, nerd-snipe me at{' '}
              <a
                href="mailto:thomas@thinktanktom.com"
                className="font-mono text-accent underline underline-offset-4 hover:text-accent-dim transition-colors duration-200"
              >
                thomas@thinktanktom.com
              </a>
              .
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}
