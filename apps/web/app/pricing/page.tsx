import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Navbar } from '@/components/shared/navbar'
import { Footer } from '@/components/shared/footer'
import { AnimateIn } from '@/components/landing/animate-in'
import { pricingPlans, pricingFaq } from '@/components/landing/content'
import { cn } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'Pricing — Operbase',
  description:
    'Free to start. Upgrade when your business grows. No credit card required to get going.',
}

const navLinks = [
  { href: '/', label: 'Home' },
  { href: '/product', label: 'Product' },
  { href: '/solutions', label: 'Solutions' },
]

export default function PricingPage() {
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
          <div className="mx-auto max-w-2xl text-center">
            <AnimateIn>
              <p className="mb-3 text-xs font-bold uppercase tracking-widest text-amber-700">
                Pricing
              </p>
              <h1 className="text-balance text-4xl font-bold tracking-tight text-stone-900 sm:text-5xl">
                Simple pricing.{' '}
                <span className="text-amber-600">No surprises.</span>
              </h1>
              <p className="mt-5 text-pretty text-lg text-stone-600">
                Start free, stay free, or upgrade when you need more. Your data is always yours.
              </p>
            </AnimateIn>
          </div>
        </section>

        {/* Plans */}
        <section
          className="px-4 py-16 sm:px-6 sm:py-20 lg:px-8"
          aria-labelledby="plans-heading"
        >
          <h2 id="plans-heading" className="sr-only">
            Pricing plans
          </h2>
          <div className="mx-auto grid max-w-4xl gap-6 sm:grid-cols-2 lg:gap-8">
            {pricingPlans.map((plan, i) => (
              <AnimateIn
                key={plan.name}
                delay={60 + i * 80}
                className={cn(
                  'relative flex flex-col rounded-2xl border p-8',
                  plan.highlighted
                    ? 'border-amber-400/60 bg-gradient-to-b from-amber-50 to-white shadow-lg shadow-amber-900/10'
                    : 'border-stone-200 bg-white shadow-md shadow-stone-900/5'
                )}
              >
                {plan.highlighted && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <span className="rounded-full bg-amber-600 px-4 py-1 text-xs font-bold uppercase tracking-wider text-white shadow-md">
                      Most popular
                    </span>
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-lg font-bold text-stone-900">{plan.name}</h3>
                  <div className="mt-3 flex items-end gap-1.5">
                    <span className="text-4xl font-bold tracking-tight text-stone-900">
                      {plan.price}
                    </span>
                    <span className="mb-1 text-sm text-stone-500">/ {plan.period}</span>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-stone-600">
                    {plan.description}
                  </p>
                </div>

                <ul className="mb-8 flex-1 space-y-3">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-3">
                      <CheckCircle2
                        className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600"
                        aria-hidden
                      />
                      <span className="text-sm text-stone-700">{f}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  asChild
                  size="lg"
                  className={cn(
                    'h-12 w-full rounded-xl text-base font-semibold transition-all hover:-translate-y-px',
                    plan.highlighted
                      ? 'bg-amber-600 text-white shadow-md shadow-amber-900/20 hover:bg-amber-700'
                      : 'bg-stone-900 text-white hover:bg-stone-800'
                  )}
                >
                  <Link href={plan.ctaHref}>
                    {plan.cta}
                    <ArrowRight className="ml-2 h-5 w-5" aria-hidden />
                  </Link>
                </Button>
              </AnimateIn>
            ))}
          </div>

          <p className="mt-8 text-center text-sm text-stone-500">
            All plans include your currency, brand colour, and logo. No hidden fees.
          </p>
        </section>

        {/* FAQ */}
        <section
          className="border-t border-amber-900/10 bg-[#f0ebe3] px-4 py-16 sm:px-6 sm:py-20 lg:px-8"
          aria-labelledby="faq-heading"
        >
          <div className="mx-auto max-w-3xl">
            <h2
              id="faq-heading"
              className="mb-10 text-center text-3xl font-bold tracking-tight text-stone-900 sm:text-4xl"
            >
              Questions
            </h2>
            <dl className="space-y-6">
              {pricingFaq.map((item, i) => (
                <AnimateIn
                  key={item.question}
                  delay={50 + i * 40}
                  className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8"
                >
                  <dt className="font-semibold text-stone-900">{item.question}</dt>
                  <dd className="mt-2 text-sm leading-relaxed text-stone-600">{item.answer}</dd>
                </AnimateIn>
              ))}
            </dl>
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-balance text-3xl font-bold tracking-tight text-stone-900 sm:text-4xl">
              Start for free today
            </h2>
            <p className="mt-4 text-lg text-stone-600">
              No card required. Your account is ready in minutes.
            </p>
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Button
                asChild
                size="lg"
                className="h-12 min-h-12 rounded-xl bg-amber-600 px-8 text-base font-semibold text-white shadow-md shadow-amber-900/20 hover:bg-amber-700 hover:-translate-y-px transition-all"
              >
                <Link href="/signup">
                  Create your account
                  <ArrowRight className="ml-2 h-5 w-5" aria-hidden />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-12 min-h-12 rounded-xl border-stone-300 font-semibold text-stone-700 hover:bg-stone-50"
              >
                <Link href="/product">See the product first</Link>
              </Button>
            </div>
          </div>
        </section>

      </main>

      <Footer />
    </div>
  )
}
