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
    icon: '/thinktanktom_logo.svg',
    shortcut: '/thinktanktom_logo.svg',
    apple: '/thinktanktom_logo.svg',
  },
  description:
    'Thomas Cyriac — DeFi Protocol Developer, Smart Contract Architect. Writing about technology, software, and ideas worth thinking about.',
  metadataBase: new URL('https://thinktanktom.com'),
  openGraph: {
    title: 'ThinkTankTom',
    description:
      'Thomas Cyriac — DeFi Protocol Developer & Smart Contract Architect.',
    images: ['/thinktanktom_logo.svg'],
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'ThinkTankTom',
    description:
      'Thomas Cyriac — DeFi Protocol Developer & Smart Contract Architect.',
    images: ['/thinktanktom_logo.svg'],
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
