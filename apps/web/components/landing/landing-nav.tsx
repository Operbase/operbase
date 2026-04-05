'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Menu, Wheat } from 'lucide-react'
import { cn } from '@/lib/utils'

const navLinkClass =
  'text-sm font-semibold text-stone-600 transition-colors hover:text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#f7f4ee] rounded-sm'

export function LandingNav() {
  const [open, setOpen] = useState(false)

  const links = (
    <>
      <Link href="/product" className={navLinkClass} onClick={() => setOpen(false)}>
        Product
      </Link>
      <Link href="/solutions" className={navLinkClass} onClick={() => setOpen(false)}>
        Solutions
      </Link>
      <Link href="/pricing" className={navLinkClass} onClick={() => setOpen(false)}>
        Pricing
      </Link>
      <Link href="/login" className={navLinkClass} onClick={() => setOpen(false)}>
        Log in
      </Link>
    </>
  )

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-amber-900/10 bg-[#f7f4ee]/90 shadow-sm shadow-stone-900/5 backdrop-blur-md supports-[backdrop-filter]:bg-[#f7f4ee]/80">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4 sm:h-16 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="flex items-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#f7f4ee]"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-md shadow-amber-900/25">
            <Wheat className="h-5 w-5" aria-hidden />
          </span>
          <span className="text-lg font-bold tracking-tight text-stone-900 sm:text-xl">Operbase</span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex" aria-label="Primary">
          {links}
          <Button
            asChild
            className="rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 font-semibold text-white shadow-md shadow-amber-900/20 hover:from-amber-500 hover:to-orange-500"
          >
            <Link href="/signup">Start free</Link>
          </Button>
        </nav>

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-stone-200 bg-white/90 md:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600/50"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" aria-hidden />
            </button>
          </SheetTrigger>
          <SheetContent side="right" className="flex w-[min(100vw-2rem,20rem)] flex-col gap-6">
            <SheetHeader className="text-left">
              <SheetTitle className="sr-only">Site menu</SheetTitle>
              <SheetDescription className="sr-only">Navigation links and sign up</SheetDescription>
            </SheetHeader>
            <nav className="flex flex-col gap-4" aria-label="Mobile">
              <Link
                href="/product"
                className={cn(navLinkClass, 'py-2 text-base')}
                onClick={() => setOpen(false)}
              >
                Product
              </Link>
              <Link
                href="/solutions"
                className={cn(navLinkClass, 'py-2 text-base')}
                onClick={() => setOpen(false)}
              >
                Solutions
              </Link>
              <Link
                href="/pricing"
                className={cn(navLinkClass, 'py-2 text-base')}
                onClick={() => setOpen(false)}
              >
                Pricing
              </Link>
              <Link
                href="/login"
                className={cn(navLinkClass, 'py-2 text-base')}
                onClick={() => setOpen(false)}
              >
                Log in
              </Link>
              <Button
                asChild
                className="mt-2 w-full rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 font-semibold text-white"
              >
                <Link href="/signup" onClick={() => setOpen(false)}>
                  Start free
                </Link>
              </Button>
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  )
}
