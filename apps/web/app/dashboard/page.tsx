import { redirect } from 'next/navigation'
import { getCachedDashboardContext } from '@/lib/dashboard/cached-dashboard-context'
import { loadDashboardHomeData } from '@/lib/dashboard/load-home-data'
import { DashboardHomeClient } from './dashboard-home-client'

export default async function DashboardPage() {
  const ctx = await getCachedDashboardContext()

  if (!ctx.user) {
    redirect('/login')
  }

  if (!ctx.business) {
    redirect('/onboarding')
  }

  const home = await loadDashboardHomeData(
    ctx.supabase,
    ctx.business.businessId,
    ctx.business.timezone
  )

  return (
    <DashboardHomeClient
      todayMetrics={home.todayMetrics}
      metricsLifetime={home.metricsLifetime}
      atRisk={home.atRisk}
      dailyTotals={home.dailyTotals}
      monthlySpend={home.monthlySpend}
      alerts={home.alerts}
      loadError={home.error}
      userName={ctx.user.displayName}
    />
  )
}
