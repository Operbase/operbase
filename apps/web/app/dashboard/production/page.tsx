import { redirect } from 'next/navigation'
import { getCachedDashboardContext } from '@/lib/dashboard/cached-dashboard-context'
import { loadProductionInitial } from '@/lib/dashboard/production-data'
import { ProductionPageClient } from './production-page-client'

export default async function ProductionPage() {
  const ctx = await getCachedDashboardContext()

  if (!ctx.user) {
    redirect('/login')
  }

  if (!ctx.business) {
    redirect('/onboarding')
  }

  const { batches, stockItems } = await loadProductionInitial(ctx.supabase, ctx.business.businessId)

  return <ProductionPageClient initialBatches={batches} initialStockItems={stockItems} />
}
