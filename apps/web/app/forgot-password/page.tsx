'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { toast } from 'sonner'
import { Wheat, ArrowLeft, Mail, CheckCircle2 } from 'lucide-react'
import { requestPasswordReset } from '@/lib/auth'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setIsLoading(true)
    try {
      await requestPasswordReset(email.trim())
      setSent(true)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong. Try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex" style={{ backgroundColor: '#fdfcfa' }}>
      {/* Left — form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center px-6 md:px-12 py-12">
        <div className="max-w-md mx-auto w-full">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 mb-12 group w-fit">
            <div className="w-10 h-10 bg-amber-600 rounded-xl flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
              <Wheat className="text-white" size={22} />
            </div>
            <span className="text-xl font-bold text-gray-900">Operbase</span>
          </Link>

          {sent ? (
            /* ── Confirmation state ─────────────────────────────────────── */
            <div className="space-y-6">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#f0fdf4' }}>
                <CheckCircle2 className="text-green-600" size={28} />
              </div>
              <div>
                <h2 className="text-3xl font-bold text-gray-900 mb-2 tracking-tight">Check your inbox</h2>
                <p className="text-gray-600 leading-relaxed">
                  We sent a reset link to{' '}
                  <span className="font-semibold text-gray-900">{email}</span>.
                  Click it to choose a new password.
                </p>
              </div>

              <div className="rounded-2xl border border-amber-200/80 bg-amber-50/60 p-4 text-sm text-amber-900 space-y-1">
                <p className="font-medium">Nothing arrived?</p>
                <p className="text-amber-800/80">Check your spam folder. The link expires in one hour.</p>
                <button
                  type="button"
                  className="font-semibold text-amber-700 hover:text-amber-900 underline underline-offset-2 transition-colors mt-1"
                  onClick={() => setSent(false)}
                >
                  Send again
                </button>
              </div>

              <Link
                href="/login"
                className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors"
              >
                <ArrowLeft size={15} />
                Back to sign in
              </Link>
            </div>
          ) : (
            /* ── Form state ─────────────────────────────────────────────── */
            <div className="space-y-8">
              <div>
                <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2 tracking-tight">
                  Reset your password
                </h2>
                <p className="text-gray-500">
                  Enter your email and we will send a link to set a new one.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <Label htmlFor="email" className="text-sm font-semibold text-gray-800 mb-1.5 block">
                    Email address
                  </Label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoFocus
                      className="pl-10 py-3 border border-gray-200 rounded-xl bg-white shadow-sm focus-visible:ring-amber-500/40"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-amber-600 hover:bg-amber-700 text-white py-3 rounded-xl font-semibold shadow-sm hover:shadow-md transition-all min-h-[48px]"
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <Spinner className="w-4 h-4" />
                      Sending…
                    </span>
                  ) : (
                    'Send reset link'
                  )}
                </Button>
              </form>

              <Link
                href="/login"
                className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors"
              >
                <ArrowLeft size={15} />
                Back to sign in
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Right — decorative panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-amber-50 via-orange-50/80 to-amber-100 flex-col justify-center items-center p-12 relative overflow-hidden">
        {/* Background texture */}
        <div className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: 'radial-gradient(circle at 30% 70%, rgba(245,158,11,0.15) 0%, transparent 60%), radial-gradient(circle at 80% 20%, rgba(234,88,12,0.1) 0%, transparent 50%)',
          }}
        />
        <div className="max-w-sm text-center relative z-10">
          <div className="inline-flex p-5 bg-white rounded-3xl shadow-xl mb-8">
            <Wheat className="text-amber-600" size={44} />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-3 tracking-tight">
            We will get you back in
          </h3>
          <p className="text-gray-600 leading-relaxed">
            The link expires in one hour. Set a new password and you are straight back to your dashboard.
          </p>
        </div>
      </div>
    </main>
  )
}
