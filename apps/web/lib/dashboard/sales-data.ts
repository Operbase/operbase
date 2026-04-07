import type { SupabaseClient } from '@supabase/supabase-js'

const PAGE_SIZE = 50

export type SalesRow = {
  id: string
  customer_name: string
  product_name: string | null
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
  dateRange: 'all' | 'week' | 'month' = 'month'
): Promise<{ sales: SalesRow[] }> {
  let salesQuery = supabase
    .from('sales')
    .select('id, units_sold, unit_price, revenue, cogs, gross_profit, sold_at, product_name, customers(name)')
    .eq('business_id', businessId)

  if (dateRange !== 'all') {
    const now = new Date()
    const start = new Date(now)
    if (dateRange === 'week') start.setDate(now.getDate() - 7)
    else if (dateRange === 'month') start.setMonth(now.getMonth() - 1)
    salesQuery = salesQuery.gte('sold_at', start.toISOString())
  }

  const { data } = await salesQuery
    .range(0, PAGE_SIZE - 1)
    .order('sold_at', { ascending: false })

  const sales: SalesRow[] = (data ?? []).map((s: Record<string, unknown>) => {
    const c = s.customers as { name?: string } | null
    return {
      id: s.id as string,
      customer_name: c?.name ?? 'Walk-in',
      product_name: (s.product_name as string | null) ?? null,
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
