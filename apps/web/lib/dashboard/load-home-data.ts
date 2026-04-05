import type { SupabaseClient } from '@supabase/supabase-js'

export type DashboardMetrics = {
  totalRevenue: number
  totalCogs: number
  grossProfit: number
  totalSales: number
  totalBatches: number
  totalItems: number
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
  monthlySpend: DashboardSpendRow[]
  alerts: DashboardAlertItem[]
  error: string | null
}

export async function loadDashboardHomeData(
  supabase: SupabaseClient,
  businessId: string
): Promise<DashboardHomePayload> {
  const now = new Date()
  const y = now.getUTCFullYear()
  const m = now.getUTCMonth() + 1

  const empty: DashboardHomePayload = {
    metrics: {
      totalRevenue: 0,
      totalCogs: 0,
      grossProfit: 0,
      totalSales: 0,
      totalBatches: 0,
      totalItems: 0,
    },
    monthlySpend: [],
    alerts: [],
    error: null,
  }

  try {
    const { data: metricsData, error: metricsError } = await supabase.rpc('dashboard_metrics', {
      p_business_id: businessId,
    })

    if (metricsError) throw metricsError

    const row = Array.isArray(metricsData) ? metricsData[0] : metricsData

    const metrics: DashboardMetrics = {
      totalRevenue: Number(row?.total_revenue ?? 0),
      totalCogs: Number(row?.total_cogs ?? 0),
      grossProfit: Number(row?.gross_profit ?? 0),
      totalSales: Number(row?.total_sales ?? 0),
      totalBatches: Number(row?.total_batches ?? 0),
      totalItems: Number(row?.total_items ?? 0),
    }

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
              usage_unit_name: a.usage_unit_name ?? '—',
              reason: a.reason ?? 'Low stock',
            })
          )
        : []

    const parts: string[] = []
    if (spendError) parts.push('monthly spend')
    if (alertsError) parts.push('alerts')

    return {
      metrics,
      monthlySpend,
      alerts,
      error: parts.length ? `Partial load: could not load ${parts.join(', ')}` : null,
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to load dashboard'
    return { ...empty, error: message }
  }
}
