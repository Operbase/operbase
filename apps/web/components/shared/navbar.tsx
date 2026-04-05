'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Menu, Wheat } from 'lucide-react'
import { cn } from '@/lib/utils'

interface NavbarProps {
  /**
   * Optional additional links to display in the nav
   */
  links?: Array<{
    href: string
    label: string
    external?: boolean
  }>
  /**
   * Position of the navbar - 'fixed' (default) or 'static'
   */
  position?: 'fixed' | 'static'
  /**
   * Show the CTA button
   * @default true
   */
  showCta?: boolean
  /**
   * CTA button text
   * @default 'Start free'
   */
  ctaText?: string
  /**
   * CTA button href
   * @default '/signup'
   */
  ctaHref?: string
}

const defaultLinks = [
  { href: '/product', label: 'Product' },
  { href: '/solutions', label: 'Solutions' },
  { href: '/pricing', label: 'Pricing' },
]

const navLinkClass = cn(
  'text-sm font-semibold text-stone-600 transition-colors duration-200',
  'hover:text-stone-900',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50',
  'focus-visible:ring-offset-2 focus-visible:ring-offset-[#f7f4ee] rounded-sm'
)

export function Navbar({
  links = defaultLinks,
  position = 'fixed',
  showCta = true,
  ctaText = 'Start free',
  ctaHref = '/signup',
}: NavbarProps) {
  const [open, setOpen] = useState(false)
  const positionClasses = position === 'fixed'
    ? 'fixed top-0 left-0 right-0 z-50'
    : 'relative'

  const handleNavClick = () => setOpen(false)

  return (
    <header
      className={cn(
        positionClasses,
        'border-b border-amber-900/10 bg-[#f7f4ee]/90 shadow-sm shadow-stone-900/5',
        'backdrop-blur-md supports-[backdrop-filter]:bg-[#f7f4ee]/80'
      )}
    >
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4 sm:h-16 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link
          href="/"
          className={cn(
            'flex items-center gap-2.5 rounded-md transition-transform duration-200',
            'hover:scale-[1.02]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600/50',
            'focus-visible:ring-offset-2 focus-visible:ring-offset-[#f7f4ee]'
          )}
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-md shadow-amber-900/25">
            <Wheat className="h-5 w-5" aria-hidden />
          </span>
          <span className="text-lg font-bold tracking-tight text-stone-900 sm:text-xl">
            Operbase
          </span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden items-center gap-8 md:flex" aria-label="Primary">
          {links.map((link) =>
            link.external ? (
              <a
                key={link.href}
                href={link.href}
                className={navLinkClass}
                target="_blank"
                rel="noopener noreferrer"
              >
                {link.label}
              </a>
            ) : (
              <a key={link.href} href={link.href} className={navLinkClass}>
                {link.label}
              </a>
            )
          )}
          <Link href="/login" className={navLinkClass}>
            Log in
          </Link>
          {showCta && (
            <Button
              asChild
              className="h-10 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 px-5 font-semibold text-white shadow-md shadow-amber-900/20 transition-all duration-200 hover:from-amber-500 hover:to-orange-500 hover:shadow-lg hover:shadow-amber-900/30 hover:-translate-y-0.5"
            >
              <Link href={ctaHref}>{ctaText}</Link>
            </Button>
          )}
        </nav>

        {/* Mobile Menu */}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <button
              type="button"
              className={cn(
                'inline-flex h-10 w-10 items-center justify-center rounded-xl border border-stone-200 bg-white/90 md:hidden',
                'transition-colors duration-200 hover:bg-stone-50',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600/50'
              )}
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" aria-hidden />
            </button>
          </SheetTrigger>
          <SheetContent
            side="right"
            className="flex w-[min(100vw-2rem,20rem)] flex-col gap-6"
          >
            <SheetHeader className="text-left">
              <SheetTitle className="sr-only">Site menu</SheetTitle>
              <SheetDescription className="sr-only">
                Navigation links and sign up
              </SheetDescription>
            </SheetHeader>
            <nav className="flex flex-col gap-2" aria-label="Mobile">
              {links.map((link) =>
                link.external ? (
                  <a
                    key={link.href}
                    href={link.href}
                    className={cn(navLinkClass, 'py-3 text-base block')}
                    onClick={handleNavClick}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {link.label}
                  </a>
                ) : (
                  <a
                    key={link.href}
                    href={link.href}
                    className={cn(navLinkClass, 'py-3 text-base block')}
                    onClick={handleNavClick}
                  >
                    {link.label}
                  </a>
                )
              )}
              <Link
                href="/login"
                className={cn(navLinkClass, 'py-3 text-base block')}
                onClick={handleNavClick}
              >
                Log in
              </Link>
              {showCta && (
                <Button
                  asChild
                  className="mt-4 h-12 w-full rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 font-semibold text-white"
                >
                  <Link href={ctaHref} onClick={handleNavClick}>
                    {ctaText}
                  </Link>
                </Button>
              )}
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  )
}

export default Navbar
