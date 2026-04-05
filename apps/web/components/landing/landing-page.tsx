import { LandingNav } from './landing-nav'
import { LandingHero } from './landing-hero'
import {
  LandingProblemSection,
  LandingProductSection,
  LandingStepsSection,
  LandingTestimonialsSection,
  LandingPricingCtaSection,
} from './landing-sections'
import { LandingFooter } from './landing-footer'

export function LandingPage() {
  return (
    <div data-landing className="landing-page-bg relative min-h-screen text-stone-900">
      <a
        href="#main-content"
        className="absolute left-[-9999px] top-0 z-[100] rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white shadow-lg focus:left-4 focus:top-4 focus:outline-none focus:ring-2 focus:ring-amber-300 focus:ring-offset-2 focus:ring-offset-[#f7f4ee]"
      >
        Skip to main content
      </a>
      <LandingNav />
      <main id="main-content">
        <LandingHero />
        <LandingProblemSection />
        <LandingProductSection />
        <LandingStepsSection />
        <LandingTestimonialsSection />
        <LandingPricingCtaSection />
      </main>
      <LandingFooter />
    </div>
  )
}
