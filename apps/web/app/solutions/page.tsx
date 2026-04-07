import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, CheckCircle2, FlaskConical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Navbar } from '@/components/shared/navbar'
import { Footer } from '@/components/shared/footer'
import { AnimateIn } from '@/components/landing/animate-in'
import { bakerySolutions } from '@/components/landing/content'

export const metadata: Metadata = {
  title: 'Solutions | Operbase for bakeries',
  description:
    'Operbase starts with bakeries. Track ingredients, log batches, record sales, and see margin in one app.',
}

const navLinks = [
  { href: '/', label: 'Home' },
  { href: '/product', label: 'Product' },
  { href: '/pricing', label: 'Pricing' },
]

const comingSoon = [
  { label: 'Food production & catering', description: 'Recipe scaling, event costing, and supplier management.' },
  { label: 'Retail & product brands', description: 'Multi-SKU inventory, channel sales, and margin per product.' },
  { label: 'Light manufacturing', description: 'Bill of materials, work orders, and output tracking.' },
]

export default function SolutionsPage() {
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
                Solutions
              </p>
              <h1 className="text-balance text-4xl font-bold tracking-tight text-stone-900 sm:text-5xl">
                One platform, built for{' '}
                <span className="text-amber-600">how you actually work</span>
              </h1>
              <p className="mt-5 text-pretty text-lg text-stone-600 sm:text-xl">
                Operbase starts with bakeries because they have one of the most complex
                operational loops in small business. We got that right first.
              </p>
            </AnimateIn>
          </div>
        </section>

        {/* Bakery — featured vertical */}
        <section
          className="px-4 py-16 sm:px-6 sm:py-20 lg:px-8"
          aria-labelledby="bakery-heading"
        >
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-10 lg:grid-cols-2 lg:items-start lg:gap-16">

              {/* Left — copy */}
              <AnimateIn>
                <div className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-100 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-amber-800">
                  <FlaskConical className="h-3.5 w-3.5" aria-hidden />
                  Available now
                </div>
                <h2
                  id="bakery-heading"
                  className="mt-5 text-3xl font-bold tracking-tight text-stone-900 sm:text-4xl"
                >
                  Operbase for Bakeries
                </h2>
                <p className="mt-4 text-lg text-stone-600">
                  From ingredient stock to final sale, every step of the bakery workflow is
                  covered. Know your batch cost before you set a price. See your margin after
                  every week.
                </p>

                <ul className="mt-8 space-y-4">
                  {bakerySolutions.map((item) => (
                    <li key={item.title} className="flex items-start gap-3">
                      <CheckCircle2
                        className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600"
                        aria-hidden
                      />
                      <div>
                        <p className="font-semibold text-stone-900">{item.title}</p>
                        <p className="mt-0.5 text-sm text-stone-600">{item.description}</p>
                      </div>
                    </li>
                  ))}
                </ul>

                <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <Button
                    asChild
                    size="lg"
                    className="h-12 rounded-xl bg-amber-600 px-8 text-base font-semibold text-white shadow-md hover:bg-amber-700 hover:-translate-y-px transition-all"
                  >
                    <Link href="/signup">
                      Start free for bakeries
                      <ArrowRight className="ml-2 h-5 w-5" aria-hidden />
                    </Link>
                  </Button>
                  <Button
                    asChild
                    size="lg"
                    variant="outline"
                    className="h-12 rounded-xl border-stone-300 font-semibold text-stone-700 hover:bg-stone-50"
                  >
                    <Link href="/product">See all features</Link>
                  </Button>
                </div>
              </AnimateIn>

              {/* Right — use case cards */}
              <AnimateIn delay={120} className="space-y-4">
                {[
                  {
                    step: '1',
                    title: 'Add your ingredients',
                    body: 'Flour, butter, eggs, packaging: whatever you buy. Set how you buy it (kg, pack) and how recipes use it (g, piece) once.',
                  },
                  {
                    step: '2',
                    title: 'Log a batch',
                    body: "Record \"24 sourdough loaves\" and which ingredients you used. Stock adjusts automatically. Cost per loaf is calculated.",
                  },
                  {
                    step: '3',
                    title: 'Record your sales',
                    body: 'Enter what sold and at what price. Revenue, cost, and profit appear on the dashboard immediately.',
                  },
                ].map((card) => (
                  <div
                    key={card.step}
                    className="flex gap-5 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6"
                  >
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-600 text-sm font-bold text-white"
                      aria-hidden
                    >
                      {card.step}
                    </span>
                    <div>
                      <p className="font-semibold text-stone-900">{card.title}</p>
                      <p className="mt-1 text-sm leading-relaxed text-stone-600">{card.body}</p>
                    </div>
                  </div>
                ))}
              </AnimateIn>
            </div>
          </div>
        </section>

        {/* Coming soon verticals */}
        <section
          className="border-t border-amber-900/10 bg-[#f0ebe3] px-4 py-16 sm:px-6 sm:py-20 lg:px-8"
          aria-labelledby="coming-soon-heading"
        >
          <div className="mx-auto max-w-7xl">
            <div className="mx-auto mb-12 max-w-2xl text-center">
              <p className="mb-3 text-xs font-bold uppercase tracking-widest text-amber-700">
                Coming soon
              </p>
              <h2
                id="coming-soon-heading"
                className="text-3xl font-bold tracking-tight text-stone-900 sm:text-4xl"
              >
                More verticals on the way
              </h2>
              <p className="mt-4 text-stone-600">
                We add verticals slowly on purpose so each one actually works, not just ships.
              </p>
            </div>
            <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {comingSoon.map((item, i) => (
                <AnimateIn
                  key={item.label}
                  as="li"
                  delay={60 + i * 60}
                  className="rounded-2xl border border-stone-200/80 bg-white/70 p-6 sm:p-8"
                >
                  <div className="mb-2 inline-block rounded-full border border-stone-200 bg-stone-100 px-2.5 py-1 text-xs font-semibold text-stone-500">
                    Coming soon
                  </div>
                  <h3 className="mt-3 text-lg font-bold text-stone-700">{item.label}</h3>
                  <p className="mt-2 text-sm text-stone-500">{item.description}</p>
                </AnimateIn>
              ))}
            </ul>
            <div className="mt-10 text-center">
              <p className="text-sm text-stone-600">
                Building something specific?{' '}
                <a
                  href="mailto:hello@operbase.com"
                  className="font-semibold text-amber-700 underline underline-offset-2 hover:text-amber-800"
                >
                  Tell us what you need.
                </a>
              </p>
            </div>
          </div>
        </section>

      </main>

      <Footer />
    </div>
  )
}
