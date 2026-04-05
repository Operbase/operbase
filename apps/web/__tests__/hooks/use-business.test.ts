import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { mockSupabaseClient, resetSupabaseMocks, createQueryBuilder } from '../helpers/supabase-mock'

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => mockSupabaseClient,
}))

import { useBusiness } from '@/hooks/use-business'

const TEST_USER = { id: 'user-123', email: 'owner@example.com' }

function mockBusiness(overrides: {
  business_id?: string
  name?: string
  brand_color?: string
  logo_url?: string | null
  currency?: string
} = {}) {
  const {
    business_id = 'biz-456',
    name = 'Flour Power Bakery',
    brand_color = '#d97706',
    logo_url = null,
    currency = 'USD',
  } = overrides

  mockSupabaseClient.auth.getUser.mockResolvedValue({
    data: { user: TEST_USER },
    error: null,
  })

  mockSupabaseClient.from.mockImplementation((table: string) => {
    if (table === 'user_businesses') {
      return {
        ...createQueryBuilder(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            business_id,
            businesses: {
              name,
              brand_color,
              logo_url,
              business_settings: { currency },
            },
          },
          error: null,
        }),
      }
    }
    return createQueryBuilder()
  })
}

beforeEach(() => {
  resetSupabaseMocks()
})

describe('useBusiness()', () => {
  it('returns loading=true initially', () => {
    mockSupabaseClient.auth.getUser.mockReturnValue(new Promise(() => {}))

    const { result } = renderHook(() => useBusiness(null))

    expect(result.current.loading).toBe(true)
    expect(result.current.businessId).toBeNull()
    expect(result.current.businessName).toBeNull()
  })

  it('returns null businessId when user is not authenticated', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    })

    const { result } = renderHook(() => useBusiness(null))

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.businessId).toBeNull()
    expect(result.current.businessName).toBeNull()
  })

  it('returns businessId and businessName when user has a business', async () => {
    mockBusiness()
    const { result } = renderHook(() => useBusiness(null))

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.businessId).toBe('biz-456')
    expect(result.current.businessName).toBe('Flour Power Bakery')
  })

  it('returns brandColor from businesses table', async () => {
    mockBusiness({ brand_color: '#e11d48' })
    const { result } = renderHook(() => useBusiness(null))

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.brandColor).toBe('#e11d48')
  })

  it('defaults brandColor to #d97706 when not set', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: TEST_USER },
      error: null,
    })
    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === 'user_businesses') {
        return {
          ...createQueryBuilder(),
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              business_id: 'biz-456',
              businesses: { name: 'Test Biz', brand_color: null, logo_url: null, business_settings: null },
            },
            error: null,
          }),
        }
      }
      return createQueryBuilder()
    })

    const { result } = renderHook(() => useBusiness(null))

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.brandColor).toBe('#d97706')
  })

  it('returns logoUrl when set', async () => {
    mockBusiness({ logo_url: 'https://cdn.example.com/logo.png' })
    const { result } = renderHook(() => useBusiness(null))

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.logoUrl).toBe('https://cdn.example.com/logo.png')
  })

  it('returns null logoUrl when not set', async () => {
    mockBusiness({ logo_url: null })
    const { result } = renderHook(() => useBusiness(null))

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.logoUrl).toBeNull()
  })

  it('returns currency from business_settings', async () => {
    mockBusiness({ currency: 'NGN' })
    const { result } = renderHook(() => useBusiness(null))

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.currency).toBe('NGN')
  })

  it('defaults currency to USD when business_settings is null', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: TEST_USER },
      error: null,
    })
    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === 'user_businesses') {
        return {
          ...createQueryBuilder(),
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              business_id: 'biz-456',
              businesses: { name: 'Test', brand_color: null, logo_url: null, business_settings: null },
            },
            error: null,
          }),
        }
      }
      return createQueryBuilder()
    })

    const { result } = renderHook(() => useBusiness(null))

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.currency).toBe('USD')
  })

  it('returns null businessId when user has no business (needs onboarding)', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: TEST_USER },
      error: null,
    })
    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === 'user_businesses') {
        return {
          ...createQueryBuilder({ data: null }),
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }
      }
      return createQueryBuilder()
    })

    const { result } = renderHook(() => useBusiness(null))

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.businessId).toBeNull()
    expect(result.current.businessName).toBeNull()
  })

  it('queries user_businesses with the authenticated user id', async () => {
    const eqMock = vi.fn().mockReturnThis()
    const maybeSingleMock = vi.fn().mockResolvedValue({ data: null, error: null })

    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: TEST_USER },
      error: null,
    })
    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === 'user_businesses') {
        return { ...createQueryBuilder(), select: vi.fn().mockReturnThis(), eq: eqMock, maybeSingle: maybeSingleMock }
      }
      return createQueryBuilder()
    })

    const { result } = renderHook(() => useBusiness(null))

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(eqMock).toHaveBeenCalledWith('user_id', TEST_USER.id)
  })

  it('does not query user_businesses on mount when SSR initial business is provided', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: TEST_USER },
      error: null,
    })
    const initial = {
      businessId: 'biz-ssr',
      businessName: 'SSR Bakery',
      brandColor: '#111111',
      logoUrl: null,
      currency: 'EUR',
    }
    const { result } = renderHook(() => useBusiness(initial))

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.businessId).toBe('biz-ssr')
    expect(result.current.currency).toBe('EUR')
    expect(mockSupabaseClient.from).not.toHaveBeenCalled()
  })
})
