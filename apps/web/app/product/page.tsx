import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Navbar } from '@/components/shared/navbar'
import { Footer } from '@/components/shared/footer'
import { AnimateIn } from '@/components/landing/animate-in'
import { productModules, productFeatures } from '@/components/landing/content'

export const metadata: Metadata = {
  title: 'Product — How Operbase works',
  description:
    'Stock, production, and sales modules built for small business operators. Simple enough to use daily, connected enough to show real profit.',
}

const navLinks = [
  { href: '/', label: 'Home' },
  { href: '/solutions', label: 'Solutions' },
  { href: '/pricing', label: 'Pricing' },
]

export default function ProductPage() {
  return (
    <div className="relative min-h-screen bg-[#f7f4ee] text-stone-900">
      <a
        href="#main-content"
        className="absolute left-[-9999px] top-0 z-[100] rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white focus:left-4 focus:top-4 focus:outline-none focus:ring-2 focus:ring-amber-300"
      >
        Skip to main content
      </a>
      <Navbar links={navLinks} showCta ctaText="Start free" ctaHref="/signup" />

      <main id="main-content" className="pt-16 sm:pt-20">

        {/* Page header */}
        <section className="border-b border-amber-900/10 bg-[#f7f4ee] px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <AnimateIn>
              <p className="mb-3 text-xs font-bold uppercase tracking-widest text-amber-700">
                Product
              </p>
              <h1 className="text-balance text-4xl font-bold tracking-tight text-stone-900 sm:text-5xl">
                Every module you need.{' '}
                <span className="text-amber-600">Nothing you don&apos;t.</span>
              </h1>
              <p className="mt-5 text-pretty text-lg text-stone-600 sm:text-xl">
                Operbase is built around four connected modules. Each one is useful alone.
                Together, they give you a complete picture of your business.
              </p>
              <div className="mt-8">
                <Button
                  asChild
                  size="lg"
                  className="h-12 rounded-xl bg-amber-600 px-8 text-base font-semibold text-white shadow-md shadow-amber-900/20 hover:bg-amber-700 hover:-translate-y-px transition-all"
                >
                  <Link href="/signup">
                    Start free
                    <ArrowRight className="ml-2 h-5 w-5" aria-hidden />
                  </Link>
                </Button>
              </div>
            </AnimateIn>
          </div>
        </section>

        {/* Module deep-dives */}
        <section
          className="px-4 py-16 sm:px-6 sm:py-20 lg:px-8"
          aria-labelledby="modules-heading"
        >
          <div className="mx-auto max-w-7xl">
            <h2 id="modules-heading" className="sr-only">
              Product modules
            </h2>
            <div className="space-y-16 lg:space-y-24">
              {productModules.map((mod, i) => (
                <AnimateIn
                  key={mod.title}
                  delay={60}
                  className={`flex flex-col gap-10 lg:flex-row lg:items-center lg:gap-16 ${
                    i % 2 === 1 ? 'lg:flex-row-reverse' : ''
                  }`}
                >
                  {/* Text side */}
                  <div className="flex-1">
                    <div className="mb-5 inline-flex rounded-2xl bg-amber-100 p-4 text-amber-700">
                      <mod.icon className="h-8 w-8" aria-hidden />
                    </div>
                    <h3 className="text-2xl font-bold text-stone-900 sm:text-3xl">{mod.title}</h3>
                    <p className="mt-3 text-lg font-medium text-amber-700">{mod.tagline}</p>
                    <ul className="mt-6 space-y-3">
                      {mod.features.map((f) => (
                        <li key={f} className="flex items-start gap-3">
                          <CheckCircle2
                            className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600"
                            aria-hidden
                          />
                          <span className="text-stone-700">{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Visual side */}
                  <div className="flex-1">
                    <div className="rounded-2xl border border-stone-200 bg-white p-8 shadow-md shadow-stone-900/5">
                      <div className="mb-4 flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                          <mod.icon className="h-5 w-5" aria-hidden />
                        </div>
                        <span className="text-sm font-bold text-stone-700 uppercase tracking-wide">
                          {mod.title}
                        </span>
                      </div>
                      <div className="space-y-2">
                        {mod.features.map((f, j) => (
                          <div
                            key={j}
                            className="flex items-center gap-3 rounded-lg border border-stone-100 bg-stone-50 px-4 py-3"
                          >
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" aria-hidden />
                            <span className="text-sm text-stone-600">{f}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </AnimateIn>
              ))}
            </div>
          </div>
        </section>

        {/* Feature grid */}
        <section
          className="border-t border-amber-900/10 bg-[#f0ebe3] px-4 py-16 sm:px-6 sm:py-20 lg:px-8"
          aria-labelledby="features-heading"
        >
          <div className="mx-auto max-w-7xl">
            <div className="mx-auto mb-12 max-w-2xl text-center sm:mb-16">
              <p className="mb-3 text-xs font-bold uppercase tracking-widest text-amber-700">
                Built in
              </p>
              <h2
                id="features-heading"
                className="text-balance text-3xl font-bold tracking-tight text-stone-900 sm:text-4xl"
              >
                Everything included. No add-ons.
              </h2>
            </div>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
              {productFeatures.map((item, i) => (
                <AnimateIn
                  key={item.title}
                  as="li"
                  delay={50 + i * 40}
                  className="flex gap-4 rounded-2xl border border-white/80 bg-white p-5 shadow-sm sm:p-6"
                >
                  <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                    <item.icon className="h-5 w-5" aria-hidden />
                  </span>
                  <div>
                    <h3 className="font-bold text-stone-900">{item.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-stone-600">
                      {item.description}
                    </p>
                  </div>
                </AnimateIn>
              ))}
            </ul>
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-balance text-3xl font-bold tracking-tight text-stone-900 sm:text-4xl">
              Ready to see it in action?
            </h2>
            <p className="mt-4 text-lg text-stone-600">
              Free account. No card. Set up in minutes.
            </p>
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Button
                asChild
                size="lg"
                className="h-12 min-h-12 rounded-xl bg-amber-600 px-8 text-base font-semibold text-white shadow-md hover:bg-amber-700 hover:-translate-y-px transition-all"
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
                className="h-12 min-h-12 rounded-xl border-stone-300 font-semibold text-stone-700 hover:bg-stone-50"
              >
                <Link href="/solutions">See use cases</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
