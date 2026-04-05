'use client'

import Link from 'next/link'
import { Wheat } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FooterProps {
  /**
   * Optional additional footer columns
   */
  columns?: Array<{
    title: string
    links: Array<{
      href: string
      label: string
      external?: boolean
    }>
  }>
  /**
   * Show the gradient top border
   * @default true
   */
  showGradient?: boolean
}

const defaultColumns = [
  {
    title: 'Product',
    links: [
      { href: '/product', label: 'How it works' },
      { href: '/solutions', label: 'Solutions' },
      { href: '/pricing', label: 'Pricing' },
    ],
  },
  {
    title: 'Account',
    links: [
      { href: '/login', label: 'Log in' },
      { href: '/signup', label: 'Sign up' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { href: '/privacy', label: 'Privacy Policy' },
      { href: '/terms', label: 'Terms of Service' },
    ],
  },
]

const linkClass = cn(
  'text-sm text-white/80 transition-colors duration-200',
  'hover:text-white',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60',
  'focus-visible:ring-offset-2 focus-visible:ring-offset-stone-900 rounded-sm'
)

export function Footer({
  columns = defaultColumns,
  showGradient = true,
}: FooterProps) {
  const currentYear = new Date().getFullYear()

  return (
    <footer
      className={cn(
        'relative bg-stone-950 text-white',
        showGradient &&
          'before:absolute before:inset-x-0 before:top-0 before:h-1 before:bg-gradient-to-r before:from-amber-500 before:via-orange-500 before:to-amber-600'
      )}
      role="contentinfo"
    >
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-14">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand column */}
          <div className="sm:col-span-2 lg:col-span-1">
            <Link
              href="/"
              className={cn(
                'flex items-center gap-2 text-lg font-bold text-white',
                'transition-opacity duration-200 hover:opacity-80',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60',
                'focus-visible:ring-offset-2 focus-visible:ring-offset-stone-900 rounded-lg'
              )}
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 text-white">
                <Wheat className="h-4 w-4" aria-hidden />
              </span>
              Operbase
            </Link>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-white/70">
              Operations for small businesses. Stock, production, and sales in one place.
            </p>
          </div>

          {/* Link columns */}
          {columns.map((column) => (
            <div key={column.title}>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-white/50">
                {column.title}
              </h3>
              <ul className="mt-4 space-y-2">
                {column.links.map((link) => (
                  <li key={link.href + link.label}>
                    {link.external ? (
                      <a
                        href={link.href}
                        className={linkClass}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link href={link.href} className={linkClass}>
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-12 border-t border-white/15 pt-8 text-center text-sm text-white/55">
          <p>&copy; {currentYear} Operbase. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}

export default Footer
