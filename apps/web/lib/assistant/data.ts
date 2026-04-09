import type { SupabaseClient } from '@supabase/supabase-js'

// ── Types returned by each data function ─────────────────────────────────────

export type StockRow = {
  name: string
  onHand: number
  unitName: string
  isLow: boolean
}

export type UsageRow = {
  name: string
  used: number
  unitName: string
}

export type TodayProfitData = {
  totalUnits: number
  totalRevenue: number
  totalCogs: number
  totalProfit: number
  byProduct: { name: string; units: number }[]
}

export type TodaySalesData = {
  totalUnits: number
  byProduct: { name: string; units: number }[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayRange(timezone: string): { from: string; to: string } {
  const now = new Date()
  const localDateStr = now.toLocaleDateString('en-CA', { timeZone: timezone })
  // Compute UTC offset for this timezone at this moment
  const localMs = new Date(now.toLocaleString('en-US', { timeZone: timezone })).getTime()
  const offsetMs = now.getTime() - localMs
  const start = new Date(new Date(`${localDateStr}T00:00:00`).getTime() + offsetMs)
  const end = new Date(start.getTime() + 86_400_000)
  return { from: start.toISOString(), to: end.toISOString() }
}

// ── Data functions ────────────────────────────────────────────────────────────

export async function getCurrentStock(
  supabase: SupabaseClient,
  businessId: string
): Promise<StockRow[]> {
  const { data, error } = await supabase
    .from('items')
    .select('name, quantity_on_hand, low_stock_threshold, usage_unit:units!items_usage_unit_id_fkey(name)')
    .eq('business_id', businessId)
    .order('name')

  if (error) throw error

  const rows = (data ?? []) as unknown as {
    name: string
    quantity_on_hand: number
    low_stock_threshold: number | null
    usage_unit: { name: string } | null
  }[]

  return rows.map((r) => ({
    name: r.name,
    onHand: Number(r.quantity_on_hand ?? 0),
    unitName: (r.usage_unit as { name?: string } | null)?.name ?? '',
    isLow:
      r.quantity_on_hand <= 0 ||
      (r.low_stock_threshold != null && r.quantity_on_hand <= r.low_stock_threshold),
  }))
}

export async function getWeeklyUsage(
  supabase: SupabaseClient,
  businessId: string
): Promise<UsageRow[]> {
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const { data, error } = await supabase
    .from('stock_entries')
    .select('item_id, quantity, items!inner(name, usage_unit:units!items_usage_unit_id_fkey(name))')
    .eq('business_id', businessId)
    .lt('quantity', 0)
    .gte('created_at', sevenDaysAgo.toISOString())

  if (error) throw error

  const entries = (data ?? []) as unknown as {
    item_id: string
    quantity: number
    items: { name: string; usage_unit: { name: string } | null }
  }[]

  const map = new Map<string, UsageRow>()
  for (const e of entries) {
    const id = e.item_id
    const existing = map.get(id)
    const unitName = (e.items.usage_unit as { name?: string } | null)?.name ?? ''
    if (existing) {
      existing.used += Math.abs(Number(e.quantity))
    } else {
      map.set(id, { name: e.items.name, used: Math.abs(Number(e.quantity)), unitName })
    }
  }

  return Array.from(map.values()).sort((a, b) => b.used - a.used)
}

export async function getTodayProfit(
  supabase: SupabaseClient,
  businessId: string,
  timezone: string
): Promise<TodayProfitData> {
  const { from, to } = todayRange(timezone)

  const { data, error } = await supabase
    .from('sales')
    .select('revenue, cogs, gross_profit, units_sold, product_name')
    .eq('business_id', businessId)
    .gte('sold_at', from)
    .lt('sold_at', to)

  if (error) throw error

  const rows = (data ?? []) as {
    revenue: number
    cogs: number | null
    gross_profit: number | null
    units_sold: number
    product_name: string | null
  }[]

  const byProduct = new Map<string, number>()
  for (const r of rows) {
    const name = r.product_name ?? 'Item'
    byProduct.set(name, (byProduct.get(name) ?? 0) + Number(r.units_sold))
  }

  return {
    totalUnits: rows.reduce((s, r) => s + Number(r.units_sold), 0),
    totalRevenue: rows.reduce((s, r) => s + Number(r.revenue), 0),
    totalCogs: rows.reduce((s, r) => s + Number(r.cogs ?? 0), 0),
    totalProfit: rows.reduce((s, r) => s + Number(r.gross_profit ?? 0), 0),
    byProduct: Array.from(byProduct.entries()).map(([name, units]) => ({ name, units })),
  }
}

export async function getTodaySales(
  supabase: SupabaseClient,
  businessId: string,
  timezone: string
): Promise<TodaySalesData> {
  const { from, to } = todayRange(timezone)

  const { data, error } = await supabase
    .from('sales')
    .select('units_sold, product_name')
    .eq('business_id', businessId)
    .gte('sold_at', from)
    .lt('sold_at', to)

  if (error) throw error

  const rows = (data ?? []) as { units_sold: number; product_name: string | null }[]

  const byProduct = new Map<string, number>()
  for (const r of rows) {
    const name = r.product_name ?? 'Item'
    byProduct.set(name, (byProduct.get(name) ?? 0) + Number(r.units_sold))
  }

  return {
    totalUnits: rows.reduce((s, r) => s + Number(r.units_sold), 0),
    byProduct: Array.from(byProduct.entries())
      .sort(([, a], [, b]) => b - a)
      .map(([name, units]) => ({ name, units })),
  }
}
