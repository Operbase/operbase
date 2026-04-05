import { redirect } from 'next/navigation'
import { getCachedDashboardContext } from '@/lib/dashboard/cached-dashboard-context'
import { loadStockInitial } from '@/lib/dashboard/stock-data'
import { StockPageClient } from './stock-page-client'

export default async function StockPage() {
  const ctx = await getCachedDashboardContext()

  if (!ctx.user) {
    redirect('/login')
  }

  if (!ctx.business) {
    redirect('/onboarding')
  }

  const { items, units } = await loadStockInitial(ctx.supabase, ctx.business.businessId, 'ingredient')

  return <StockPageClient initialItems={items} initialUnits={units} />
}
