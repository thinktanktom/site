import type { Metadata } from 'next'
import Link from 'next/link'
import { experience, upworkProjects } from '@lib/experience'

export const metadata: Metadata = {
  title: 'Experience',
  description:
    'A timeline of roles and engagements — smart contracts, AI infrastructure, and the machine learning work that came before it.',
}

export default function ExperiencePage() {
  return (
    <main className="pt-32 pb-24 px-6">
      <div className="max-w-article mx-auto">
        <h1 className="font-mono text-4xl sm:text-5xl lg:text-6xl tracking-tight mb-4 text-text">
          Experience.
        </h1>
        <p className="font-sans text-lg text-muted mb-16 leading-relaxed">
          Six years of smart contract work, AI agent infrastructure, and the machine
          learning roles that started it all.
        </p>

        <div className="space-y-10">
          {experience.map((entry, i) => (
            <div
              key={i}
              className="border-l-[3px] border-border pl-6 hover:border-accent transition-colors duration-200"
            >
              <time className="font-mono text-xs text-muted tracking-widest uppercase">
                {entry.start} — {entry.end}
              </time>

              <h2 className="font-mono text-xl text-text mt-1 mb-0.5 leading-snug">
                {entry.role}
              </h2>

              <p className="font-mono text-sm text-accent mb-3">
                {entry.orgLink ? (
                  <a
                    href={entry.orgLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-accent-dim transition-colors underline underline-offset-4"
                  >
                    {entry.org}
                  </a>
                ) : (
                  entry.org
                )}
              </p>

              <p className="font-sans text-base text-text leading-[1.75] mb-4">
                {entry.summary}
              </p>

              <div className="flex flex-wrap items-center gap-2">
                {entry.stack.map((tech) => (
                  <span
                    key={tech}
                    className="font-mono text-xs px-2 py-0.5 border border-border text-muted rounded-sm"
                  >
                    {tech}
                  </span>
                ))}
                {entry.link && (
                  <a
                    href={entry.link.href}
                    target={entry.link.href.startsWith('http') ? '_blank' : undefined}
                    rel={entry.link.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                    className="font-mono text-xs text-muted hover:text-accent tracking-wider transition-colors duration-200 ml-1"
                  >
                    {entry.link.label} →
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Upwork */}
        <div className="mt-10 p-6 border border-border rounded-sm bg-surface/30">
          <h2 className="font-mono text-xs tracking-widest uppercase text-accent mb-1">
            Upwork
          </h2>
          <p className="font-sans text-sm text-muted mb-6">
            Standalone contracts sourced through Upwork, separate from the direct-client work above.
          </p>

          <div className="divide-y divide-border">
            {upworkProjects.map((entry, i) => (
              <div key={i} className="py-5 first:pt-0 last:pb-0">
                <time className="font-mono text-xs text-muted tracking-widest uppercase">
                  {entry.start} — {entry.end}
                </time>

                <h3 className="font-mono text-lg text-text mt-1 mb-2 leading-snug">
                  {entry.role}
                </h3>

                <p className="font-sans text-base text-text leading-[1.75] mb-3">
                  {entry.summary}
                </p>

                <div className="flex flex-wrap items-center gap-2">
                  {entry.stack.map((tech) => (
                    <span
                      key={tech}
                      className="font-mono text-xs px-2 py-0.5 border border-border text-muted rounded-sm"
                    >
                      {tech}
                    </span>
                  ))}
                  {entry.link && (
                    <a
                      href={entry.link.href}
                      target={entry.link.href.startsWith('http') ? '_blank' : undefined}
                      rel={entry.link.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                      className="font-mono text-xs text-muted hover:text-accent tracking-wider transition-colors duration-200 ml-1"
                    >
                      {entry.link.label} →
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Open source */}
        <div className="mt-10 p-6 border border-border rounded-sm bg-surface/30">
          <h2 className="font-mono text-xs tracking-widest uppercase text-accent mb-3">
            Open source
          </h2>
          <p className="font-sans text-base text-text leading-[1.75] mb-3">
            Merged and open pull requests into OpenZeppelin, Nethermind, Chainlink, Optimism,
            and LambdaClass — mostly Soroban tooling, ZK verifier build-time optimizations, and
            developer-experience fixes.
          </p>
          <Link
            href="/contributions"
            className="font-mono text-sm text-muted hover:text-accent tracking-wider transition-colors duration-200"
          >
            See contributions →
          </Link>
        </div>

        {/* Education */}
        <div className="mt-8 pt-8 border-t border-border">
          <h2 className="font-mono text-xs tracking-widest uppercase text-muted mb-4">
            Education &amp; certifications
          </h2>
          <div className="font-sans text-base text-text leading-[1.75] space-y-1">
            <p>B.Tech, Computer Science — SRM Institute of Science and Technology, 2017–2021</p>
            <p className="text-muted">
              MTCNA (MikroTik Certified Network Associate), issued 2024
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}
