'use client'

import { useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { GettingStartedHelper } from '@/components/getting-started-helper'
import { BusinessAssistant } from '@/components/business-assistant'
import { AlertCircle, ChefHat, Package, ShoppingBag } from 'lucide-react'
import { useBusinessContext } from '@/providers/business-provider'
import { formatCurrency } from '@/lib/format-currency'
import { trackEvent } from '@/lib/services/events'
import { businessGreetingLabel } from '@/lib/business-time'
import type {
  DashboardAlertItem,
  DashboardAtRisk,
  DashboardDailyTotals,
  DashboardMetrics,
  DashboardSpendRow,
} from '@/lib/dashboard/load-home-data'

export function DashboardHomeClient({
  todayMetrics,
  metricsLifetime,
  atRisk,
  dailyTotals,
  monthlySpend,
  alerts,
  loadError,
  userName,
}: {
  todayMetrics: DashboardMetrics
  metricsLifetime: DashboardMetrics
  atRisk: DashboardAtRisk
  dailyTotals: DashboardDailyTotals
  monthlySpend: DashboardSpendRow[]
  alerts: DashboardAlertItem[]
  loadError: string | null
  userName: string
}) {
  const router = useRouter()
  const {
    businessId,
    businessName,
    currency,
    timezone,
    loading: bizLoading,
    error: bizError,
    refetch: bizRefetch,
  } = useBusinessContext()

  useEffect(() => {
    if (businessId) {
      trackEvent('dashboard_viewed', businessId)
    }
  }, [businessId])

  const neverHadSale = metricsLifetime.totalSales === 0
  const profitToday = todayMetrics.grossProfit
  const hadSalesToday = todayMetrics.totalSales > 0

  const headline = useMemo(() => {
    if (neverHadSale) return null
    if (!hadSalesToday && profitToday === 0) {
      return {
        kind: 'neutral' as const,
        big: 'Nothing sold today yet',
        sub: 'When you log sales, your result for the day shows up here.',
      }
    }
    if (profitToday >= 0) {
      return {
        kind: 'good' as const,
        big: `You made ${formatCurrency(profitToday, currency)} today`,
        sub: 'After what those sales cost you to make.',
      }
    }
    return {
      kind: 'bad' as const,
      big: `You lost ${formatCurrency(Math.abs(profitToday), currency)} today`,
      sub: 'Sales today did not cover the cost we tracked — check prices or costs.',
    }
  }, [neverHadSale, hadSalesToday, profitToday, currency])

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
        <p className="text-gray-500">Loading…</p>
      </div>
    )
  }

  const showAtRisk = atRisk.itemsLeft > 0

  return (
    <div className="space-y-8 max-w-3xl">
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
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
          {businessGreetingLabel(timezone)}, {userName}
        </h1>
        <p className="text-gray-600 mt-1">
          Here is <strong>{businessName ?? 'your shop'}</strong> at a glance.
        </p>
      </div>

      {/* 1 — Today’s result */}
      {neverHadSale ? (
        <Card className="border-amber-200 bg-gradient-to-br from-amber-50/90 to-white shadow-sm">
          <CardContent className="pt-8 pb-8 px-6 text-center space-y-4">
            <p className="text-xl font-semibold text-gray-900">Log a first sale to see how you did</p>
            <p className="text-sm text-gray-600 max-w-md mx-auto leading-relaxed">
              Start by adding your stock (the ingredients you buy), then record a production run when you bake,
              and finally log a sale when money comes in. Each step only takes a minute.
            </p>
            <div className="flex flex-col sm:flex-row flex-wrap justify-center gap-3 pt-2">
              <Button asChild size="lg" className="min-h-12 text-base bg-amber-600 hover:bg-amber-700">
                <Link href="/dashboard/stock">1. Add stock</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="min-h-12 text-base">
                <Link href="/dashboard/production">2. Record a run</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="min-h-12 text-base">
                <Link href="/dashboard/sales">3. Log a sale</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : headline ? (
        <section aria-label="Today's result">
          <Card
            className={
              headline.kind === 'good'
                ? 'border-2 border-green-300 bg-green-50/80 shadow-md'
                : headline.kind === 'bad'
                  ? 'border-2 border-red-300 bg-red-50/80 shadow-md'
                  : 'border border-gray-200 bg-gray-50/80 shadow-sm'
            }
          >
            <CardContent className="pt-8 pb-8 px-6 sm:px-8">
              <p
                className={`text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight leading-tight ${
                  headline.kind === 'good'
                    ? 'text-green-800'
                    : headline.kind === 'bad'
                      ? 'text-red-800'
                      : 'text-gray-800'
                }`}
              >
                {headline.big}
              </p>
              <p className="text-base sm:text-lg text-gray-700 mt-3 max-w-xl">{headline.sub}</p>
            </CardContent>
          </Card>
        </section>
      ) : null}

      {/* 2 — At risk */}
      {!neverHadSale && showAtRisk ? (
        <section aria-label="What is at risk">
          <Card className="border-2 border-amber-300 bg-amber-50/90 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg text-amber-950">What is still waiting to sell</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-lg text-gray-900">
                You still have{' '}
                <strong className="tabular-nums text-amber-950">{atRisk.itemsLeft}</strong> items on hand.
              </p>
              <p className="text-2xl font-bold tabular-nums text-gray-900">
                {formatCurrency(atRisk.moneyTiedUp, currency)} in ingredient cost sitting in those unsold items.
              </p>
              <p className="text-sm font-medium text-amber-900 bg-amber-100/80 rounded-lg px-3 py-2 border border-amber-200">
                If they do not sell, you lose this money.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 pt-1">
                <Button
                  asChild
                  size="lg"
                  className="min-h-12 text-base flex-1 bg-amber-600 hover:bg-amber-700"
                >
                  <Link href="/dashboard/sales">Sell now</Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="min-h-12 text-base flex-1 bg-white">
                  <Link href="/dashboard/production#production-batches">Record giveaway or loss</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>
      ) : !neverHadSale ? (
        <Card className="border-amber-200 bg-amber-50/40">
          <CardContent className="py-5 px-5">
            <p className="font-medium text-amber-900">Nothing left waiting — you cleared the shelf.</p>
            <p className="text-sm text-amber-800/90 mt-1">Great time to record a new run when you bake.</p>
          </CardContent>
        </Card>
      ) : null}

      {/* 3 — Quick actions */}
      <section aria-label="Quick actions">
        <p className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">Quick actions</p>
        <div className="flex flex-col gap-3">
          <Button
            asChild
            size="lg"
            className="w-full min-h-14 text-lg justify-center bg-amber-600 hover:bg-amber-700"
          >
            <Link href="/dashboard/production">Record production</Link>
          </Button>
          <Button asChild size="lg" variant="default" className="w-full min-h-14 text-lg justify-center bg-amber-600 hover:bg-amber-700">
            <Link href="/dashboard/sales">Sell items</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="w-full min-h-14 text-lg justify-center border-2">
            <Link href="/dashboard/stock">Add stock</Link>
          </Button>
        </div>
      </section>

      {/* 4 — Simple summary */}
      {!neverHadSale ? (
        <section aria-label="Today summary">
          <p className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">Today in numbers</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="text-sm font-medium text-gray-600">Made</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold tabular-nums">{dailyTotals.madeToday}</p>
                <p className="text-xs text-gray-500 mt-1">items</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="text-sm font-medium text-gray-600">Sold</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold tabular-nums text-green-700">{dailyTotals.soldUnitsToday}</p>
                <p className="text-xs text-gray-500 mt-1">items</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="text-sm font-medium text-gray-600">Money in</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold tabular-nums text-green-700">
                  {formatCurrency(todayMetrics.totalRevenue, currency)}
                </p>
                <p className="text-xs text-gray-500 mt-1">from sales</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="text-sm font-medium text-gray-600">You kept</CardTitle>
              </CardHeader>
              <CardContent>
                <p className={`text-2xl font-bold tabular-nums ${todayMetrics.grossProfit >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                  {formatCurrency(todayMetrics.grossProfit, currency)}
                </p>
                <p className="text-xs text-gray-500 mt-1">after costs</p>
              </CardContent>
            </Card>
          </div>
        </section>
      ) : null}

      {alerts.length > 0 && (
        <Card className="border-orange-200 bg-orange-50/50">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-orange-950 text-base">
              <AlertCircle size={20} />
              Running low
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
                    {a.quantity_on_hand.toFixed(2)} {a.usage_unit_name}
                  </span>
                </li>
              ))}
            </ul>
            <Button asChild variant="outline" size="sm" className="mt-4">
              <Link href="/dashboard/stock">Add stock</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <GettingStartedHelper />

      {monthlySpend.length > 0 && (
        <details className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm">
          <summary className="cursor-pointer font-medium text-gray-900">More details — what you spent this month</summary>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="pb-2 pr-4">Item</th>
                  <th className="pb-2">Amount</th>
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
        </details>
      )}

      <BusinessAssistant />

      {/* Compact links — icons optional for scan */}
      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-100">
        <Link
          href="/dashboard/stock"
          className="flex flex-col items-center gap-1 p-3 rounded-lg hover:bg-gray-50 text-center"
        >
          <Package className="text-amber-700" size={22} />
          <span className="text-xs font-medium text-gray-700">Stock</span>
        </Link>
        <Link
          href="/dashboard/production"
          className="flex flex-col items-center gap-1 p-3 rounded-lg hover:bg-gray-50 text-center"
        >
          <ChefHat className="text-amber-700" size={22} />
          <span className="text-xs font-medium text-gray-700">Make</span>
        </Link>
        <Link
          href="/dashboard/sales"
          className="flex flex-col items-center gap-1 p-3 rounded-lg hover:bg-gray-50 text-center"
        >
          <ShoppingBag className="text-amber-700" size={22} />
          <span className="text-xs font-medium text-gray-700">Sell</span>
        </Link>
      </div>
    </div>
  )
}
