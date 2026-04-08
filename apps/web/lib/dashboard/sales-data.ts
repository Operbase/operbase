import type { SupabaseClient } from '@supabase/supabase-js'
import { resolveBusinessTimeZone, salesSinceForDashboardPeriod } from '@/lib/business-time'

const PAGE_SIZE = 50

export type SalesRow = {
  id: string
  customer_name: string
  product_id: string | null
  product_name: string | null
  batch_id: string | null
  units_sold: number
  unit_price: number
  revenue: number
  cogs: number | null
  gross_profit: number | null
  sold_at: string
}

export async function loadSalesInitial(
  supabase: SupabaseClient,
  businessId: string,
  timeZone: string,
  dateRange: 'all' | 'week' | 'month' = 'month'
): Promise<{ sales: SalesRow[] }> {
  const tz = resolveBusinessTimeZone(timeZone)
  let salesQuery = supabase
    .from('sales')
    .select(
      'id, batch_id, units_sold, unit_price, revenue, cogs, gross_profit, sold_at, product_id, product_name, customers(name)'
    )
    .eq('business_id', businessId)

  if (dateRange !== 'all') {
    const period = dateRange === 'week' ? 'week' : 'month'
    const start = salesSinceForDashboardPeriod(period, tz)
    if (start) {
      salesQuery = salesQuery.gte('sold_at', start.toISOString())
    }
  }

  const { data } = await salesQuery
    .range(0, PAGE_SIZE - 1)
    .order('sold_at', { ascending: false })

  const sales: SalesRow[] = (data ?? []).map((s: Record<string, unknown>) => {
    const c = s.customers as { name?: string } | null
    return {
      id: s.id as string,
      customer_name: c?.name ?? 'Walk-in',
      product_id: (s.product_id as string | null) ?? null,
      product_name: (s.product_name as string | null) ?? null,
      batch_id: (s.batch_id as string | null) ?? null,
      units_sold: Number(s.units_sold),
      unit_price: Number(s.unit_price),
      revenue: Number(s.revenue),
      cogs: s.cogs != null ? Number(s.cogs) : null,
      gross_profit: s.gross_profit != null ? Number(s.gross_profit) : null,
      sold_at: s.sold_at as string,
    }
  })

  return { sales }
}
