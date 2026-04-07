import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowRight } from 'lucide-react'
import { problemCards, productPillars, homepageSteps, testimonials } from './content'
import { cn } from '@/lib/utils'
import { AnimateIn } from './animate-in'

function SectionHeading({
  id,
  eyebrow,
  title,
  description,
  className,
}: {
  id?: string
  eyebrow?: string
  title: string
  description?: string
  className?: string
}) {
  return (
    <div className={cn('mx-auto mb-12 max-w-3xl text-center sm:mb-16', className)}>
      {eyebrow ? (
        <p className="mb-3 inline-block rounded-full border border-amber-800/10 bg-white/80 px-3 py-1 text-xs font-bold uppercase tracking-widest text-amber-900/90 shadow-sm">
          {eyebrow}
        </p>
      ) : null}
      <h2
        id={id}
        className="text-balance font-bold tracking-tight text-stone-900"
        style={{ fontSize: 'clamp(1.75rem, 3vw + 1rem, 2.5rem)', lineHeight: 1.15 }}
      >
        {title}
      </h2>
      {description ? (
        <p className="mt-4 text-pretty text-lg leading-relaxed text-stone-600">{description}</p>
      ) : null}
    </div>
  )
}

export function LandingProblemSection() {
  return (
    <section
      id="solutions"
      className="scroll-mt-20 border-b border-amber-900/10 bg-[#fdfcfa] px-4 py-20 sm:px-6 sm:py-24 lg:px-8"
      aria-labelledby="solutions-heading"
    >
      <div className="mx-auto max-w-7xl">
        <SectionHeading
          id="solutions-heading"
          eyebrow="Sound familiar?"
          title="You should not need five apps to answer one question"
          description="Operbase is for owners who want the real numbers without enterprise bloat."
        />
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
          {problemCards.map((item, i) => (
            <AnimateIn
              key={item.title}
              as="li"
              delay={80 + i * 70}
              className="group rounded-2xl border border-stone-200/90 bg-white p-6 shadow-md shadow-stone-900/5 transition hover:-translate-y-0.5 hover:border-amber-200/80 hover:shadow-lg hover:shadow-amber-900/10 sm:p-8"
            >
              <div className="mb-5 inline-flex rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 p-3 text-white shadow-lg shadow-amber-900/20">
                <item.icon className="h-7 w-7" aria-hidden />
              </div>
              <h3 className="text-lg font-bold text-stone-900">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-stone-600 sm:text-base">{item.description}</p>
            </AnimateIn>
          ))}
        </ul>
      </div>
    </section>
  )
}

