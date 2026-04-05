'use client'

import { createContext, useContext } from 'react'
import { useBusiness, type BusinessInfo } from '@/hooks/use-business'
import type { DashboardBusinessSnapshot } from '@/lib/dashboard/cached-dashboard-context'

const BusinessContext = createContext<BusinessInfo | null>(null)

export function BusinessProvider({
  children,
  initialBusiness,
}: {
  children: React.ReactNode
  initialBusiness: DashboardBusinessSnapshot | null
}) {
  const businessInfo = useBusiness(initialBusiness)

  return <BusinessContext.Provider value={businessInfo}>{children}</BusinessContext.Provider>
}

export function useBusinessContext(): BusinessInfo {
  const ctx = useContext(BusinessContext)
  if (!ctx) {
    throw new Error('useBusinessContext must be used within a BusinessProvider')
  }
  return ctx
}
