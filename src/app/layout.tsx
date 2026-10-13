import type { Metadata } from 'next'
import { Space_Mono, DM_Sans } from 'next/font/google'
import './globals.css'
import Nav from '@components/Nav'
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
    icon: '/ttt_icon.svg',
    shortcut: '/ttt_icon.svg',
    apple: '/ttt_icon.svg',
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
        {/* Sets data-theme before any themed content is parsed, so there is no
            flash of funky for dark/light users. Must stay the first child of
            <body> and must stay synchronous. If localStorage throws (privacy
            modes) or JS is off we fall through to funky, which is what :root
            already holds. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('ttt-theme');if(t!=='dark'&&t!=='light')t='funky';document.documentElement.setAttribute('data-theme',t)}catch(e){document.documentElement.setAttribute('data-theme','funky')}})();`,
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
        <Nav />
        {children}
        <Footer />
      </body>
    </html>
  )
}
