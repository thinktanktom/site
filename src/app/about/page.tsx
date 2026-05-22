import type { Metadata } from 'next'
import Image from 'next/image'

export const metadata: Metadata = {
  title: 'On the Peculiar Virtue of the Concerned Reader',
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
              In my experience, I only visit the About page when
              I&apos;m genuinely interested in a website. Concerningly interested.
            </p>
            <p>
              I&apos;m honoured. In an age where everything and everyone is competing for your attention,
              you took a chance on me. As thanks, I&apos;d like to let you in on a small secret.
            </p>
            <p>
              Engineering isn&apos;t my one true love. There — I&apos;ve said it.
            </p>
            <p>
              The origins of that admission are, tip my hat to Freud, paternal. My father had a
              stubborn, almost Socratic commitment to dislodging me from whatever fixed position I
              currently occupied. When I retreated inward, he demanded I look out. When I sought the
              world, he pointed me back toward the interior. It was, at the time, profoundly irritating
              — which is, of course, precisely the condition under which genuine education tends to occur.
            </p>
            <p>
              What I came to understand, slowly, was this: competence accumulated across different
              domains doesn&apos;t just broaden you. It shows you the underlying
              structure of complexity as a whole.
            </p>
            <p>
              Consider football. A game I was once abysmally bad at. At school, I got picked for teams
              because I had "pace," which I later discovered was a generous euphemism for
              *can run fast and do little else*. And there I might have stayed—a useful
              sprinter, an ornamental presence—had I not, one day, decided in earnest to get
              *good*.
            </p>
            <p>That decision unfolded into a world. Ball control gave way to team composition,
            which gave way to positional play, until the game I had thought so simple
            revealed itself as gloriously, dizzyingly complicated. And it would not stay on
            the pitch. It crept into my diet, my sleep, my fitness, until eventually I
            realised my whole life had quietly rearranged itself around the thing. Today I
            can read an opponent's quality from the way they warm up. I can sync with a
            teammate I've never spoken to through nothing more than a head nod or a
            purposeful glance. What I arrive at, in those moments, is a kind of
            familiarity—a quiet belonging. And it is that feeling, more than the game
            itself, that I've come to chase into everything I pick up.</p>
            <p>
              The truth is that nothing I've learned has ever stayed where I first found it.
              Every hobby I pick up bleeds into the next like ink through a wet page, and I've
              stopped trying to keep them in their lanes. I think that's just how I'm built:
              I don't take things up so much as fall into them, and I tend to keep falling
              until the simple thing has revealed itself as a whole, complicated world worth
              living inside. I'm nowhere near comprehending all of it, and I've found a
              strange peace in knowing I never will—the bottom isn't really the point.
            </p>
            <p>
              So if you find yourself concerningly interested in how drawing nude charcoal
              sketches of small French men taught me about ZK proofs and private payments on
              Stellar, or how being comfortably the worst player in a college football league
              nudged me into freelancing, then you already understand the only thing this page
              was ever trying to say. Stay a while. You're evidently as concerningly interested
              in all this as I am—which makes us rather good company. 
            </p>
          </div>
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
