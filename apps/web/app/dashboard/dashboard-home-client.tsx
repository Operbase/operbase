'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { GettingStartedHelper } from '@/components/getting-started-helper'
import { AlertCircle, TrendingUp, Package, ChefHat, ShoppingBag, ChevronRight } from 'lucide-react'
import { useBusinessContext } from '@/providers/business-provider'
import { formatCurrency } from '@/lib/format-currency'
import { trackEvent } from '@/lib/services/events'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  dashboardMetricsFromRpc,
  salesSinceForDashboardPeriod,
  type DashboardAlertItem,
  type DashboardMetrics,
  type DashboardSalesPeriod,
  type DashboardSpendRow,
} from '@/lib/dashboard/load-home-data'

const PERIOD_OPTIONS: { value: DashboardSalesPeriod; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'Last week' },
  { value: 'month', label: 'Last month' },
  { value: 'all', label: 'All time' },
]

export function DashboardHomeClient({
  metrics: initialMetrics,
  metricsLifetime,
  initialSalesPeriod,
  monthlySpend,
  alerts,
  loadError,
  userName,
}: {
  metrics: DashboardMetrics
  metricsLifetime: DashboardMetrics
  initialSalesPeriod: DashboardSalesPeriod
  monthlySpend: DashboardSpendRow[]
  alerts: DashboardAlertItem[]
  loadError: string | null
  /** Greeting line — from server session (layout already shows full profile in sidebar). */
  userName: string
}) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [salesPeriod, setSalesPeriod] = useState<DashboardSalesPeriod>(initialSalesPeriod)
  const [periodMetrics, setPeriodMetrics] = useState<DashboardMetrics>(initialMetrics)
  const [periodLoading, setPeriodLoading] = useState(false)

  const {
    businessId,
    businessName,
    currency,
    brandColor,
    loading: bizLoading,
    error: bizError,
    refetch: bizRefetch,
  } = useBusinessContext()

  useEffect(() => {
    setPeriodMetrics(initialMetrics)
  }, [initialMetrics])

  useEffect(() => {
    setSalesPeriod(initialSalesPeriod)
  }, [initialSalesPeriod])

  useEffect(() => {
    if (businessId) {
      trackEvent('dashboard_viewed', businessId)
    }
  }, [businessId])

  const loadPeriodMetrics = useCallback(
    async (p: DashboardSalesPeriod) => {
      if (!businessId) return
      setSalesPeriod(p)
      setPeriodLoading(true)
      try {
        const since = salesSinceForDashboardPeriod(p)
        const { data, error } = await supabase.rpc('dashboard_metrics', {
          p_business_id: businessId,
          p_sales_since: since?.toISOString() ?? null,
        })
        if (error) throw error
        setPeriodMetrics(dashboardMetricsFromRpc(data))
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Could not load metrics'
        toast.error(msg)
      } finally {
        setPeriodLoading(false)
      }
    },
    [businessId, supabase]
  )

  const neverHadSale = metricsLifetime.totalSales === 0
  const periodHasMoney =
    periodMetrics.totalRevenue > 0 ||
    periodMetrics.totalCogs > 0 ||
    periodMetrics.grossProfit !== 0

  const chartData = [
    { name: 'Money in', value: periodMetrics.totalRevenue },
    { name: 'Costs', value: periodMetrics.totalCogs },
    { name: 'Left over', value: Math.max(0, periodMetrics.grossProfit) },
  ]

  if (bizError) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <p className="text-red-600 font-medium">{bizError}</p>
        <Button onClick={() => bizRefetch()} variant="outline">
          Try again
        </Button>
      </div>
    )
  }

  if (bizLoading && !businessId) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-gray-500">Loading dashboard...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {loadError ? (
        <div
          className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex flex-wrap items-center justify-between gap-3"
          role="alert"
        >
          <span>{loadError}</span>
          <Button type="button" variant="outline" size="sm" onClick={() => router.refresh()}>
            Refresh
          </Button>
        </div>
      ) : null}

      <div>
        <h1 className="text-3xl font-bold text-gray-900">Hi, {userName}!</h1>
          <p className="text-gray-600 mt-1">
            Quick look at <strong>{businessName ?? 'your business'}</strong> for today.
          </p>
      </div>

      {/* Profit block — outcome first; time range applies to sales-derived figures */}
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide w-full sm:w-auto">
            Sales period
          </span>
          <div className="flex flex-wrap gap-1">
            {PERIOD_OPTIONS.map(({ value, label }) => (
              <Button
                key={value}
                type="button"
                size="sm"
                variant={salesPeriod === value ? 'default' : 'outline'}
                disabled={periodLoading}
                className={
                  salesPeriod === value ? 'bg-amber-600 hover:bg-amber-700 text-white' : ''
                }
                onClick={() => void loadPeriodMetrics(value)}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>

        {neverHadSale ? (
          <Card className="border-amber-200 bg-gradient-to-br from-amber-50/80 to-white">
            <CardContent className="pt-8 pb-8 px-6 text-center space-y-3">
              <p className="text-lg font-semibold text-gray-900">Your profit will show here</p>
              <p className="text-sm text-gray-600 max-w-md mx-auto leading-relaxed">
                After your first sale you will see money in, costs, and what is left, like the preview on
                our homepage. Add stock, log a batch, then head to Sales when you are ready.
              </p>
              <div className="flex flex-wrap justify-center gap-2 pt-2">
                <Button asChild size="sm" className="bg-amber-600 hover:bg-amber-700">
                  <Link href="/dashboard/sales">Log a sale</Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link href="/dashboard/stock">Add stock</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="border-amber-200 bg-amber-50/50 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium text-amber-900">After costs</CardTitle>
                <p className="text-xs text-amber-800/80 font-normal">
                  Profit from sales in the period you picked (from what you logged in Sales).
                </p>
              </CardHeader>
              <CardContent>
                <div className="text-3xl sm:text-4xl font-bold text-amber-900">
                  {periodLoading ? '…' : formatCurrency(periodMetrics.grossProfit, currency)}
                </div>
                <p className="text-sm text-gray-600 mt-2">
                  {periodLoading ? ' ' : `${periodMetrics.totalSales} sales`} in this period
                </p>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">Money in</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    {periodLoading ? '…' : formatCurrency(periodMetrics.totalRevenue, currency)}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">Costs (tracked)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-700">
                    {periodLoading ? '…' : formatCurrency(periodMetrics.totalCogs, currency)}
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>

      {alerts.length > 0 && (
        <Card className="border-orange-200 bg-orange-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-900">
              <AlertCircle size={20} />
              Stock alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {alerts.map((a) => (
                <li
                  key={a.id}
                  className="flex justify-between gap-4 border-b border-orange-100 pb-2 last:border-0"
                >
                  <span className="font-medium text-gray-900">{a.name}</span>
                  <span className="text-gray-600 text-right">
                    {a.quantity_on_hand.toFixed(2)} {a.usage_unit_name} ({a.reason})
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <GettingStartedHelper />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Link href="/dashboard/stock">
          <Card className="h-full transition-shadow hover:shadow-md border-2 border-transparent hover:border-amber-200 cursor-pointer">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="rounded-full bg-amber-100 p-3">
                <Package className="text-amber-800" size={28} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-lg text-gray-900">Stock</p>
                <p className="text-sm text-gray-600">Add flour, sugar, bags…</p>
              </div>
              <ChevronRight className="text-gray-400 shrink-0" />
            </CardContent>
          </Card>
        </Link>
        <Link href="/dashboard/production">
          <Card className="h-full transition-shadow hover:shadow-md border-2 border-transparent hover:border-amber-200 cursor-pointer">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="rounded-full bg-amber-100 p-3">
                <ChefHat className="text-amber-800" size={28} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-lg text-gray-900">Production</p>
                <p className="text-sm text-gray-600">Record what you made</p>
              </div>
              <ChevronRight className="text-gray-400 shrink-0" />
            </CardContent>
          </Card>
        </Link>
        <Link href="/dashboard/sales">
          <Card className="h-full transition-shadow hover:shadow-md border-2 border-transparent hover:border-amber-200 cursor-pointer">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="rounded-full bg-amber-100 p-3">
                <ShoppingBag className="text-amber-800" size={28} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-lg text-gray-900">Sales</p>
                <p className="text-sm text-gray-600">Record a sale</p>
              </div>
              <ChevronRight className="text-gray-400 shrink-0" />
            </CardContent>
          </Card>
        </Link>
      </div>

      {!neverHadSale && (
        <div className="grid grid-cols-2 gap-3 max-w-lg">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-gray-500">Batches (all time)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold">{periodMetrics.totalBatches}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-gray-500">Stock items</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold">{periodMetrics.totalItems}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {monthlySpend.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>This month: what you spent on each item</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b">
                    <th className="pb-2 pr-4">Item</th>
                    <th className="pb-2">Spend</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlySpend.map((row) => (
                    <tr key={row.item_name} className="border-b border-gray-100">
                      <td className="py-2 pr-4 font-medium">{row.item_name}</td>
                      <td className="py-2">{formatCurrency(row.total_spend, currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-gray-500 mt-3">
              Based on restock entries (purchase / manual) this calendar month (UTC).
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp size={20} className="text-amber-600" />
            Money snapshot
          </CardTitle>
        </CardHeader>
        <CardContent>
          {neverHadSale ? (
            <p className="text-sm text-gray-600 py-10 text-center max-w-md mx-auto leading-relaxed">
              Once you have a week of sales, your trend shows up here. Until then we skip the empty chart
              and show this note instead.
            </p>
          ) : !periodHasMoney ? (
            <p className="text-sm text-gray-600 py-10 text-center max-w-md mx-auto leading-relaxed">
              Nothing in this period yet. Try a wider range above, or record a sale in Sales.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis />
                <Tooltip formatter={(v: number) => formatCurrency(v, currency)} />
                <Bar dataKey="value" fill={brandColor} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
