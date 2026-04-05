import { vi } from 'vitest'

/**
 * Returns a chainable Supabase query builder mock.
 * Every method returns `this` so you can chain .select().eq().single() etc.
 * Override the terminal methods (single, maybeSingle, then) per test with:
 *   mockFrom.mockReturnValueOnce({ data: [...], error: null })
 */
export function createQueryBuilder(resolved: { data?: unknown; error?: null | object } = {}) {
  const defaults = { data: null, error: null, ...resolved }

  const builder: any = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(defaults),
    single: vi.fn().mockResolvedValue(defaults),
    // Awaiting the builder itself
    then: (resolve: (v: typeof defaults) => void) => Promise.resolve(defaults).then(resolve),
  }

  return builder
}

/**
 * Shared mock Supabase client.
 * Reset between tests with `resetSupabaseMocks()`.
 */
export const mockSupabaseClient = {
  auth: {
    getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
    signInWithPassword: vi.fn().mockResolvedValue({ data: {}, error: null }),
    signUp: vi.fn().mockResolvedValue({ data: {}, error: null }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    signInWithOAuth: vi.fn().mockResolvedValue({ data: {}, error: null }),
    getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    exchangeCodeForSession: vi.fn().mockResolvedValue({ data: {}, error: null }),
  },
  from: vi.fn(() => createQueryBuilder()),
  rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
}

export function resetSupabaseMocks() {
  vi.clearAllMocks()

  mockSupabaseClient.auth.getUser.mockResolvedValue({ data: { user: null }, error: null })
  mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({ data: {}, error: null })
  mockSupabaseClient.auth.signUp.mockResolvedValue({ data: {}, error: null })
  mockSupabaseClient.auth.signOut.mockResolvedValue({ error: null })
  mockSupabaseClient.auth.signInWithOAuth.mockResolvedValue({ data: {}, error: null })
  mockSupabaseClient.from.mockImplementation(() => createQueryBuilder())
  mockSupabaseClient.rpc.mockResolvedValue({ data: null, error: null })
}

/** Mock a user as logged in */
export function mockAuthUser(user: { id: string; email: string }) {
  mockSupabaseClient.auth.getUser.mockResolvedValue({ data: { user }, error: null })
}

/** Mock a business linked to the current user */
export function mockUserBusiness(businessId: string, businessName = 'Test Bakery') {
  mockSupabaseClient.from.mockImplementation((table: string) => {
    if (table === 'user_businesses') {
      return createQueryBuilder({
        data: { business_id: businessId, businesses: { name: businessName } },
      })
    }
    return createQueryBuilder()
  })
}
