import type { Metadata } from 'next'
import Image from 'next/image'

export const metadata: Metadata = {
  title: 'About',
  description:
    'Thomas Cyriac — DeFi Protocol Developer, Smart Contract Architect, Open Source Contributor.',
}

export default function AboutPage() {
  return (
    <main className="pt-32 pb-24 px-6">
      <div className="max-w-chrome mx-auto">
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
              I read the papers. I redid the mathematics by hand* and then helped developers at a string of startups turn that arithmetic
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
              a flattering gesture, but my freelancing had by then grown plump enough to feed itself, and I let it.
            </p>
            <p>
              That same year brought the{' '}
              <a href="https://bankx.io" target="_blank" rel="noopener noreferrer" className="text-accent underline underline-offset-4 hover:text-accent-dim transition-colors">BankX</a>
              {' '}contract, and I have scarcely looked over my shoulder since. Its mathematics, its tokenomics,
              its architecture were all gratifyingly complicated, more than enough to occupy a restless mind for
              several years.
            </p>
            <p>
              But restless minds outlast their puzzles. By 2025 the major work had drawn to a close; we had tested
              and deployed very nearly everything. So, after a &ldquo;break&rdquo; (by which I mean a stretch of intense
              restlessness), I joined a family friend to build{' '}
              <a href="https://ctrlbit.com" target="_blank" rel="noopener noreferrer" className="text-accent underline underline-offset-4 hover:text-accent-dim transition-colors">Ctrlbit</a>,
              an SDWAN product for Mikrotik hardware here in India. It let me learn the magic behind the internet
              and bend it to my own ends, which was a quiet thrill.
            </p>
            <p>
              All of which brings me, at last, to the point of this page. Solving a hard problem means outwitting
              it. Explaining it means something stranger and better: you give the answer away, and somehow you keep
              it too. That second thing is rarer, harder, and the only kind of work that has ever held me. It is,
              in the end, what I actually do.
            </p>
          </div>
        </div>

        {/* Footnotes */}
        <div className="mb-16 pt-6 border-t border-border">
          <p className="font-mono text-xs text-muted leading-relaxed">
            * for I have never believed an equation simply because it asked nicely
          </p>
        </div>

        {/* Currently */}
        <div className="mb-16 p-6 border border-border rounded-sm bg-surface/30">
          <h2 className="font-mono text-xs tracking-widest uppercase text-accent mb-5">
            Currently
          </h2>
          <ul className="font-sans text-base text-text leading-[1.75] space-y-2 list-disc pl-4">
            <li>Setting up AI supplemented environments to ship code more efficiently</li>
            <li>Building CollabGraph, A GitHub App and AT Protocol AppView that turns your pull request and review history into a verifiable, portable collaboration graph you own.</li>
            <li>
              Writing about and contributing to DeFi. I don't believe in magic money or novel new get rich schemes. Finance will always be about practicality and smart decisions. Decentralized or not.
            </li>
            <li>Constantly worrying about identity and data ownership.</li>
          </ul>
        </div>


      </div>
    </main>
  )
}
