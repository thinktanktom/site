import type { Metadata } from 'next'
import Image from 'next/image'

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
          <Image
            src="/ttt_logo_full.svg"
            alt="thinktanktom"
            width={400}
            height={225}
            className="object-contain"
            unoptimized
            priority
          />
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
              I read the papers. I redid <span className="text-accent underline underline-offset-4">the mathematics by hand</span><span className="text-accent">¹</span> and then helped developers at a string of startups turn that arithmetic
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
              <a href="https://bankx.io" target="_blank" rel="noopener noreferrer" className="text-accent underline underline-offset-4 hover:text-accent-dim transition-colors">BankX</a>
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
              instructor, and am an avid reader of all things <span className="text-accent underline underline-offset-4">fiction and historical</span><span className="text-accent">²</span>.
            </p>
            <p>
              All of which brings me, at last, to the point of this page. I grew up on science fiction, on drunk
              inventors and mad scientists and the moral tangles their contraptions left behind. I idolised those
              characters, and I loved most the quiet introspection each story left me with at the end. I have not
              yet built anything that threatens the <span className="text-accent underline underline-offset-4">species</span><span className="text-accent">³</span>, but the instinct remains the
              same: to dream of a better future, to wander toward the impossible, to build with enthusiasm, and
              then to sit with what it all means. That is what I actually do.
            </p>
          </div>
        </div>

        {/* Footnotes */}
        <div className="mb-16 pt-6 border-t border-border">
          <div className="font-mono text-xs leading-relaxed space-y-1">
            <p><span className="text-accent">1.</span><span className="text-muted"> for I have never believed an equation simply because it asked nicely</span></p>
            <p><span className="text-accent">2.</span><span className="text-muted"> I keep a one arms distance from self-help books</span></p>
            <p><span className="text-accent">3.</span><span className="text-muted"> which my relations will find reassuring</span></p>
          </div>
        </div>

        {/* Resume */}
        <div className="mb-16">
          <h2 className="font-mono text-xs tracking-widest uppercase text-accent mb-5">
            Resume
          </h2>
          <div className="flex flex-col sm:flex-row gap-4">
            <a
              href="/Thomas_Cyriac_Full_Stack_Developer.pdf"
              download
              className="font-mono text-sm tracking-wider px-6 py-3 bg-accent text-bg font-bold hover:bg-accent-dim transition-colors duration-200 rounded-sm text-center"
            >
              Download Full Stack resume ↓
            </a>
            <a
              href="/Thomas_Cyriac_Smart_Contract_Engineer.pdf"
              download
              className="font-mono text-sm tracking-wider px-6 py-3 border border-accent text-accent hover:bg-accent hover:text-bg transition-all duration-200 rounded-sm text-center"
            >
              Download Smart Contract resume ↓
            </a>
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
