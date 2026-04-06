import type { SupabaseClient } from '@supabase/supabase-js'
import { formatCurrency } from '@/lib/format-currency'

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
  batch_id: string | null
}

export type SalesBatchOptionRow = {
  id: string
  label: string
  units_produced: number
  cost_of_goods: number | null
}

export async function loadSalesInitial(
  supabase: SupabaseClient,
  businessId: string,
  dateRange: 'all' | 'week' | 'month' = 'month',
  currency = 'USD'
): Promise<{ sales: SalesRow[]; batches: SalesBatchOptionRow[] }> {
  let salesQuery = supabase
    .from('sales')
    .select(
      'id, units_sold, unit_price, revenue, cogs, gross_profit, sold_at, batch_id, product_name, customers(name)'
    )
    .eq('business_id', businessId)

  if (dateRange !== 'all') {
    const now = new Date()
    const start = new Date(now)
    if (dateRange === 'week') start.setDate(now.getDate() - 7)
    else if (dateRange === 'month') start.setMonth(now.getMonth() - 1)
    salesQuery = salesQuery.gte('sold_at', start.toISOString())
  }

  const [salesRes, batchesRes] = await Promise.all([
    salesQuery.range(0, PAGE_SIZE - 1).order('sold_at', { ascending: false }),
    supabase
      .from('batches')
      .select('id, notes, units_produced, cost_of_goods, products(name)')
      .eq('business_id', businessId)
      .order('produced_at', { ascending: false }),
  ])

  const sales: SalesRow[] = (salesRes.data ?? []).map((s: Record<string, unknown>) => {
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
      batch_id: s.batch_id as string | null,
    }
  })

  const batches: SalesBatchOptionRow[] = (batchesRes.data ?? []).map((b: Record<string, unknown>) => {
    const p = b.products as { name?: string } | null
    const name = p?.name ?? (b.notes as string) ?? 'Batch'
    const cost = b.cost_of_goods != null ? Number(b.cost_of_goods) : null
    const up = Number(b.units_produced)
    const cpu = cost != null && up > 0 ? cost / up : null
    return {
      id: b.id as string,
      label:
        cpu != null
          ? `${name} (~${formatCurrency(cpu, currency)}/unit)`
          : `${name} (no batch cost)`,
      units_produced: up,
      cost_of_goods: cost,
    }
  })

  return { sales, batches }
}
