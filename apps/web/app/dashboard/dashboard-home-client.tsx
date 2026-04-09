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
      sub: 'Sales today did not cover the cost we tracked. Check prices or costs.',
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
    <div className="space-y-6">
      {loadError ? (
        <div
          className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex flex-wrap items-center justify-between gap-3"
          role="alert"
        >
          <span>{loadError}</span>
          <Button type="button" variant="outline" size="sm" onClick={() => router.refresh()}>
            Refresh
          </Button>
        </div>
      ) : null}

      {/* Greeting */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
          {businessGreetingLabel(timezone)}, {userName}
        </h1>
        <p className="text-gray-500 mt-1">
          Here is <span className="font-medium text-gray-700">{businessName ?? 'your shop'}</span> at a glance.
        </p>
      </div>

      {/* 1 — Today's result */}
      {neverHadSale ? (
        <Card className="border-0 bg-gradient-to-br from-amber-50 via-orange-50/60 to-white shadow-md overflow-hidden">
          <CardContent className="pt-8 pb-8 px-6 text-center space-y-4">
            <p className="text-xl font-semibold text-gray-900">Log a first sale to see how you did</p>
            <p className="text-sm text-gray-500 max-w-md mx-auto leading-relaxed">
              Start by adding your stock (the ingredients you buy), then record a production run when you bake,
              and finally log a sale when money comes in. Each step only takes a minute.
            </p>
            <div className="flex flex-col sm:flex-row flex-wrap justify-center gap-3 pt-2">
              <Button asChild size="lg" className="min-h-12 text-base text-white hover:opacity-90" style={{ backgroundColor: 'var(--brand)' }}>
                <Link href="/dashboard/stock">1. Add stock</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="min-h-12 text-base bg-white">
                <Link href="/dashboard/production">2. Record a run</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="min-h-12 text-base bg-white">
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
                ? 'border-0 bg-gradient-to-br from-green-50 to-emerald-50/40 shadow-md overflow-hidden'
                : headline.kind === 'bad'
                  ? 'border-0 bg-gradient-to-br from-red-50 to-rose-50/40 shadow-md overflow-hidden'
                  : 'border border-gray-200/80 bg-white/80 shadow-sm overflow-hidden'
            }
          >
            <CardContent className="pt-7 pb-7 px-6 sm:px-8">
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
              <p className="text-base sm:text-lg text-gray-600 mt-3 max-w-xl">{headline.sub}</p>
            </CardContent>
          </Card>
        </section>
      ) : null}

      {/* 2 — At risk */}
      {!neverHadSale && showAtRisk ? (
        <section aria-label="What is at risk">
          <Card className="border-0 bg-gradient-to-br from-amber-50 to-orange-50/50 shadow-md overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg text-amber-950">
                {atRisk.itemsLeft} items still unsold
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-3xl font-bold tabular-nums text-gray-900 tracking-tight">
                {formatCurrency(atRisk.moneyTiedUp, currency)}
              </p>
              <p className="text-sm text-gray-600">
                That is what it cost you to make them. Sell them to get your money back.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 pt-1">
                <Button
                  asChild
                  size="lg"
                  className="min-h-11 text-base flex-1 text-white hover:opacity-90"
                  style={{ backgroundColor: 'var(--brand)' }}
                >
                  <Link href="/dashboard/sales">Sell now</Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="min-h-11 text-base flex-1 bg-white">
                  <Link href="/dashboard/production#production-batches">Record giveaway or loss</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>
      ) : !neverHadSale ? (
        <Card className="border border-gray-200/80 bg-white/70 shadow-sm">
          <CardContent className="py-4 px-5">
            <p className="font-medium text-gray-700">Nothing left waiting. You cleared the shelf.</p>
            <p className="text-sm text-gray-500 mt-0.5">Great time to record a new run when you bake.</p>
          </CardContent>
        </Card>
      ) : null}

      {/* 3 — Quick actions */}
      <section aria-label="Quick actions">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Quick actions</p>
        <div className="grid grid-cols-3 gap-2">
          <Link
            href="/dashboard/production"
            className="action-tile flex flex-col items-center gap-2.5 py-5 rounded-2xl text-center"
          >
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--brand-light)' }}>
              <ChefHat size={18} style={{ color: 'var(--brand-dark)' }} />
            </div>
            <span className="text-xs font-semibold text-gray-700 leading-tight">Record production</span>
          </Link>
          <Link
            href="/dashboard/sales"
            className="action-tile flex flex-col items-center gap-2.5 py-5 rounded-2xl text-center"
          >
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--brand-light)' }}>
              <ShoppingBag size={18} style={{ color: 'var(--brand-dark)' }} />
            </div>
            <span className="text-xs font-semibold text-gray-700 leading-tight">Sell items</span>
          </Link>
          <Link
            href="/dashboard/stock"
            className="action-tile flex flex-col items-center gap-2.5 py-5 rounded-2xl text-center"
          >
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--brand-light)' }}>
              <Package size={18} style={{ color: 'var(--brand-dark)' }} />
            </div>
            <span className="text-xs font-semibold text-gray-700 leading-tight">Add stock</span>
          </Link>
        </div>
      </section>

      {/* 4 — Today in numbers */}
      {!neverHadSale ? (
        <section aria-label="Today summary">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Today in numbers</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="metric-card rounded-2xl border p-4 shadow-sm">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Made</p>
              <p className="text-4xl font-bold tabular-nums text-gray-900 mt-2 leading-none">{dailyTotals.madeToday}</p>
              <p className="text-xs text-gray-400 mt-1.5">items</p>
            </div>
            <div className="metric-card rounded-2xl border p-4 shadow-sm">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Sold</p>
              <p className="text-4xl font-bold tabular-nums text-green-700 mt-2 leading-none">{dailyTotals.soldUnitsToday}</p>
              <p className="text-xs text-gray-400 mt-1.5">items</p>
            </div>
            <div className="metric-card rounded-2xl border p-4 shadow-sm">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Money in</p>
              <p className="text-2xl font-bold tabular-nums text-green-700 mt-2 leading-none">
                {formatCurrency(todayMetrics.totalRevenue, currency)}
              </p>
              <p className="text-xs text-gray-400 mt-1.5">from sales</p>
            </div>
            <div className="metric-card rounded-2xl border p-4 shadow-sm">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">You kept</p>
              <p className={`text-2xl font-bold tabular-nums mt-2 leading-none ${todayMetrics.grossProfit >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                {formatCurrency(todayMetrics.grossProfit, currency)}
              </p>
              <p className="text-xs text-gray-400 mt-1.5">after costs</p>
            </div>
          </div>
        </section>
      ) : null}

      {alerts.length > 0 && (
        <Card className="border-0 bg-gradient-to-br from-orange-50 to-amber-50/40 shadow-sm overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-orange-900 text-base">
              <AlertCircle size={18} />
              Running low
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {alerts.map((a) => (
                <li
                  key={a.id}
                  className="flex justify-between gap-4 border-b border-orange-100/80 pb-2 last:border-0"
                >
                  <span className="font-medium text-gray-900">{a.name}</span>
                  <span className="text-gray-500 text-right tabular-nums">
                    {a.quantity_on_hand.toFixed(2)} {a.usage_unit_name}
                  </span>
                </li>
              ))}
            </ul>
            <Button asChild variant="outline" size="sm" className="mt-4 bg-white">
              <Link href="/dashboard/stock">Add stock</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <GettingStartedHelper />

      {monthlySpend.length > 0 && (
        <details className="rounded-2xl border border-gray-200/80 bg-white px-5 py-3.5 text-sm shadow-sm">
          <summary className="cursor-pointer font-medium text-gray-700 select-none">More details: what you spent this month</summary>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-100">
                  <th className="pb-2 pr-4 font-medium">Item</th>
                  <th className="pb-2 font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {monthlySpend.map((row) => (
                  <tr key={row.item_name} className="border-b border-gray-50">
                    <td className="py-2 pr-4 font-medium text-gray-800">{row.item_name}</td>
                    <td className="py-2 text-gray-600 tabular-nums">{formatCurrency(row.total_spend, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}

      <BusinessAssistant />

      {/* Bottom nav */}
      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-100/80">
        <Link
          href="/dashboard/stock"
          className="flex flex-col items-center gap-1.5 p-3 rounded-xl hover:bg-white/80 transition-colors text-center group"
        >
          <Package size={20} className="text-gray-400 group-hover:text-gray-700 transition-colors" />
          <span className="text-xs font-medium text-gray-500 group-hover:text-gray-800 transition-colors">Stock</span>
        </Link>
        <Link
          href="/dashboard/production"
          className="flex flex-col items-center gap-1.5 p-3 rounded-xl hover:bg-white/80 transition-colors text-center group"
        >
          <ChefHat size={20} className="text-gray-400 group-hover:text-gray-700 transition-colors" />
          <span className="text-xs font-medium text-gray-500 group-hover:text-gray-800 transition-colors">Make</span>
        </Link>
        <Link
          href="/dashboard/sales"
          className="flex flex-col items-center gap-1.5 p-3 rounded-xl hover:bg-white/80 transition-colors text-center group"
        >
          <ShoppingBag size={20} className="text-gray-400 group-hover:text-gray-700 transition-colors" />
          <span className="text-xs font-medium text-gray-500 group-hover:text-gray-800 transition-colors">Sell</span>
        </Link>
      </div>
    </div>
  )
}
