import type { Metadata } from 'next'
import { LandingPage } from '@/components/landing/landing-page'

export const metadata: Metadata = {
  title: 'Operbase | Stock, baking, and sales for small businesses',
  description:
    'Track ingredients, log batches, and record sales in one place. Built with bakeries in mind. See real profit without living in spreadsheets.',
  openGraph: {
    title: 'Operbase | Operations for small businesses',
    description:
      'Track stock, record production, and log sales. One workspace for owners who want clarity.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Operbase',
    description: 'Stock, production, and sales in one calm system.',
  },
}

export default function HomePage() {
  return <LandingPage />
}
