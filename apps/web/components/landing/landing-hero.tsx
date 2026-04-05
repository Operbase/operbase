import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowRight, BarChart3, Package, Sparkles } from 'lucide-react'
import { AnimateIn } from './animate-in'

export function LandingHero() {
  return (
    <section
      className="relative overflow-hidden border-b border-amber-900/10 px-4 pb-20 pt-24 sm:px-6 sm:pb-24 sm:pt-28 md:pt-32 lg:px-8"
      aria-labelledby="landing-hero-heading"
    >
      {/* Layered background */}
      <div className="pointer-events-none absolute inset-0 landing-grid" aria-hidden />
      <div
        className="pointer-events-none absolute -right-20 top-0 h-[420px] w-[420px] rounded-full bg-amber-400/25 blur-3xl sm:right-0"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -left-32 bottom-0 h-[360px] w-[360px] rounded-full bg-orange-500/15 blur-3xl"
        aria-hidden
      />

      <div className="relative mx-auto max-w-7xl">
        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
          {/* Copy */}
          <AnimateIn delay={40} className="max-w-xl lg:max-w-none">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-widest text-amber-800 shadow-sm sm:text-sm">
              <Sparkles className="h-3.5 w-3.5 text-amber-600" aria-hidden />
              Business operating system
            </div>
            <h1
              id="landing-hero-heading"
              className="text-balance font-bold tracking-[-0.03em] text-stone-900"
              style={{ fontSize: 'clamp(2.25rem, 5vw + 1rem, 3.75rem)', lineHeight: 1.08 }}
            >
              Run your business,{' '}
              <span className="landing-gradient-text">not your spreadsheets</span>
            </h1>
            <p
              className="mt-6 max-w-lg text-pretty text-lg leading-relaxed text-stone-600 sm:text-xl sm:leading-relaxed"
              style={{ fontSize: 'clamp(1.05rem, 0.5vw + 1rem, 1.25rem)' }}
            >
              Operbase connects stock, production, and sales so you always know what you have,
              what it cost, and what you made.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <Button
                asChild
                size="lg"
                className="h-12 min-h-12 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 px-8 text-base font-semibold text-white shadow-lg shadow-amber-900/20 transition hover:from-amber-500 hover:to-orange-500 hover:shadow-xl hover:shadow-amber-900/25"
              >
                <Link href="/signup">
                  Start free
                  <ArrowRight className="ml-2 h-5 w-5" aria-hidden />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-12 min-h-12 rounded-xl border-2 border-stone-300 bg-white/80 text-base font-semibold text-stone-800 shadow-sm backdrop-blur-sm hover:bg-white hover:border-amber-400/50"
              >
                <Link href="/product">See how it works</Link>
              </Button>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-stone-600">
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
                No credit card to sign up
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
                Set up in minutes
              </li>
            </ul>
          </AnimateIn>

          {/* Product mockup */}
          <AnimateIn
            delay={140}
            className="relative mx-auto w-full max-w-lg lg:mx-0 lg:max-w-none"
            aria-hidden="true"
          >
            <div className="absolute -inset-4 rounded-[2rem] bg-gradient-to-br from-amber-400/20 via-orange-400/10 to-transparent blur-2xl lg:-inset-6" />
            <div className="landing-float-slow relative rounded-2xl border-2 border-white/80 bg-white/95 p-1 shadow-2xl shadow-stone-900/15 ring-1 ring-stone-900/5 backdrop-blur-sm">
              <div className="absolute -right-2 -top-2 z-10 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-3 py-1 text-xs font-bold text-white shadow-md">
                Preview
              </div>
              <div className="flex items-center gap-1.5 border-b border-stone-200/80 bg-stone-100/80 px-4 py-3">
                <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                <span className="ml-2 flex-1 truncate rounded-lg bg-white px-3 py-1.5 text-center text-xs font-medium text-stone-500 shadow-inner">
                  operbase.app/dashboard
                </span>
              </div>
              <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
                <div className="rounded-xl border border-amber-200/60 bg-gradient-to-br from-amber-50 via-white to-orange-50/40 p-4 sm:col-span-2">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-sm font-bold text-stone-900">Overview</span>
                    <BarChart3 className="h-5 w-5 text-amber-600" aria-hidden />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-lg border border-stone-100 bg-white py-3 text-center shadow-sm">
                      <p className="text-[10px] font-medium uppercase tracking-wide text-stone-500">Money in</p>
                      <p className="mt-0.5 text-lg font-bold tabular-nums text-stone-900">$12.4k</p>
                    </div>
                    <div className="rounded-lg border border-stone-100 bg-white py-3 text-center shadow-sm">
                      <p className="text-[10px] font-medium uppercase tracking-wide text-stone-500">Costs</p>
                      <p className="mt-0.5 text-lg font-bold tabular-nums text-stone-900">$4.1k</p>
                    </div>
                    <div className="rounded-lg border border-emerald-100 bg-emerald-50/80 py-3 text-center shadow-sm">
                      <p className="text-[10px] font-medium uppercase tracking-wide text-emerald-700/80">Left over</p>
                      <p className="mt-0.5 text-lg font-bold tabular-nums text-emerald-800">$8.3k</p>
                    </div>
                  </div>
                </div>
                <div className="rounded-xl border border-stone-200/80 bg-stone-50/80 p-4">
                  <Package className="mb-2 h-6 w-6 text-amber-600" aria-hidden />
                  <p className="text-sm font-bold text-stone-900">Stock</p>
                  <p className="mt-1 text-xs leading-relaxed text-stone-600">Ingredients & packaging, one list.</p>
                </div>
                <div className="rounded-xl border border-stone-200/80 bg-stone-50/80 p-4">
                  <BarChart3 className="mb-2 h-6 w-6 text-amber-600" aria-hidden />
                  <p className="text-sm font-bold text-stone-900">Batches</p>
                  <p className="mt-1 text-xs leading-relaxed text-stone-600">Log what you made in seconds.</p>
                </div>
              </div>
            </div>
          </AnimateIn>
        </div>
      </div>
    </section>
  )
}
