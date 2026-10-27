import type { Metadata } from 'next'
import TrackingLogoFull from '@components/TrackingLogo'

const description =
  'Thomas Cyriac — DeFi Protocol Developer, Smart Contract Engineer, Open Source Contributor.'

export const metadata: Metadata = {
  title: 'About',
  description,
  alternates: { canonical: '/about' },
  openGraph: {
    title: 'About — thinktanktom',
    description,
    type: 'profile',
    url: 'https://thinktanktom.com/about',
    siteName: 'thinktanktom',
    images: ['/ttt_logo.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'About — thinktanktom',
    description,
    images: ['/ttt_logo.png'],
  },
}

export default function AboutPage() {
  return (
    <main className="pt-32 pb-24 px-6">
      <div className="max-w-chrome mx-auto">
        <h1 className="sr-only">About Thomas Cyriac</h1>

        {/* Logo as title */}
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


        {/* Currently */}
        <div className="mb-16 p-6 border border-border rounded-sm bg-surface/30">
          <h2 className="font-mono text-xs tracking-widest uppercase text-accent mb-5">
            Currently
          </h2>
          <ul className="font-sans text-base text-text leading-[1.75] space-y-2 list-disc pl-4">
            <li>Building CollabGraph, A GitHub App and AT Protocol AppView that turns your pull request and review history into a verifiable, portable collaboration graph you own.</li>
            <li>
              Building and hardening self-hosted Claude Code / Ruflo agent-orchestration infrastructure for a client — the servers, not the product the agents build with them.
            </li>
            <li>Setting up AI supplemented environments to ship code more efficiently</li>
            <li>Constantly worrying about identity and data ownership.</li>
          </ul>
        </div>


      </div>
    </main>
  )
}
