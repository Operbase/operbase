import Link from 'next/link'
import { Wheat } from 'lucide-react'

const linkClass =
  'text-sm text-primary-foreground/80 transition-colors hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-900 rounded-sm'

export function LandingFooter() {
  return (
    <footer
      className="relative bg-stone-950 text-primary-foreground before:absolute before:inset-x-0 before:top-0 before:h-1 before:bg-gradient-to-r before:from-amber-500 before:via-orange-500 before:to-amber-600"
      role="contentinfo"
    >
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-14">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2 lg:col-span-1">
            <p className="flex items-center gap-2 text-lg font-bold">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 text-white">
                <Wheat className="h-4 w-4" aria-hidden />
              </span>
              Operbase
            </p>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-primary-foreground/70">
              Operations for small businesses. Stock, production, and sales in one place.
            </p>
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-primary-foreground/50">Product</h3>
            <ul className="mt-4 space-y-2">
              <li>
                <Link href="/product" className={linkClass}>
                  How it works
                </Link>
              </li>
              <li>
                <Link href="/solutions" className={linkClass}>
                  Solutions
                </Link>
              </li>
              <li>
                <Link href="/pricing" className={linkClass}>
                  Pricing
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-primary-foreground/50">Account</h3>
            <ul className="mt-4 space-y-2">
              <li>
                <Link href="/login" className={linkClass}>
                  Log in
                </Link>
              </li>
              <li>
                <Link href="/signup" className={linkClass}>
                  Sign up
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-primary-foreground/50">Legal</h3>
            <ul className="mt-4 space-y-2">
              <li>
                <Link href="/privacy" className={linkClass}>Privacy Policy</Link>
              </li>
              <li>
                <Link href="/terms" className={linkClass}>Terms of Service</Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-12 border-t border-primary-foreground/15 pt-8 text-center text-sm text-primary-foreground/55">
          <p>&copy; {new Date().getFullYear()} Operbase. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}
