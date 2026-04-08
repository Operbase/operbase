import type { SupabaseClient } from '@supabase/supabase-js'
import { resolveBusinessTimeZone, salesSinceForDashboardPeriod } from '@/lib/business-time'

export type DashboardSalesPeriod = 'today' | 'week' | 'month' | 'all'

export type DashboardMetrics = {
  totalRevenue: number
  totalCogs: number
  grossProfit: number
  totalSales: number
  totalBatches: number
  totalItems: number
}

export function dashboardMetricsFromRpc(row: unknown): DashboardMetrics {
  const r = (Array.isArray(row) ? row[0] : row) as Record<string, unknown> | null | undefined
  return {
    totalRevenue: Number(r?.total_revenue ?? 0),
    totalCogs: Number(r?.total_cogs ?? 0),
    grossProfit: Number(r?.gross_profit ?? 0),
    totalSales: Number(r?.total_sales ?? 0),
    totalBatches: Number(r?.total_batches ?? 0),
    totalItems: Number(r?.total_items ?? 0),
  }
}

export type DashboardSpendRow = {
  item_name: string
  total_spend: number
}

export type DashboardAlertItem = {
  id: string
  name: string
  quantity_on_hand: number
  usage_unit_name: string
  reason: string
}

/** Unsold finished goods: count + ingredient money still in those items. */
export type DashboardAtRisk = {
  itemsLeft: number
  moneyTiedUp: number
}

export type DashboardDailyTotals = {
  madeToday: number
  soldUnitsToday: number
  /** Cumulative across all batches: given away, written off, spoilage (not “today” — shown as lifetime context). */
  lostUnitsLifetime: number
}

export type DashboardHomePayload = {
  /** Sales + profit for the current calendar day in the business timezone. */
  todayMetrics: DashboardMetrics
  /** All-time sales totals + all-time batch/item counts — used for empty states. */
  metricsLifetime: DashboardMetrics
  atRisk: DashboardAtRisk
  dailyTotals: DashboardDailyTotals
  monthlySpend: DashboardSpendRow[]
  alerts: DashboardAlertItem[]
  error: string | null
}

async function fetchDashboardMetrics(
  supabase: SupabaseClient,
  businessId: string,
  salesSince: Date | null
): Promise<DashboardMetrics> {
  const { data, error } = await supabase.rpc('dashboard_metrics', {
    p_business_id: businessId,
    p_sales_since: salesSince?.toISOString() ?? null,
  })
  if (error) throw error
  return dashboardMetricsFromRpc(data)
}

async function fetchAtRiskAndDailyTotals(
  supabase: SupabaseClient,
  businessId: string,
  timeZone: string
): Promise<{ atRisk: DashboardAtRisk; dailyTotals: DashboardDailyTotals }> {
  const tz = resolveBusinessTimeZone(timeZone)
  const todayStart = salesSinceForDashboardPeriod('today', tz)
  const todayIso = todayStart?.toISOString() ?? new Date(0).toISOString()

  const empty: { atRisk: DashboardAtRisk; dailyTotals: DashboardDailyTotals } = {
    atRisk: { itemsLeft: 0, moneyTiedUp: 0 },
    dailyTotals: { madeToday: 0, soldUnitsToday: 0, lostUnitsLifetime: 0 },
  }

  const { data: batches, error: batchErr } = await supabase
    .from('batches')
    .select(
      'units_remaining, units_produced, cost_of_goods, produced_at, units_given_away, units_given_out_extra, units_spoiled, units_not_sold_loss'
    )
    .eq('business_id', businessId)

  if (batchErr || !batches) {
    return empty
  }

  let itemsLeft = 0
  let moneyTiedUp = 0
  let madeToday = 0
  let lostUnitsLifetime = 0

  for (const b of batches) {
    const ur = Number(b.units_remaining ?? 0)
    const up = Number(b.units_produced ?? 0)
    const cogs = b.cost_of_goods != null ? Number(b.cost_of_goods) : null
    itemsLeft += ur
    if (ur > 0 && cogs != null && up > 0) {
      moneyTiedUp += ur * (cogs / up)
    }
    lostUnitsLifetime +=
      Number(b.units_given_away ?? 0) +
      Number(b.units_given_out_extra ?? 0) +
      Number(b.units_spoiled ?? 0) +
      Number(b.units_not_sold_loss ?? 0)

    const producedAt = String(b.produced_at ?? '')
    if (todayStart && producedAt >= todayIso) {
      madeToday += up
    }
  }

  const { data: salesToday, error: salesErr } = await supabase
    .from('sales')
    .select('units_sold')
    .eq('business_id', businessId)
    .gte('sold_at', todayIso)

  let soldUnitsToday = 0
  if (!salesErr && salesToday) {
    for (const s of salesToday) {
      soldUnitsToday += Number(s.units_sold ?? 0)
    }
  }

  return {
    atRisk: { itemsLeft, moneyTiedUp },
    dailyTotals: { madeToday, soldUnitsToday, lostUnitsLifetime },
  }
}

