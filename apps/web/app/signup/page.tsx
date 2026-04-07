'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { toast } from 'sonner'
import { Wheat, ArrowRight, ChevronLeft, Eye, EyeOff, Check, X } from 'lucide-react'
import { signUp, signInWithGoogle } from '@/lib/auth'

const PASSWORD_RULES = [
  { label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
  { label: 'One uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'One number', test: (p: string) => /[0-9]/.test(p) },
  { label: 'One special character', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
]

export default function SignupPage() {
  const [step, setStep] = useState<'account' | 'confirm'>('account')
  const [isLoading, setIsLoading] = useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
  })
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const router = useRouter()

  function handleInputChange(field: string, value: string) {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  function handleAccountStep(e: React.FormEvent) {
    e.preventDefault()

    const failed = PASSWORD_RULES.filter((r) => !r.test(formData.password))
    if (failed.length > 0) {
      toast.error(`Password must have: ${failed.map((r) => r.label.toLowerCase()).join(', ')}`)
      return
    }
    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match')
      return
    }
    setStep('confirm')
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    if (!agreedToTerms) {
      toast.error('Please accept the Terms of Service and Privacy Policy to continue.')
      return
    }
    setIsLoading(true)

    try {
      await signUp(formData.email, formData.password, {
        accepted_terms_at: new Date().toISOString(),
        accepted_terms_version: '2026-04-05',
      })
      toast.success('Account created. Check your email to verify, then sign in.')
      router.push('/login')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Signup failed')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleGoogleSignIn() {
    setIsGoogleLoading(true)
    try {
      await signInWithGoogle()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Google sign-in failed')
      setIsGoogleLoading(false)
    }
  }

  const steps = ['account', 'confirm']
  const passwordFilled = formData.password.length > 0

  return (
    <main className="min-h-screen flex bg-white">
      <div className="w-full lg:w-1/2 flex flex-col justify-center px-6 md:px-12 py-12">
        <div className="max-w-md mx-auto w-full">
          <div className="flex items-center gap-2 mb-12">
            <div className="w-10 h-10 bg-amber-600 rounded-lg flex items-center justify-center">
              <Wheat className="text-white" size={24} />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Operbase</h1>
          </div>

          <div className="mb-8">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
              {step === 'account' ? 'Create your account' : 'Confirm your details'}
            </h2>
            <p className="text-gray-600">
              {step === 'account'
                ? 'Takes a minute. Then you set up your shop.'
                : 'Check your email and password below'}
            </p>
            <div className="mt-4 flex gap-2">
              {steps.map((s, idx) => (
                <div
                  key={s}
                  className={`h-1 flex-1 rounded-full transition-colors ${
                    steps.indexOf(step) >= idx ? 'bg-amber-600' : 'bg-gray-200'
                  }`}
                />
              ))}
            </div>
          </div>

          {step === 'account' && (
            <>
              {/* Google Sign Up */}
              <Button
                type="button"
                variant="outline"
                className="w-full py-3 rounded-lg border border-gray-200 flex items-center justify-center gap-3 mb-6"
                onClick={handleGoogleSignIn}
                disabled={isGoogleLoading}
              >
                {isGoogleLoading ? (
                  <Spinner className="w-4 h-4" />
                ) : (
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                )}
                Continue with Google
              </Button>

              <div className="mb-6 flex items-center gap-3">
                <div className="h-px flex-1 bg-gray-200" />
                <span className="text-sm text-gray-500">or</span>
                <div className="h-px flex-1 bg-gray-200" />
              </div>

              <form onSubmit={handleAccountStep} className="space-y-5">
                <div>
                  <Label htmlFor="email" className="text-sm font-semibold text-gray-900 mb-2 block">
                    Email address
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    required
                    className="px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <Label htmlFor="password" className="text-sm font-semibold text-gray-900 mb-2 block">
                    Password
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={formData.password}
                      onChange={(e) => handleInputChange('password', e.target.value)}
                      required
                      className="px-4 py-3 pr-12 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      tabIndex={-1}
                      aria-label={showPassword ? 'Hide password field' : 'Show password field'}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>

                  {/* Password requirements */}
                  {passwordFilled && (
                    <ul className="mt-3 space-y-1">
                      {PASSWORD_RULES.map((rule) => {
                        const ok = rule.test(formData.password)
                        return (
                          <li key={rule.label} className={`flex items-center gap-2 text-xs ${ok ? 'text-green-600' : 'text-gray-400'}`}>
                            {ok ? <Check size={12} /> : <X size={12} />}
                            {rule.label}
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>

                <div>
                  <Label htmlFor="confirm" className="text-sm font-semibold text-gray-900 mb-2 block">
                    Confirm password
                  </Label>
                  <div className="relative">
                    <Input
                      id="confirm"
                      type={showConfirm ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={formData.confirmPassword}
                      onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                      required
                      className="px-4 py-3 pr-12 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      tabIndex={-1}
                      aria-label={showConfirm ? 'Hide confirm password field' : 'Show confirm password field'}
                    >
                      {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full bg-amber-600 hover:bg-amber-700 text-white py-3 rounded-lg font-semibold flex items-center justify-center gap-2"
                >
                  Next <ArrowRight size={18} />
                </Button>
              </form>
            </>
          )}

          {step === 'confirm' && (
            <form onSubmit={handleSignup} className="space-y-5">
              <div className="bg-gray-50 p-6 rounded-lg space-y-4 border border-gray-200">
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase">Email</p>
                  <p className="text-gray-900 font-medium mt-1">{formData.email}</p>
                </div>
                <div className="pt-4 border-t border-gray-200">
                  <p className="text-xs font-semibold text-gray-500 uppercase">Password</p>
                  <p className="text-gray-900 font-medium mt-1">{'•'.repeat(formData.password.length)}</p>
                </div>
              </div>
              <p className="text-sm text-gray-500">
                You&apos;ll set up your business details after verifying your email.
              </p>

              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 accent-amber-600 cursor-pointer"
                  required
                />
                <span className="text-sm text-gray-600 leading-snug">
                  I have read and agree to the{' '}
                  <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-amber-700 underline hover:text-amber-800">
                    Terms of Service
                  </a>{' '}
                  and{' '}
                  <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-amber-700 underline hover:text-amber-800">
                    Privacy Policy
                  </a>
                </span>
              </label>

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 py-3 rounded-lg border border-gray-200"
                  onClick={() => setStep('account')}
                >
                  <ChevronLeft size={18} className="mr-2" />
                  Back
                </Button>
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 bg-amber-600 hover:bg-amber-700 text-white py-3 rounded-lg font-semibold flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <Spinner className="w-4 h-4" />
                      Creating...
                    </>
                  ) : (
                    <>
                      Create account
                      <ArrowRight size={18} />
                    </>
                  )}
                </Button>
              </div>
            </form>
          )}

          <div className="mt-8 pt-6 border-t border-gray-200 text-center">
            <p className="text-gray-600">
              Already have an account?{' '}
              <Link href="/login" className="text-amber-600 hover:text-amber-700 font-semibold">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>

      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-amber-50 via-orange-50 to-amber-100 flex-col justify-center items-center p-12">
        <div className="max-w-md text-center">
          <div className="inline-block p-4 bg-white rounded-2xl shadow-lg mb-8">
            <Wheat className="text-amber-600" size={48} />
          </div>
          <h3 className="text-3xl font-bold text-gray-900 mb-4">Same app, whether you are solo or a small team</h3>
          <p className="text-gray-600 text-lg leading-relaxed mb-8">
            You will add your business name and currency right after email verification.
          </p>
          <div className="space-y-4">
            {['Ingredients and packaging in one list', 'Log what you produced', 'Sales with profit visible on the dashboard'].map((item) => (
              <div key={item} className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-amber-600 flex items-center justify-center flex-shrink-0 mt-1">
                  <span className="text-white text-xs">✓</span>
                </div>
                <span className="text-gray-700">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}
