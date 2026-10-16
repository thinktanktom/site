import type { Metadata } from 'next'
import { Space_Mono, DM_Sans } from 'next/font/google'
import './globals.css'
import Nav from '@components/Nav'
import { TttWordmark } from '@components/ThemedLogo'
import Footer from '@components/Footer'

const spaceMono = Space_Mono({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-space-mono',
  display: 'swap',
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'thinktanktom',
    template: '%s',
  },
  icons: {
    icon: '/ttt_icon_dark-mono.svg',
    shortcut: '/ttt_icon_dark-mono.svg',
    apple: '/ttt_icon_dark-mono.svg',
  },
  description:
    'Thomas Cyriac — DeFi Protocol Developer, Smart Contract Engineer. Writing about technology, software, and ideas worth thinking about.',
  metadataBase: new URL('https://thinktanktom.com'),
  openGraph: {
    title: 'thinktanktom',
    description:
      'Thomas Cyriac — DeFi Protocol Developer & Smart Contract Engineer.',
    images: ['/ttt_logo.png'],
    type: 'website',
    url: 'https://thinktanktom.com',
    siteName: 'thinktanktom',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'thinktanktom',
    description:
      'Thomas Cyriac — DeFi Protocol Developer & Smart Contract Engineer.',
    images: ['/ttt_logo.png'],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${spaceMono.variable} ${dmSans.variable}`}>
      <body className="bg-bg text-text antialiased">
        {/* Sets data-theme before any themed content is parsed, so a reader on
            the random theme never sees a frame of dark-mono first. Must stay the
            first child of <body> and must stay synchronous. If localStorage
            throws (privacy modes) or JS is off we fall through to dark-mono, which
            is what :root already holds.

            There are only two themes now, so the validation is a single test:
            anything that is not 'random' renders dark-mono. A reader whose stored
            ttt-theme is still 'funky' (removed 2026-10-16), or 'dark'/'light'
            from before those were removed, therefore falls through to dark-mono,
            which is the correct self-healing outcome -- no migration step has
            been needed for any of the three removals.

            The random theme is restored from a CACHE of its nine resolved
            tokens, never by running the generator: generate() measures ~1.5ms
            warm and the engine is ~3KB, both of which are too much to spend
            synchronously before first paint on every page load. A version
            stamp (V) guards staleness -- a cache written by a different engine
            version is refused and we fall through to dark-mono, which the real
            engine then corrects from the stored seed after hydration.

            Each cached value is matched against an "R G B" pattern before any
            of it is applied, and the whole palette is rejected if one value
            fails. Checking only that the KEYS were present was not enough: a
            value CSSOM refuses (setProperty silently drops anything with a
            top-level semicolon) left some tokens unset while data-theme was
            still set to random -- and because the recovery path in
            ThemeSwitcher keys off data-theme, it could not see that state and
            the broken palette survived reloads. Reproduced as black text on a
            near-black background. Validating here is what lets that self-heal.

            Still writes only data-theme, data-polarity and inline custom
            properties, none of which React renders, so there is still no
            hydration mismatch and suppressHydrationWarning is correctly
            absent. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var K=['bg','surface','border','text','muted','accent','accent-dim','grid-dot','success'],V='2',RE=/^[0-9]{1,3} [0-9]{1,3} [0-9]{1,3}$/;try{var t=localStorage.getItem('ttt-theme');if(t!=='random')t='dark-mono';if(t==='random'){var ok=false;if(localStorage.getItem('ttt-palette-v')===V){var p=JSON.parse(localStorage.getItem('ttt-palette')||'null');if(p){ok=true;for(var i=0;i<K.length;i++){if(!RE.test(p[K[i]])){ok=false;break}}if(ok){var s=document.documentElement.style;for(var j=0;j<K.length;j++)s.setProperty('--'+K[j],p[K[j]]);var pol=p.polarity==='light'?'light':'dark';s.setProperty('color-scheme',pol);document.documentElement.setAttribute('data-polarity',pol)}}}if(!ok)t='dark-mono'}document.documentElement.setAttribute('data-theme',t)}catch(e){document.documentElement.setAttribute('data-theme','dark-mono')}})();`,
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify([
              {
                '@context': 'https://schema.org',
                '@type': 'WebSite',
                name: 'thinktanktom',
                url: 'https://thinktanktom.com',
              },
              {
                '@context': 'https://schema.org',
                '@type': 'Person',
                name: 'Thomas Cyriac',
                url: 'https://thinktanktom.com',
                jobTitle: 'DeFi Protocol Developer & Smart Contract Engineer',
                sameAs: [
                  'https://github.com/thinktanktom',
                  'https://linkedin.com/in/thinktanktom',
                  'https://www.upwork.com/freelancers/~018a1dbf1094588c7e',
                ],
              },
            ]),
          }}
        />
        <Nav wordmark={<TttWordmark height={32} />} />
        {children}
        <Footer />
      </body>
    </html>
  )
}
