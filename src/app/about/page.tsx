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
      <div className="max-w-article mx-auto">
        <h1 className="font-mono text-4xl sm:text-5xl tracking-tight mb-12 text-text">
          About.
        </h1>

        {/* Bio */}
        <div className="flex flex-col sm:flex-row gap-10 mb-16 items-start">
          <Image
            src="/ttt_logo_full.svg"
            alt="thinktanktom"
            width={320}
            height={180}
            className="shrink-0 object-contain"
            unoptimized
          />
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
              domains doesn&apos;t just broaden you. It clarifies you. It shows you the underlying
              structure of things.
            </p>
            <p>
              Consider the football pitch. A ninety-minute match is not ninety minutes of equivalent
              consequence. It is the painstaking construction of conditions — the pressing, the
              positioning, the thankless tracking back that no highlights package will ever dignify —
              in service of three or four moments that actually matter. A misplaced step. A run
              correctly read. A decision made in the half-second before the ball arrives. The rest is
              infrastructure. One does the work not from certainty that it will prove decisive, but
              from the humility of knowing one cannot tell which part won&apos;t.
            </p>
            <p>
              This is not a philosophy of football. It is a philosophy.
            </p>
            <p>
              I appear to lack whatever it is that lets certain people dismiss a moment as
              inconsequential. I&apos;m either fully in the room, or I&apos;m not there at all. When I say I
              surf, I mean I have stood on a beach at six in the morning studying a break I&apos;ve surfed
              a hundred times, looking for something I hadn&apos;t yet understood about it. When I say I
              play football, I mean I have replayed a single misplaced pass in my head longer than
              most of my failed deployments. These aren&apos;t hobbies. They&apos;re the same obsession,
              wearing different clothes.
            </p>
            <p>
              It doesn&apos;t feel fair that none of it would ever show up on a git commit history or an
              AI-generated LinkedIn post. But it&apos;ll show up here. So if you find yourself concerningly
              interested — Don&apos;t be a stranger. The door is always on the latch.
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
              Writing aboutand contributing to DeFi. I don't believe in magic money or novel new get rich schemes. Finance will always be about practicality and smart decisions. Decentralized or not.
            </li>
            <li>Constantly worrying about identity and data ownership.</li>
          </ul>
        </div>

      </div>
    </main>
  )
}
