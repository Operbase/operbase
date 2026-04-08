'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { DashboardBusinessSnapshot } from '@/lib/dashboard/cached-dashboard-context'
import { resolveBusinessTimeZone } from '@/lib/business-time'

export interface BusinessInfo {
  businessId: string | null
  businessName: string | null
  brandColor: string
  logoUrl: string | null
  currency: string
  timezone: string
  loading: boolean
  error: string | null
  refetch: () => void
}

type UserBusinessRow = {
  business_id: string
  businesses: {
    name?: string
    brand_color?: string | null
    logo_url?: string | null
    business_settings?: { currency?: string; timezone?: string } | null
  } | null
}

function applyBusinessRow(
  setters: {
    setBusinessId: (v: string | null) => void
    setBusinessName: (v: string | null) => void
    setBrandColor: (v: string) => void
    setLogoUrl: (v: string | null) => void
    setCurrency: (v: string) => void
    setTimezone: (v: string) => void
  },
  data: UserBusinessRow | null
) {
  const biz = data?.businesses
  setters.setBusinessId(data?.business_id ?? null)
  setters.setBusinessName(biz?.name ?? null)
  setters.setBrandColor(biz?.brand_color ?? '#d97706')
  setters.setLogoUrl(biz?.logo_url ?? null)
  setters.setCurrency(biz?.business_settings?.currency ?? 'USD')
  setters.setTimezone(resolveBusinessTimeZone(biz?.business_settings?.timezone))
}

/**
 * @param initialBusiness — When set (dashboard layout SSR), skips the initial client fetch.
 */
export function useBusiness(initialBusiness: DashboardBusinessSnapshot | null): BusinessInfo {
  const [businessId, setBusinessId] = useState<string | null>(
    () => initialBusiness?.businessId ?? null
  )
  const [businessName, setBusinessName] = useState<string | null>(
    () => initialBusiness?.businessName ?? null
  )
  const [brandColor, setBrandColor] = useState(() => initialBusiness?.brandColor ?? '#d97706')
  const [logoUrl, setLogoUrl] = useState<string | null>(() => initialBusiness?.logoUrl ?? null)
  const [currency, setCurrency] = useState(() => initialBusiness?.currency ?? 'USD')
  const [timezone, setTimezone] = useState(() =>
    resolveBusinessTimeZone(initialBusiness?.timezone)
  )
  const [loading, setLoading] = useState(() => !initialBusiness?.businessId)
  const [error, setError] = useState<string | null>(null)

  const fetchBusiness = useCallback(async () => {
    const supabase = createClient()

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()
      if (authError) throw authError
      if (!user) {
        setLoading(false)
        return
      }

      const { data, error: bizError } = await supabase
        .from('user_businesses')
        .select(
          'business_id, businesses(name, brand_color, logo_url, business_settings(currency, timezone))'
        )
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle()

      if (bizError) throw bizError

      applyBusinessRow(
        {
          setBusinessId,
          setBusinessName,
          setBrandColor,
          setLogoUrl,
          setCurrency,
          setTimezone,
        },
        data as UserBusinessRow | null
      )
      setError(null)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load business info'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [])

  const refetch = useCallback(() => {
    setLoading(true)
    setError(null)
    void fetchBusiness()
  }, [fetchBusiness])

  useEffect(() => {
    if (initialBusiness?.businessId) {
      return
    }
    void fetchBusiness()
  }, [fetchBusiness, initialBusiness?.businessId])

  useEffect(() => {
    if (!initialBusiness?.businessId) return
    setBusinessId(initialBusiness.businessId)
    setBusinessName(initialBusiness.businessName)
    setBrandColor(initialBusiness.brandColor)
    setLogoUrl(initialBusiness.logoUrl)
    setCurrency(initialBusiness.currency)
    setTimezone(resolveBusinessTimeZone(initialBusiness.timezone))
  }, [
    initialBusiness?.businessId,
    initialBusiness?.businessName,
    initialBusiness?.brandColor,
    initialBusiness?.logoUrl,
    initialBusiness?.currency,
    initialBusiness?.timezone,
  ])

  return {
    businessId,
    businessName,
    brandColor,
    logoUrl,
    currency,
    timezone,
    loading,
    error,
    refetch,
  }
}
