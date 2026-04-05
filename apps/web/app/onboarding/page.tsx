'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { toast } from 'sonner'
import { Wheat, ArrowRight, ChevronLeft, Building2, Palette, Tag, DollarSign } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  clearOnboardingDraft,
  loadOnboardingDraft,
  saveOnboardingDraft,
} from '@/lib/onboarding/draft-storage'

const BUSINESS_TYPES = [
  { value: 'bakery', label: 'Bakery', emoji: '🥖', available: true },
  { value: 'restaurant', label: 'Restaurant', emoji: '🍽️', available: false },
  { value: 'cafe', label: 'Cafe', emoji: '☕', available: false },
  { value: 'catering', label: 'Catering', emoji: '🎂', available: false },
  { value: 'food_production', label: 'Food Production', emoji: '🏭', available: false },
  { value: 'other', label: 'Other', emoji: '🏪', available: false },
]

const BRAND_COLORS = [
  '#d97706', '#dc2626', '#7c3aed', '#2563eb',
  '#059669', '#db2777', '#ea580c', '#0284c7',
]

const CURRENCIES = [
  { code: 'USD', label: 'USD — US Dollar' },
  { code: 'EUR', label: 'EUR — Euro' },
  { code: 'GBP', label: 'GBP — British Pound' },
  { code: 'NGN', label: 'NGN — Nigerian Naira' },
  { code: 'GHS', label: 'GHS — Ghanaian Cedi' },
  { code: 'KES', label: 'KES — Kenyan Shilling' },
  { code: 'ZAR', label: 'ZAR — South African Rand' },
  { code: 'CAD', label: 'CAD — Canadian Dollar' },
  { code: 'AUD', label: 'AUD — Australian Dollar' },
  { code: 'INR', label: 'INR — Indian Rupee' },
  { code: 'BRL', label: 'BRL — Brazilian Real' },
  { code: 'MXN', label: 'MXN — Mexican Peso' },
]

type Step = 'business' | 'branding' | 'type'

