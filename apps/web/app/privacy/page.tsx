import type { Metadata } from 'next'
import Navbar from '@/components/shared/navbar'
import Footer from '@/components/shared/footer'

export const metadata: Metadata = {
  title: 'Privacy Policy | Operbase',
  description: 'How Operbase collects, uses, and protects your data.',
}

const EFFECTIVE_DATE = '5 April 2026'
const CONTACT_EMAIL = 'privacy@operbase.com'

export default function PrivacyPage() {
  return (
    <>
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 py-16 sm:py-24">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
        <p className="text-sm text-gray-500 mb-10">Effective date: {EFFECTIVE_DATE}</p>

        <div className="prose prose-gray max-w-none space-y-10 text-gray-700 leading-relaxed">

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Who we are</h2>
            <p>
              Operbase (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;) is a business operations
              platform that helps small businesses track inventory, production, and sales. We are the data
              controller for the personal data described in this policy.
            </p>
            <p className="mt-2">
              Contact:{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-amber-700 underline">
                {CONTACT_EMAIL}
              </a>
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">2. What data we collect</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong>Account data:</strong> email address, password (hashed; we never see the plaintext),
                and the date you accepted these terms.
              </li>
              <li>
                <strong>Business data:</strong> business name, logo, brand colour, business type, and the
                currency you operate in.
              </li>
              <li>
                <strong>Operational data:</strong> stock items, production batches, sales records, and
                customer names/contact details you choose to record.
              </li>
              <li>
                <strong>Usage data:</strong> anonymised event logs (e.g. &ldquo;batch created&rdquo;) used
                to improve the product. These are linked to your business ID, not your personal identity.
              </li>
              <li>
                <strong>Technical data:</strong> IP address, browser type, and session cookies necessary
                to keep you signed in.
              </li>
            </ul>
            <p className="mt-3">
              We do <strong>not</strong> collect payment card details. Any future payment processing will
              be handled entirely by certified third-party gateways.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">3. Why we collect it and our legal basis</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border border-gray-200 rounded-lg">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left p-3 font-semibold text-gray-700">Purpose</th>
                    <th className="text-left p-3 font-semibold text-gray-700">Legal basis (GDPR / NDPR)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr>
                    <td className="p-3">Providing and maintaining the service</td>
                    <td className="p-3">Performance of contract</td>
                  </tr>
                  <tr>
                    <td className="p-3">Account authentication and security</td>
                    <td className="p-3">Legitimate interest / legal obligation</td>
                  </tr>
                  <tr>
                    <td className="p-3">Improving product features</td>
                    <td className="p-3">Legitimate interest (anonymised data)</td>
                  </tr>
                  <tr>
                    <td className="p-3">Responding to support requests</td>
                    <td className="p-3">Performance of contract</td>
                  </tr>
                  <tr>
                    <td className="p-3">Complying with legal obligations</td>
                    <td className="p-3">Legal obligation</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Who we share your data with</h2>
            <p>We do not sell your data. We share it only with:</p>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li>
                <strong>Supabase Inc.</strong>, our database and authentication provider, acting as a
                data processor under a Data Processing Agreement. Data is stored on servers in the EU
                (Frankfurt region by default). Supabase is SOC 2 Type II certified.
              </li>
              <li>
                <strong>Vercel Inc.</strong>, our hosting provider. It processes request/response data in
                order to serve the application.
              </li>
              <li>
                <strong>Legal authorities</strong> when the law requires it or to protect our rights.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">5. How long we keep your data</h2>
            <p>
              We retain your account and business data for as long as your account is active. If you delete
              your account, we will delete or anonymise your personal data within 30 days, except where
              retention is required by law (e.g. financial records that may need to be kept for up to 7 years).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Cookies</h2>
            <p>
              We use <strong>strictly necessary cookies only</strong>, specifically the session cookie set
              by Supabase Auth to keep you signed in. This cookie is essential to the service and does not
              require your consent under GDPR or NDPR.
            </p>
            <p className="mt-2">
              We do not use advertising cookies, third-party tracking pixels, or cross-site tracking of
              any kind.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Your rights</h2>
            <p>Under GDPR (if you are in the EU/EEA) and NDPR (if you are in Nigeria), you have the right to:</p>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li><strong>Access:</strong> request a copy of your personal data.</li>
              <li><strong>Correction:</strong> ask us to correct inaccurate data.</li>
              <li><strong>Erasure:</strong> request deletion of your personal data (&ldquo;right to be forgotten&rdquo;).</li>
              <li><strong>Portability:</strong> receive your data in a structured, machine-readable format.</li>
              <li><strong>Object:</strong> object to processing based on legitimate interest.</li>
              <li><strong>Withdraw consent:</strong> where processing is based on consent, you may withdraw it at any time.</li>
            </ul>
            <p className="mt-3">
              To exercise any of these rights, email{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-amber-700 underline">
                {CONTACT_EMAIL}
              </a>
              . We will respond within 30 days.
            </p>
            <p className="mt-2">
              You also have the right to lodge a complaint with your supervisory authority, for example the{' '}
              <strong>Nigeria Data Protection Commission (NDPC)</strong> for Nigerian users, or your local
              EU data protection authority for EU users.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">8. Data security</h2>
            <p>
              All data is encrypted in transit (TLS) and at rest. We use Row Level Security (RLS) in our
              database so that each business can only access its own data. Passwords are hashed using
              bcrypt. We cannot recover your password.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">9. Changes to this policy</h2>
            <p>
              We may update this policy as the product evolves. We will notify you of material changes by
              email or by a notice in the app at least 14 days before the change takes effect. Continued
              use of the service after that date constitutes acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">10. Contact us</h2>
            <p>
              For any privacy-related questions or to exercise your rights:{' '}
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