export async function loadDashboardHomeData(
  supabase: SupabaseClient,
  businessId: string,
  timeZone: string
): Promise<DashboardHomePayload> {
  const tz = resolveBusinessTimeZone(timeZone)
  const now = new Date()
  const cal = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
  const [yStr, mStr] = cal.split('-')
  const y = Number(yStr)
  const m = Number(mStr)
  const todaySince = salesSinceForDashboardPeriod('today', tz, now)

  const emptyMetrics: DashboardMetrics = {
    totalRevenue: 0,
    totalCogs: 0,
    grossProfit: 0,
    totalSales: 0,
    totalBatches: 0,
    totalItems: 0,
  }

  const empty: DashboardHomePayload = {
    todayMetrics: emptyMetrics,
    metricsLifetime: emptyMetrics,
    atRisk: { itemsLeft: 0, moneyTiedUp: 0 },
    dailyTotals: { madeToday: 0, soldUnitsToday: 0, lostUnitsLifetime: 0 },
    monthlySpend: [],
    alerts: [],
    error: null,
  }

  try {
    const metricsLifetime = await fetchDashboardMetrics(supabase, businessId, null)
    const todayMetrics = await fetchDashboardMetrics(supabase, businessId, todaySince)
    const { atRisk, dailyTotals } = await fetchAtRiskAndDailyTotals(supabase, businessId, tz)

    const { data: spendData, error: spendError } = await supabase.rpc('monthly_spend_by_item', {
      p_business_id: businessId,
      p_year: y,
      p_month: m,
    })

    const monthlySpend: DashboardSpendRow[] =
      !spendError && spendData
        ? spendData.map((r: { item_name: string; total_spend: unknown }) => ({
            item_name: r.item_name,
            total_spend: Number(r.total_spend),
          }))
        : []

    const { data: alertsData, error: alertsError } = await supabase.rpc('low_stock_alerts', {
      p_business_id: businessId,
      p_limit: 12,
    })

    const alerts: DashboardAlertItem[] =
      !alertsError && alertsData
        ? alertsData.map(
            (a: {
              item_id: string
              item_name: string
              quantity_on_hand: unknown
              usage_unit_name?: string
              reason?: string
            }) => ({
              id: a.item_id,
              name: a.item_name,
              quantity_on_hand: Number(a.quantity_on_hand ?? 0),
              usage_unit_name: a.usage_unit_name ?? '',
              reason: a.reason ?? 'Low stock',
            })
          )
        : []

    const parts: string[] = []
    if (spendError) parts.push('monthly spend')
    if (alertsError) parts.push('alerts')

    return {
      todayMetrics,
      metricsLifetime,
      atRisk,
      dailyTotals,
      monthlySpend,
      alerts,
      error: parts.length ? `Partial load: could not load ${parts.join(', ')}` : null,
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to load dashboard'
    return { ...empty, error: message }
  }
}
