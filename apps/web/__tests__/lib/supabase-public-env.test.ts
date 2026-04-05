import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('getSupabasePublicConfig', () => {
  const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const originalKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  beforeEach(() => {
    vi.resetModules()
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  })

  afterEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalKey
  })

  it('uses env when both are set', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'real-key'
    const { getSupabasePublicConfig } = await import('@/lib/supabase/public-env')
    expect(getSupabasePublicConfig()).toEqual({
      url: 'https://example.supabase.co',
      anonKey: 'real-key',
    })
  })

  it('falls back when env is missing', async () => {
    const { getSupabasePublicConfig } = await import('@/lib/supabase/public-env')
    const c = getSupabasePublicConfig()
    expect(c.url).toContain('127.0.0.1')
    expect(c.anonKey.length).toBeGreaterThan(10)
  })
})
