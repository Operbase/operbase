import type { Metadata } from 'next'
import Navbar from '@/components/shared/navbar'
import Footer from '@/components/shared/footer'

export const metadata: Metadata = {
  title: 'Terms of Service | Operbase',
  description: 'The terms that govern your use of Operbase.',
}

const EFFECTIVE_DATE = '5 April 2026'
const CONTACT_EMAIL = 'hello@operbase.com'

export default function TermsPage() {
  return (
    <>
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 py-16 sm:py-24">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Terms of Service</h1>
        <p className="text-sm text-gray-500 mb-10">Effective date: {EFFECTIVE_DATE}</p>

        <div className="prose prose-gray max-w-none space-y-10 text-gray-700 leading-relaxed">

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Agreement to these terms</h2>
            <p>
              By creating an account or using Operbase, you agree to be bound by these Terms of Service
              (&ldquo;Terms&rdquo;). If you do not agree, do not use the service.
            </p>
            <p className="mt-2">
              These Terms form a legal agreement between you (the business owner or authorised user) and
              Operbase. By accepting, you confirm you have the authority to bind yourself or your business
              to these Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">2. What Operbase is</h2>
            <p>
              Operbase is a business operations platform that helps small businesses track inventory,
              manage production batches, record sales, and understand profitability. The current version
              is designed primarily for bakeries and food production businesses.
            </p>
            <p className="mt-2">
              We provide the platform on a subscription or free-tier basis. Features available to you
              depend on the plan you are on.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">3. Your account</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>You must provide accurate information when creating your account.</li>
              <li>You are responsible for maintaining the security of your account credentials.</li>
              <li>You must notify us immediately of any unauthorised access to your account.</li>
              <li>One account may be linked to one business at a time (multi-business support is a future feature).</li>
              <li>You must be at least 18 years old to use Operbase.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Acceptable use</h2>
            <p>You agree not to:</p>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li>Use Operbase for any unlawful purpose or in violation of any applicable laws.</li>
              <li>Attempt to gain unauthorised access to other users&apos; data or our systems.</li>
              <li>Reverse-engineer, decompile, or attempt to extract the source code of the platform.</li>
              <li>Use automated scripts to scrape or overload our servers.</li>
              <li>Resell or sublicense access to Operbase without our written permission.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Your data</h2>
            <p>
              You own all business data you enter into Operbase (stock items, batches, sales records, etc.).
              We do not claim ownership of your data.
            </p>
            <p className="mt-2">
              You grant us a limited licence to store, process, and display your data solely for the purpose
              of providing the service to you.
            </p>
            <p className="mt-2">
              Our use of your personal data is governed by our{' '}
              <a href="/privacy" className="text-amber-700 underline">Privacy Policy</a>, which forms part
              of these Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Plans and payments</h2>
            <p>
              Operbase is currently available on a free tier. When paid plans are introduced:
            </p>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li>Pricing will be clearly communicated before you are charged.</li>
              <li>Subscriptions will be billed in advance on a monthly or annual basis.</li>
              <li>You may cancel at any time; you will retain access until the end of your billing period.</li>
              <li>Refunds are at our discretion for annual plans if cancelled within 14 days of renewal.</li>
              <li>We reserve the right to change pricing with at least 30 days&apos; notice.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Service availability</h2>
            <p>
              We aim to keep Operbase available at all times but do not guarantee uninterrupted access.
              We may perform maintenance, apply updates, or experience outages. We will endeavour to give
              advance notice of planned downtime where possible.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">8. Intellectual property</h2>
            <p>
              Operbase, its logo, design, and underlying software are owned by us or our licensors. Nothing
              in these Terms grants you ownership of our intellectual property.
            </p>
            <p className="mt-2">
              Feedback, feature requests, and suggestions you submit to us may be used by us without
              obligation to you.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">9. Termination</h2>
            <p>
              <strong>By you:</strong> You may close your account at any time. Contact us at{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-amber-700 underline">{CONTACT_EMAIL}</a>{' '}
              to request account deletion. We will delete your data within 30 days per our Privacy Policy.
            </p>
            <p className="mt-2">
              <strong>By us:</strong> We may suspend or terminate your account if you breach these Terms,
              engage in fraudulent activity, or if we are required to do so by law. We will give reasonable
              notice where possible.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">10. Limitation of liability</h2>
            <p>
              Operbase is provided &ldquo;as is&rdquo;. To the fullest extent permitted by law, we exclude
              all warranties, express or implied.
            </p>
            <p className="mt-2">
              We are not liable for any indirect, incidental, or consequential loss arising from your use
              of Operbase, including but not limited to loss of profits, loss of data, or business
              interruption.
            </p>
            <p className="mt-2">
              Our total liability to you in any 12-month period shall not exceed the amount you paid us
              in that period (or NGN 10,000 if you are on the free tier).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">11. Governing law</h2>
            <p>
              These Terms are governed by the laws of the Federal Republic of Nigeria. Disputes shall
              be subject to the exclusive jurisdiction of the courts of Nigeria.
            </p>
            <p className="mt-2">
              For users in the European Union, nothing in these Terms removes your statutory rights under
              EU consumer protection law.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">12. Changes to these terms</h2>
            <p>
              We may update these Terms from time to time. We will notify you of material changes by email
              or in-app notice at least 14 days before they take effect. Continued use of the service after
              that date constitutes acceptance of the updated Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">13. Contact us</h2>
            <p>
              Questions about these Terms?{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-amber-700 underline">
                {CONTACT_EMAIL}
              </a>
            </p>
          </section>

        </div>
      </main>
      <Footer />
    </>
  )
}
