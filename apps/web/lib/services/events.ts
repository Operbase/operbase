/**
 * Event Tracking Service
 *
 * Tracks user actions for analytics and future AI insights (Phase 6).
 * Writes to `analytics_events` table — append-only, never update/delete.
 *
 * Usage:
 *   import { trackEvent } from '@/lib/services/events'
 *   await trackEvent('item_created', businessId, { item_id: id, item_type: 'ingredient' })
 *
 * Fails silently — tracking must never block the main operation.
 */

import { createClient } from '@/lib/supabase/client'

export type EventType =
  | 'item_created'
  | 'stock_updated'
  | 'batch_created'
  | 'batch_deleted'
  | 'sale_recorded'
  | 'sale_deleted'
  | 'dashboard_viewed'

export async function trackEvent(
  actionType: EventType,
  businessId: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase.from('analytics_events').insert({
      business_id: businessId,
      user_id: user.id,
      action_type: actionType,
      metadata: metadata ?? null,
    })
  } catch {
    // Tracking must never throw — log silently in dev
    if (process.env.NODE_ENV === 'development') {
      console.warn('[trackEvent] silently failed for', actionType)
    }
  }
}
