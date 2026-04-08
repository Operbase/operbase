import { redirect } from 'next/navigation'
import { getCachedDashboardContext } from '@/lib/dashboard/cached-dashboard-context'
import { loadProductCatalog } from '@/lib/dashboard/products-data'
import { ProductsPageClient } from './products-page-client'

export default async function ProductsPage() {
  const ctx = await getCachedDashboardContext()

  if (!ctx.user) redirect('/login')
  if (!ctx.business) redirect('/onboarding')

  const products = await loadProductCatalog(ctx.supabase, ctx.business.businessId)

  return <ProductsPageClient initialProducts={products} />
}
