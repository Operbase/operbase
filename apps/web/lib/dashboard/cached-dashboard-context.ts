import { cache } from 'react'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

export type DashboardUserSnapshot = {
  id: string
  email: string | undefined
  displayName: string
}

export type DashboardBusinessSnapshot = {
  businessId: string
  businessName: string
  brandColor: string
  logoUrl: string | null
  currency: string
}

function displayNameFromUser(user: User): string {
  const meta = user.user_metadata as { full_name?: string } | undefined
  const email = user.email ?? ''
  return meta?.full_name?.trim() || (email ? email.split('@')[0] : '') || 'User'
}

/**
 * Per-request cached auth + primary business for /dashboard/*.
 * Call from the dashboard layout and any dashboard Server Component in the same
 * request to avoid duplicate user_businesses queries.
 */
export const getCachedDashboardContext = cache(async () => {
  const supabase = await createClient()
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser()

  if (authErr || !user) {
    return { user: null, business: null, supabase }
  }

  const { data, error } = await supabase
    .from('user_businesses')
    .select('business_id, businesses(name, brand_color, logo_url, business_settings(currency))')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  if (error || !data?.business_id) {
    return {
      user: {
        id: user.id,
        email: user.email ?? undefined,
        displayName: displayNameFromUser(user),
      },
      business: null,
      supabase,
    }
  }

  const biz = data.businesses as {
    name?: string
    brand_color?: string | null
    logo_url?: string | null
    business_settings?: { currency?: string } | null
  } | null

  return {
    user: {
      id: user.id,
      email: user.email ?? undefined,
      displayName: displayNameFromUser(user),
    },
    business: {
      businessId: data.business_id,
      businessName: biz?.name ?? 'Business',
      brandColor: biz?.brand_color ?? '#d97706',
      logoUrl: biz?.logo_url ?? null,
      currency: biz?.business_settings?.currency ?? 'USD',
    } satisfies DashboardBusinessSnapshot,
    supabase,
  }
})
