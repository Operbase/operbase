export type OnboardingStep = 'business' | 'branding' | 'type'

export type OnboardingFormDraft = {
  businessName: string
  logoUrl: string
  brandColor: string
  businessType: string
  currency: string
}

const STORAGE_VERSION = 1 as const
const MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000

const STEPS: OnboardingStep[] = ['business', 'branding', 'type']

const DEFAULT_FORM: OnboardingFormDraft = {
  businessName: '',
  logoUrl: '',
  brandColor: '#d97706',
  businessType: 'bakery',
  currency: 'USD',
}

export function onboardingDraftStorageKey(userId: string): string {
  return `operbase.onboardingDraft.v${STORAGE_VERSION}:${userId}`
}

function clampString(s: unknown, max: number): string {
  if (typeof s !== 'string') return ''
  return s.slice(0, max)
}

function parseStep(raw: unknown): OnboardingStep {
  if (typeof raw === 'string' && (STEPS as string[]).includes(raw)) {
    return raw as OnboardingStep
  }
  return 'business'
}

export function loadOnboardingDraft(
  userId: string
): { step: OnboardingStep; form: OnboardingFormDraft } | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(onboardingDraftStorageKey(userId))
    if (!raw) return null
    const o = JSON.parse(raw) as {
      v?: number
      savedAt?: number
      step?: unknown
      form?: Partial<OnboardingFormDraft>
    }
    if (o.v !== STORAGE_VERSION || typeof o.savedAt !== 'number') return null
    if (Date.now() - o.savedAt > MAX_AGE_MS) {
      window.localStorage.removeItem(onboardingDraftStorageKey(userId))
      return null
    }
    const step = parseStep(o.step)
    const form: OnboardingFormDraft = {
      businessName: clampString(o.form?.businessName, 200),
      logoUrl: clampString(o.form?.logoUrl, 2000),
      brandColor: clampString(o.form?.brandColor, 32) || DEFAULT_FORM.brandColor,
      businessType: clampString(o.form?.businessType, 64) || DEFAULT_FORM.businessType,
      currency: clampString(o.form?.currency, 16) || DEFAULT_FORM.currency,
    }
    return { step, form }
  } catch {
    return null
  }
}

export function saveOnboardingDraft(
  userId: string,
  payload: { step: OnboardingStep; form: OnboardingFormDraft }
): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(
      onboardingDraftStorageKey(userId),
      JSON.stringify({
        v: STORAGE_VERSION,
        savedAt: Date.now(),
        step: payload.step,
        form: payload.form,
      })
    )
  } catch {
    // Quota or private mode — ignore
  }
}

export function clearOnboardingDraft(userId: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(onboardingDraftStorageKey(userId))
  } catch {
    // ignore
  }
}
