'use client'

import { useEffect } from 'react'
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
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import { GettingStartedHelper } from '@/components/getting-started-helper'
import { AlertCircle, TrendingUp, Package, ChefHat, ShoppingBag, ChevronRight } from 'lucide-react'
import { useBusinessContext } from '@/providers/business-provider'
import { formatCurrency } from '@/lib/format-currency'
import { trackEvent } from '@/lib/services/events'
import type {
  DashboardAlertItem,
  DashboardMetrics,
  DashboardSpendRow,
} from '@/lib/dashboard/load-home-data'

export function DashboardHomeClient({
  metrics,
  monthlySpend,
  alerts,
  loadError,
  userName,
}: {
  metrics: DashboardMetrics
  monthlySpend: DashboardSpendRow[]
  alerts: DashboardAlertItem[]
  loadError: string | null
  /** Greeting line — from server session (layout already shows full profile in sidebar). */
  userName: string
}) {
  const router = useRouter()
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
    if (businessId) {
      trackEvent('dashboard_viewed', businessId)
    }
  }, [businessId])

  const chartData = [
    { name: 'Money in', value: metrics.totalRevenue },
    { name: 'Costs', value: metrics.totalCogs },
    { name: 'Left over', value: Math.max(0, metrics.grossProfit) },
  ]

  // Pie chart: brand colour + two contrast tones that work regardless of brandColor
  const pieColors = [brandColor ?? '#d97706', '#6b7280', '#d1d5db']

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

        <GettingStartedHelper />

        <div>
          <h1 className="text-3xl font-bold text-gray-900">Hi, {userName}!</h1>
          <p className="text-gray-600 mt-1">
            Here&apos;s <strong>{businessName ?? 'your business'}</strong> at a glance — revenue earned,
            what it cost to make, and your profit. Alerts below if anything is running low.
          </p>
        </div>

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
                  <p className="font-semibold text-lg text-gray-900">Baking</p>
                  <p className="text-sm text-gray-600">Log what you baked</p>
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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Money in</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(metrics.totalRevenue, currency)}
              </div>
              <p className="text-xs text-gray-500 mt-1">{metrics.totalSales} sales</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Costs (tracked)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-700">
                {formatCurrency(metrics.totalCogs, currency)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">After costs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-800">
                {formatCurrency(metrics.grossProfit, currency)}
              </div>
              <p className="text-xs text-gray-500 mt-1">From your sale records</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Batches</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.totalBatches}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Stock items</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.totalItems}</div>
            </CardContent>
          </Card>
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
                      {a.quantity_on_hand.toFixed(2)} {a.usage_unit_name} — {a.reason}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {monthlySpend.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>This month — spend by item (purchases)</CardTitle>
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp size={20} className="text-amber-600" />
                Money snapshot
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis />
                  <Tooltip formatter={(v: number) => formatCurrency(v, currency)} />
                  <Bar dataKey="value" fill={brandColor} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Business mix</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Sales', value: metrics.totalSales || 1 },
                      { name: 'Batches', value: metrics.totalBatches || 1 },
                      { name: 'Items', value: metrics.totalItems || 1 },
                    ]}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    dataKey="value"
                  >
                    {pieColors.map((color, index) => (
                      <Cell key={`cell-${index}`} fill={color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>
  )
}
