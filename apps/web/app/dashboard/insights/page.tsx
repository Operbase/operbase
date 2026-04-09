import { redirect } from 'next/navigation'
import { getCachedDashboardContext } from '@/lib/dashboard/cached-dashboard-context'
import { loadInsightsData } from '@/lib/dashboard/insights-data'
import { InsightsPageClient } from './insights-page-client'

export default async function InsightsPage() {
  const ctx = await getCachedDashboardContext()

  if (!ctx.user) redirect('/login')
  if (!ctx.business) redirect('/onboarding')

  const data = await loadInsightsData(
    ctx.supabase,
    ctx.business.businessId,
    ctx.business.timezone,
    'this_month',
    ctx.business.currency
  )

  return (
    <InsightsPageClient
      initialData={data}
      businessId={ctx.business.businessId}
      timezone={ctx.business.timezone}
      currency={ctx.business.currency}
    />
  )
}
