import type { Metadata } from 'next'

const description = 'Open source pull requests — descriptions sourced live from GitHub.'

export const metadata: Metadata = {
  title: 'Contributions',
  description,
  alternates: { canonical: '/contributions' },
  openGraph: {
    title: 'Contributions — thinktanktom',
    description,
    type: 'website',
    url: 'https://thinktanktom.com/contributions',
    siteName: 'thinktanktom',
    images: ['/ttt_logo.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Contributions — thinktanktom',
    description,
    images: ['/ttt_logo.png'],
  },
}

export default function ContributionsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
