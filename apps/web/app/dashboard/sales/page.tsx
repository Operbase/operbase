import { redirect } from 'next/navigation'
import { getCachedDashboardContext } from '@/lib/dashboard/cached-dashboard-context'
import { loadSalesInitial } from '@/lib/dashboard/sales-data'
import { SalesPageClient } from './sales-page-client'

export default async function SalesPage() {
  const ctx = await getCachedDashboardContext()

  if (!ctx.user) {
    redirect('/login')
  }

  if (!ctx.business) {
    redirect('/onboarding')
  }

  const { sales, batches } = await loadSalesInitial(ctx.supabase, ctx.business.businessId, 'month')

  return <SalesPageClient initialSales={sales} initialBatches={batches} />
}
