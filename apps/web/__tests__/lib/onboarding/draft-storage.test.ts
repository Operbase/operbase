import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import {
  clearOnboardingDraft,
  loadOnboardingDraft,
  onboardingDraftStorageKey,
  saveOnboardingDraft,
} from '@/lib/onboarding/draft-storage'
import { installMemoryLocalStorage } from '@/__tests__/helpers/memory-local-storage'

const USER = 'user-abc'

describe('onboarding draft-storage', () => {
  beforeEach(() => {
    installMemoryLocalStorage()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns null when empty', () => {
    expect(loadOnboardingDraft(USER)).toBeNull()
  })

  it('round-trips step and form', () => {
    saveOnboardingDraft(USER, {
      step: 'type',
      form: {
        businessName: 'Test Co',
        logoUrl: 'https://x/logo.png',
        brandColor: '#112233',
        businessType: 'bakery',
        currency: 'NGN',
      },
    })
    const loaded = loadOnboardingDraft(USER)
    expect(loaded).toEqual({
      step: 'type',
      form: {
        businessName: 'Test Co',
        logoUrl: 'https://x/logo.png',
        brandColor: '#112233',
        businessType: 'bakery',
        currency: 'NGN',
      },
    })
  })

  it('drops invalid step to business', () => {
    localStorage.setItem(
      onboardingDraftStorageKey(USER),
      JSON.stringify({
        v: 1,
        savedAt: Date.now(),
        step: 'nope',
        form: {},
      })
    )
    expect(loadOnboardingDraft(USER)?.step).toBe('business')
  })

  it('removes stale drafts older than 90 days', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-01T00:00:00Z'))
    const old = Date.now() - 91 * 24 * 60 * 60 * 1000
    localStorage.setItem(
      onboardingDraftStorageKey(USER),
      JSON.stringify({
        v: 1,
        savedAt: old,
        step: 'branding',
        form: { businessName: 'Old' },
      })
    )
    expect(loadOnboardingDraft(USER)).toBeNull()
    expect(localStorage.getItem(onboardingDraftStorageKey(USER))).toBeNull()
  })

  it('clearOnboardingDraft removes key', () => {
    saveOnboardingDraft(USER, {
      step: 'business',
      form: {
        businessName: 'x',
        logoUrl: '',
        brandColor: '#d97706',
        businessType: 'bakery',
        currency: 'USD',
      },
    })
    clearOnboardingDraft(USER)
    expect(loadOnboardingDraft(USER)).toBeNull()
  })
})
