import type { Metadata } from 'next'
import Image from 'next/image'
import { Github, Linkedin, ExternalLink } from 'lucide-react'

export const metadata: Metadata = {
  title: 'About',
  description:
    'Thomas Cyriac — DeFi Protocol Developer, Smart Contract Architect, Open Source Contributor.',
}

const socialLinks = [
  { href: 'https://github.com/thinktanktom', label: 'GitHub', Icon: Github },
  { href: 'https://linkedin.com/in/thinktanktom', label: 'LinkedIn', Icon: Linkedin },
  {
    href: 'https://www.upwork.com/freelancers/thinktanktom',
    label: 'Upwork',
    Icon: ExternalLink,
  },
]

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
            src="/thinktanktom_logo.svg"
            alt="ThinkTankTom"
            width={120}
            height={120}
            className="shrink-0 object-contain"
            unoptimized
          />
          <div className="font-sans text-base text-text leading-[1.75] space-y-5">
            <p>
              I&apos;m Thomas Cyriac — a DeFi protocol developer and smart contract
              architect based in Coimbatore, India. I&apos;ve spent the past few years
              building financial primitives on open, permissionless infrastructure
              across Ethereum, Arbitrum, Polygon, Optimism, Avalanche, BNB Chain,
              and Stellar.
            </p>
            <p>
              My flagship project is{' '}
              <a
                href="https://bankx.io"
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-accent underline-offset-2 hover:text-accent transition-colors duration-200"
              >
                BankX
              </a>{' '}
              — a dual-token, silver-pegged algorithmic stablecoin. I&apos;ve been lead
              developer since November 2021, through CoinFabrik and Immunefi audits,
              multi-chain deployments, and the kind of adversarial conditions that
              teach you more about system design than any textbook.
            </p>
            <p>
              I contribute to open source: OpenZeppelin&apos;s Soroban helpers, Chainlink
              CCIP tooling, Ethereum Optimism CI actions, and post-quantum consensus
              research at LambdaClass. On Upwork I&apos;m Top Rated Plus with a 100% Job
              Success Score across $100K+ in earnings.
            </p>
            <p>
              When I'm not at my laptop I'm usually doing something that involves a ball, a wave or a poorly packed bag. 
              Sometimes all three if the weekend is going particularly well.
            </p>
          </div>
        </div>

        {/* Currently */}
        <div className="mb-16 p-6 border border-border rounded-sm bg-surface/30">
          <h2 className="font-mono text-xs tracking-widest uppercase text-accent mb-5">
            Currently
          </h2>
          <ul className="font-sans text-base text-text leading-[1.75] space-y-2 list-disc pl-4">
            <li>Maintaining and extending BankX across six EVM chains</li>
            <li>Building Soroban (Rust/WASM) smart contracts on Stellar</li>
            <li>
              Writing about DeFi protocol design, security, and multi-chain
              architecture
            </li>
            <li>Open to protocol engineering engagements via Upwork</li>
          </ul>
        </div>

        {/* Links */}
        <div>
          <h2 className="font-mono text-xs tracking-widest uppercase text-muted mb-6">
            Find me
          </h2>
          <div className="flex flex-col gap-5">
            {socialLinks.map(({ href, label, Icon }) => (
              <a
                key={href}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-4 font-mono text-lg text-muted hover:text-accent transition-colors duration-200 tracking-wide w-fit"
              >
                <Icon size={18} className="shrink-0" />
                {label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}