export function LandingProductSection() {
  return (
    <section
      id="product"
      className="scroll-mt-20 px-4 py-20 sm:px-6 sm:py-24 lg:px-8"
      aria-labelledby="product-heading"
    >
      <div className="mx-auto max-w-7xl">
        <SectionHeading
          id="product-heading"
          eyebrow="One workspace"
          title="Stock, production, and sales connected"
          description="Each step feeds the next so profit is not a guess."
        />
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
          {productPillars.map((item, i) => (
            <AnimateIn
              key={item.title}
              as="li"
              delay={60 + i * 80}
              className="rounded-2xl border border-stone-200/80 bg-gradient-to-b from-white to-amber-50/30 p-8 text-center shadow-md shadow-stone-900/5"
            >
              <div className="mx-auto mb-5 inline-flex rounded-2xl border border-amber-100 bg-amber-50 p-4 text-amber-700 shadow-inner">
                <item.icon className="h-8 w-8" aria-hidden />
              </div>
              <h3 className="text-lg font-bold text-stone-900">{item.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-stone-600 sm:text-base">{item.description}</p>
            </AnimateIn>
          ))}
        </ul>
        <div className="mt-12 text-center">
          <Button
            asChild
            variant="outline"
            className="border-stone-300 font-semibold text-stone-700 hover:border-amber-400/60 hover:bg-amber-50"
          >
            <Link href="/product">
              Explore all features
              <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  )
}

export function LandingStepsSection() {
  return (
    <section
      className="border-y border-amber-900/10 bg-[#f0ebe3] px-4 py-20 sm:px-6 sm:py-24 lg:px-8"
      aria-labelledby="steps-heading"
    >
      <div className="mx-auto max-w-7xl">
        <SectionHeading id="steps-heading" eyebrow="Quick setup" title="Three steps and you are tracking profit" />
        <ol className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
          {homepageSteps.map((item, i) => (
            <AnimateIn
              key={item.title}
              as="li"
              delay={70 + i * 75}
              className="relative rounded-2xl border border-white/80 bg-white/90 p-6 shadow-lg shadow-stone-900/8 backdrop-blur-sm sm:p-8"
            >
              <span
                className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-600 to-orange-600 text-lg font-bold text-white shadow-md"
                aria-hidden
              >
                {i + 1}
              </span>
              <h3 className="text-lg font-bold text-stone-900">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-stone-600 sm:text-base">{item.description}</p>
            </AnimateIn>
          ))}
        </ol>
      </div>
    </section>
  )
}

export function LandingTestimonialsSection() {
  return (
    <section className="bg-[#f0ebe3] px-4 py-20 sm:px-6 sm:py-24 lg:px-8" aria-labelledby="testimonials-heading">
      <div className="mx-auto max-w-7xl">
        <SectionHeading
          id="testimonials-heading"
          eyebrow="Real talk"
          title="What owners tell us"
          description="Sample quotes for now. We are collecting real stories as people use the app."
        />
        <ul className="grid gap-6 md:grid-cols-3 md:gap-8">
          {testimonials.map((t, i) => (
            <AnimateIn
              key={t.name + t.role}
              as="li"
              delay={60 + i * 70}
              className="relative rounded-2xl border border-white/90 bg-white p-6 shadow-lg shadow-stone-900/8 sm:p-8"
            >
              <span
                className="absolute right-6 top-6 font-serif text-5xl leading-none text-amber-200/90"
                aria-hidden
              >
                &ldquo;
              </span>
              <p className="sr-only">5 out of 5 stars</p>
              <div className="mb-4 flex gap-0.5 text-amber-500" aria-hidden>
                {Array.from({ length: 5 }).map((_, j) => (
                  <span key={j} className="text-lg leading-none">
                    ★
                  </span>
                ))}
              </div>
              <blockquote>
                <p className="relative text-sm leading-relaxed text-stone-800 sm:text-base">{t.quote}</p>
                <footer className="mt-5 border-t border-stone-100 pt-4">
                  <p className="font-bold text-stone-900">{t.name}</p>
                  <p className="text-sm text-stone-500">{t.role}</p>
                </footer>
              </blockquote>
            </AnimateIn>
          ))}
        </ul>
      </div>
    </section>
  )
}

export function LandingPricingCtaSection() {
  return (
    <section
      id="pricing"
      className="scroll-mt-20 border-t border-amber-900/10 bg-[#fdfcfa] px-4 py-20 sm:px-6 sm:py-24 lg:px-8"
      aria-labelledby="pricing-heading"
    >
      <div className="mx-auto max-w-4xl">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-600 via-orange-600 to-amber-700 px-6 py-12 text-center shadow-2xl shadow-amber-900/30 sm:px-12 sm:py-14">
          <div
            className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-orange-900/20 blur-2xl"
            aria-hidden
          />
          <h2
            id="pricing-heading"
            className="relative text-balance font-bold tracking-tight text-white"
            style={{ fontSize: 'clamp(1.75rem, 3vw + 1rem, 2.75rem)', lineHeight: 1.15 }}
          >
            Start free. Scale when you are ready.
          </h2>
          <p className="relative mx-auto mt-4 max-w-xl text-pretty text-lg text-amber-50/95">
            Create an account, set up your business, and invite your team when it makes sense. No credit card to
            sign up.
          </p>
          <div className="relative mt-10 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <Button
              asChild
              size="lg"
              className="h-12 min-h-12 rounded-xl border-0 bg-white px-8 text-base font-bold text-amber-900 shadow-lg hover:bg-amber-50"
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
              className="h-12 min-h-12 rounded-xl border-2 border-white/40 bg-transparent font-semibold text-white hover:bg-white/10 hover:text-white"
            >
              <Link href="/pricing">See pricing</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