export default function OnboardingPage() {
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [hydrated, setHydrated] = useState(false)
  const [step, setStep] = useState<Step>('business')
  const [isLoading, setIsLoading] = useState(false)
  const [form, setForm] = useState({
    businessName: '',
    logoUrl: '',
    brandColor: '#d97706',
    businessType: 'bakery',
    currency: 'USD',
  })
  const persistDraftRef = useRef(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (cancelled) return
      if (!user) {
        setHydrated(true)
        return
      }
      setUserId(user.id)
      const draft = loadOnboardingDraft(user.id)
      if (draft) {
        setStep(draft.step)
        setForm((prev) => ({ ...prev, ...draft.form }))
        toast.message('Picked up where you left off', {
          description: 'Progress is saved on this device.',
        })
      }
      setHydrated(true)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!hydrated || !userId || !persistDraftRef.current) return
    const t = window.setTimeout(() => {
      if (persistDraftRef.current) {
        saveOnboardingDraft(userId, { step, form })
      }
    }, 400)
    return () => window.clearTimeout(t)
  }, [hydrated, userId, step, form])

  const steps: Step[] = ['business', 'branding', 'type']
  const stepIndex = steps.indexOf(step)

  function handleStartOver() {
    if (userId) clearOnboardingDraft(userId)
    setStep('business')
    setForm({
      businessName: '',
      logoUrl: '',
      brandColor: '#d97706',
      businessType: 'bakery',
      currency: 'USD',
    })
    toast.success('Started fresh')
  }

  async function handleFinish() {
    if (!form.businessName.trim()) {
      toast.error('Business name is required')
      return
    }

    setIsLoading(true)
    const supabase = createClient()

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Generate subdomain from business name
      const subdomain = form.businessName
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        + '-' + Math.random().toString(36).slice(2, 6)

      // Single transactional RPC — both inserts succeed or both roll back.
      // No orphaned business rows if the user_businesses insert would fail.
      const { error: rpcError } = await supabase.rpc('create_business_with_owner', {
        p_name: form.businessName,
        p_subdomain: subdomain,
        p_logo_url: form.logoUrl || null,
        p_brand_color: form.brandColor,
        p_business_type: form.businessType,
        p_currency: form.currency,
      })

      if (rpcError) {
        // If user already has a business, just send them to the dashboard
        if (rpcError.message?.includes('already has a business')) {
          persistDraftRef.current = false
          clearOnboardingDraft(user.id)
          router.push('/dashboard')
          return
        }
        // Surface the actual Postgres error (PostgrestError has .message but is not instanceof Error)
        throw new Error(rpcError.message ?? 'Failed to create business')
      }

      persistDraftRef.current = false
      clearOnboardingDraft(user.id)
      toast.success('Business created! Welcome to Operbase.')
      router.push('/dashboard')
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create business')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-amber-100 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-8">
        {/* Header */}
        <div className="flex items-center gap-2 mb-8">
          <div className="w-10 h-10 bg-amber-600 rounded-lg flex items-center justify-center">
            <Wheat className="text-white" size={24} />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Operbase</h1>
        </div>

        {/* Progress */}
        <div className="flex gap-2 mb-8">
          {steps.map((s, idx) => (
            <div
              key={s}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                stepIndex >= idx ? 'bg-amber-600' : 'bg-gray-200'
              }`}
            />
          ))}
        </div>

        {/* Step: Business */}
        {step === 'business' && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                <Building2 className="text-amber-600" size={20} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Create your business</h2>
                <p className="text-sm text-gray-500">What&apos;s your business called?</p>
              </div>
            </div>
            <div>
              <Label htmlFor="businessName" className="text-sm font-semibold text-gray-900 mb-2 block">
                Business name
              </Label>
              <Input
                id="businessName"
                type="text"
                placeholder="e.g., Sweet Delights Bakery"
                value={form.businessName}
                onChange={(e) => setForm({ ...form, businessName: e.target.value })}
                className="px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                autoFocus
              />
            </div>
            <Button
              onClick={() => {
                if (!form.businessName.trim()) {
                  toast.error('Please enter your business name')
                  return
                }
                setStep('branding')
              }}
              className="w-full bg-amber-600 hover:bg-amber-700 text-white py-3 rounded-lg font-semibold flex items-center justify-center gap-2"
            >
              Next <ArrowRight size={18} />
            </Button>
          </div>
        )}

        {/* Step: Branding */}
        {step === 'branding' && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                <Palette className="text-amber-600" size={20} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Brand your business</h2>
                <p className="text-sm text-gray-500">Choose your colors and logo</p>
              </div>
            </div>

            <div>
              <Label className="text-sm font-semibold text-gray-900 mb-3 block">Brand color</Label>
              <div className="flex flex-wrap gap-3">
                {BRAND_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setForm({ ...form, brandColor: color })}
                    className={`w-10 h-10 rounded-full border-4 transition-transform ${
                      form.brandColor === color
                        ? 'border-gray-800 scale-110'
                        : 'border-transparent hover:scale-105'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              <div className="mt-3 flex items-center gap-2">
                <Input
                  type="color"
                  value={form.brandColor}
                  onChange={(e) => setForm({ ...form, brandColor: e.target.value })}
                  className="w-10 h-10 p-1 border border-gray-200 rounded cursor-pointer"
                />
                <span className="text-sm text-gray-500">Custom color</span>
              </div>
            </div>

            <div>
              <Label htmlFor="logoUrl" className="text-sm font-semibold text-gray-900 mb-2 block">
                Logo URL <span className="text-gray-400 font-normal">(optional)</span>
              </Label>
              <Input
                id="logoUrl"
                type="url"
                placeholder="https://example.com/logo.png"
                value={form.logoUrl}
                onChange={(e) => setForm({ ...form, logoUrl: e.target.value })}
                className="px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              />
            </div>

            <div>
              <Label htmlFor="currency" className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <DollarSign size={14} className="text-gray-400" />
                Currency
              </Label>
              <select
                id="currency"
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value })}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-white text-gray-900 text-sm"
              >
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>{c.label}</option>
                ))}
              </select>
              <p className="text-xs text-gray-400 mt-1">Used for all prices and reports across your business</p>
            </div>

            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                className="flex-1 py-3 rounded-lg border border-gray-200"
                onClick={() => setStep('business')}
              >
                <ChevronLeft size={18} className="mr-1" /> Back
              </Button>
              <Button
                onClick={() => setStep('type')}
                className="flex-1 bg-amber-600 hover:bg-amber-700 text-white py-3 rounded-lg font-semibold flex items-center justify-center gap-2"
              >
                Next <ArrowRight size={18} />
              </Button>
            </div>
          </div>
        )}

        {/* Step: Business Type */}
        {step === 'type' && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                <Tag className="text-amber-600" size={20} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">What type of business?</h2>
                <p className="text-sm text-gray-500">This helps us tailor your experience</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {BUSINESS_TYPES.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  disabled={!type.available}
                  onClick={() => type.available && setForm({ ...form, businessType: type.value })}
                  className={`p-4 rounded-xl border-2 text-left transition-all relative ${
                    !type.available
                      ? 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
                      : form.businessType === type.value
                      ? 'border-amber-600 bg-amber-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <span className="text-2xl block mb-1">{type.emoji}</span>
                  <span className="text-sm font-medium text-gray-900">{type.label}</span>
                  {!type.available && (
                    <span className="text-xs text-gray-400 block mt-0.5">Coming soon</span>
                  )}
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                className="flex-1 py-3 rounded-lg border border-gray-200"
                onClick={() => setStep('branding')}
              >
                <ChevronLeft size={18} className="mr-1" /> Back
              </Button>
              <Button
                onClick={handleFinish}
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
                    Get started <ArrowRight size={18} />
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        <p className="mt-8 text-center">
          <button
            type="button"
            onClick={handleStartOver}
            className="text-sm text-gray-400 hover:text-gray-600 underline-offset-2 hover:underline"
          >
            Start over and clear saved progress
          </button>
        </p>
      </div>
    </main>
  )
}
