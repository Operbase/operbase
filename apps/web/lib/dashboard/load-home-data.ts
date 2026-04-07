import type { SupabaseClient } from '@supabase/supabase-js'

export type DashboardSalesPeriod = 'today' | 'week' | 'month' | 'all'

export type DashboardMetrics = {
  totalRevenue: number
  totalCogs: number
  grossProfit: number
  totalSales: number
  totalBatches: number
  totalItems: number
}

/** Start of window for `dashboard_metrics` sales aggregates (batches/items stay all-time). */
export function salesSinceForDashboardPeriod(
  period: DashboardSalesPeriod
): Date | null {
  if (period === 'all') return null
  const now = new Date()
  if (period === 'today') {
    return new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    )
  }
  if (period === 'week') {
    const d = new Date(now)
    d.setDate(d.getDate() - 7)
    return d
  }
  const d = new Date(now)
  d.setMonth(d.getMonth() - 1)
  return d
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

export type DashboardHomePayload = {
  metrics: DashboardMetrics
  /** All-time sales totals + all-time batch/item counts — used for empty states and ops context. */
  metricsLifetime: DashboardMetrics
  initialSalesPeriod: DashboardSalesPeriod
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

export async function loadDashboardHomeData(
  supabase: SupabaseClient,
  businessId: string,
  options?: { salesPeriod?: DashboardSalesPeriod }
): Promise<DashboardHomePayload> {
  const initialSalesPeriod: DashboardSalesPeriod = options?.salesPeriod ?? 'month'
  const since = salesSinceForDashboardPeriod(initialSalesPeriod)

  const now = new Date()
  const y = now.getUTCFullYear()
  const m = now.getUTCMonth() + 1

  const emptyMetrics: DashboardMetrics = {
    totalRevenue: 0,
    totalCogs: 0,
    grossProfit: 0,
    totalSales: 0,
    totalBatches: 0,
    totalItems: 0,
  }

  const empty: DashboardHomePayload = {
    metrics: emptyMetrics,
    metricsLifetime: emptyMetrics,
    initialSalesPeriod,
    monthlySpend: [],
    alerts: [],
    error: null,
  }

  try {
    const metricsLifetime = await fetchDashboardMetrics(supabase, businessId, null)
    const metrics =
      since === null
        ? metricsLifetime
        : await fetchDashboardMetrics(supabase, businessId, since)

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
      metrics,
      metricsLifetime,
      initialSalesPeriod,
      monthlySpend,
      alerts,
      error: parts.length ? `Partial load: could not load ${parts.join(', ')}` : null,
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to load dashboard'
    return { ...empty, error: message }
  }
}
