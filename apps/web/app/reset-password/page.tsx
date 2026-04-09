'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { toast } from 'sonner'
import { Wheat, Eye, EyeOff, Check, X } from 'lucide-react'
import { updatePassword } from '@/lib/auth'

const PASSWORD_RULES = [
  { label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
  { label: 'One uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'One number', test: (p: string) => /[0-9]/.test(p) },
  { label: 'One special character', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
]

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const failed = PASSWORD_RULES.filter((r) => !r.test(password))
    if (failed.length > 0) {
      toast.error(`Password must have: ${failed.map((r) => r.label.toLowerCase()).join(', ')}`)
      return
    }
    if (password !== confirm) {
      toast.error('Passwords do not match')
      return
    }

    setIsLoading(true)
    try {
      await updatePassword(password)
      toast.success('Password updated. You are signed in.')
      router.push('/dashboard')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update password. The link may have expired.')
    } finally {
      setIsLoading(false)
    }
  }

  const passwordFilled = password.length > 0

  return (
    <main className="min-h-screen flex" style={{ backgroundColor: '#fdfcfa' }}>
      <div className="w-full lg:w-1/2 flex flex-col justify-center px-6 md:px-12 py-12">
        <div className="max-w-md mx-auto w-full">
          <div className="flex items-center gap-2.5 mb-12">
            <div className="w-10 h-10 bg-amber-600 rounded-xl flex items-center justify-center shadow-sm">
              <Wheat className="text-white" size={22} />
            </div>
            <span className="text-xl font-bold text-gray-900">Operbase</span>
          </div>

          <div className="mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-2 tracking-tight">Set a new password</h2>
            <p className="text-gray-500">Choose something you will remember.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <Label htmlFor="password" className="text-sm font-semibold text-gray-900 mb-2 block">
                New password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoFocus
                  className="px-4 py-3 pr-12 border border-gray-200 rounded-xl bg-white shadow-sm focus-visible:ring-amber-500/40"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {passwordFilled && (
                <ul className="mt-3 space-y-1">
                  {PASSWORD_RULES.map((rule) => {
                    const ok = rule.test(password)
                    return (
                      <li
                        key={rule.label}
                        className={`flex items-center gap-2 text-xs ${ok ? 'text-green-600' : 'text-gray-400'}`}
                      >
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
                Confirm new password
              </Label>
              <div className="relative">
                <Input
                  id="confirm"
                  type={showConfirm ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  className="px-4 py-3 pr-12 border border-gray-200 rounded-xl bg-white shadow-sm focus-visible:ring-amber-500/40"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  tabIndex={-1}
                  aria-label={showConfirm ? 'Hide password' : 'Show password'}
                >
                  {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-amber-600 hover:bg-amber-700 text-white py-3 rounded-xl font-semibold shadow-sm hover:shadow-md transition-all min-h-[48px]"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <Spinner className="w-4 h-4" /> Updating…
                </span>
              ) : (
                'Update password'
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <Link href="/login" className="text-sm text-gray-500 hover:text-gray-700">
              Back to sign in
            </Link>
          </div>
        </div>
      </div>

      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-amber-50 via-orange-50/80 to-amber-100 flex-col justify-center items-center p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: 'radial-gradient(circle at 30% 70%, rgba(245,158,11,0.15) 0%, transparent 60%), radial-gradient(circle at 80% 20%, rgba(234,88,12,0.1) 0%, transparent 50%)',
          }}
        />
        <div className="max-w-sm text-center relative z-10">
          <div className="inline-flex p-5 bg-white rounded-3xl shadow-xl mb-8">
            <Wheat className="text-amber-600" size={44} />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-3 tracking-tight">Almost done</h3>
          <p className="text-gray-600 leading-relaxed">
            Set your new password and you will be taken straight to your dashboard.
          </p>
        </div>
      </div>
    </main>
  )
}
