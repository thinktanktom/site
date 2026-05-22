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
    template: '%s — thinktanktom',
  },
  icons: {
    icon: '/ttt_icon.svg',
    shortcut: '/ttt_icon.svg',
    apple: '/ttt_icon.svg',
  },
  description:
    'Thomas Cyriac — DeFi Protocol Developer, Smart Contract Architect. Writing about technology, software, and ideas worth thinking about.',
  metadataBase: new URL('https://thinktanktom.com'),
  openGraph: {
    title: 'ThinkTankTom',
    description:
      'Thomas Cyriac — DeFi Protocol Developer & Smart Contract Architect.',
    images: ['/ttt_logo.png'],
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'ThinkTankTom',
    description:
      'Thomas Cyriac — DeFi Protocol Developer & Smart Contract Architect.',
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
        <Nav />
        {children}
        <Footer />
      </body>
    </html>
  )
}
