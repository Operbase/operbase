import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockSupabaseClient, resetSupabaseMocks, createQueryBuilder } from '../../helpers/supabase-mock'

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => mockSupabaseClient,
}))

import { trackEvent } from '@/lib/services/events'

const TEST_USER = { id: 'user-abc', email: 'owner@example.com' }
const BIZ_ID = 'biz-123'

beforeEach(() => {
  resetSupabaseMocks()
})

describe('trackEvent()', () => {
  it('inserts an event row with the correct fields', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: TEST_USER },
      error: null,
    })

    const insertBuilder = createQueryBuilder({ data: null, error: null })
    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === 'analytics_events') return insertBuilder
      return createQueryBuilder()
    })

    await trackEvent('item_created', BIZ_ID, { item_type: 'ingredient' })

    expect(mockSupabaseClient.from).toHaveBeenCalledWith('analytics_events')
    expect(insertBuilder.insert).toHaveBeenCalledWith({
      business_id: BIZ_ID,
      user_id: TEST_USER.id,
      action_type: 'item_created',
      metadata: { item_type: 'ingredient' },
    })
  })

  it('does nothing when no authenticated user', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: null,
    })

    await trackEvent('dashboard_viewed', BIZ_ID)

    // Should not attempt to insert
    expect(mockSupabaseClient.from).not.toHaveBeenCalled()
  })

  it('passes null metadata when no metadata provided', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: TEST_USER },
      error: null,
    })

    const insertBuilder = createQueryBuilder({ data: null, error: null })
    mockSupabaseClient.from.mockImplementation(() => insertBuilder)

    await trackEvent('sale_recorded', BIZ_ID)

    expect(insertBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: null })
    )
  })

  it('does not throw when the insert fails', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: TEST_USER },
      error: null,
    })

    // Simulate a hard error on the insert
    mockSupabaseClient.from.mockImplementation(() => {
      throw new Error('DB connection failed')
    })

    // Must resolve without throwing
    await expect(trackEvent('batch_created', BIZ_ID)).resolves.toBeUndefined()
  })

  it('does not throw when getUser itself fails', async () => {
    mockSupabaseClient.auth.getUser.mockRejectedValueOnce(new Error('Auth unavailable'))

    await expect(trackEvent('stock_updated', BIZ_ID)).resolves.toBeUndefined()
  })

  it('accepts all known EventType values', async () => {
    const eventTypes = [
      'item_created',
      'stock_updated',
      'batch_created',
      'batch_deleted',
      'sale_recorded',
      'sale_deleted',
      'dashboard_viewed',
    ] as const

    for (const eventType of eventTypes) {
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: TEST_USER },
        error: null,
      })
      mockSupabaseClient.from.mockImplementation(() => createQueryBuilder())

      await expect(trackEvent(eventType, BIZ_ID)).resolves.toBeUndefined()
    }
  })
})
