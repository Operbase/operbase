'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { loadInsightsData } from '@/lib/dashboard/insights-data'
import type {
  InsightsData,
  InsightsPeriod,
  InsightCard,
  ProductInsightRow,
  VariantInsightRow,
} from '@/lib/dashboard/insights-data'
import {
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Info,
  Lightbulb,
  ChevronDown,
  ChevronRight,
  ArrowRight,
  Loader2,
} from 'lucide-react'

interface Props {
  initialData: InsightsData
  businessId: string
  timezone: string
  currency: string
}

const PERIODS: { id: InsightsPeriod; label: string }[] = [
  { id: 'this_month',    label: 'This month'    },
  { id: 'last_month',   label: 'Last month'    },
  { id: 'last_3_months', label: 'Last 3 months' },
  { id: 'all_time',     label: 'All time'      },
]

// ── Formatters ────────────────────────────────────────────────────────────────

function useFmt(currency: string) {
  return {
    money: (n: number) =>
      `${currency}${Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
    pct: (n: number | null) => (n !== null ? `${n.toFixed(0)}%` : '—'),
    num: (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 1 }),
  }
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function MarginPill({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-xs text-gray-400">—</span>
  if (pct >= 50)
    return (
      <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
        <TrendingUp size={11} />{pct.toFixed(0)}%
      </span>
    )
  if (pct >= 25)
    return (
      <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
        <Minus size={11} />{pct.toFixed(0)}%
      </span>
    )
  if (pct >= 0)
    return (
      <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-orange-700 bg-orange-100 px-2 py-0.5 rounded-full">
        <TrendingDown size={11} />{pct.toFixed(0)}%
      </span>
    )
  return (
    <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-red-700 bg-red-100 px-2 py-0.5 rounded-full">
      <TrendingDown size={11} />{pct.toFixed(0)}%
    </span>
  )
}

// ── KPI card ──────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  positive,
  dimmed,
}: {
  label: string
  value: string
  sub?: string
  positive?: boolean
  dimmed?: boolean
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 flex flex-col gap-1">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p
        className={`text-2xl font-bold leading-tight ${
          dimmed
            ? 'text-gray-400'
            : positive === false
            ? 'text-red-600'
            : positive === true
            ? 'text-green-700'
            : 'text-gray-900'
        }`}
      >
        {value}
      </p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  )
}

// ── Insight card ──────────────────────────────────────────────────────────────

const CARD_STYLES: Record<InsightCard['type'], { bg: string; border: string; icon: React.ReactNode }> = {
  danger:  { bg: 'bg-red-50',    border: 'border-red-200',    icon: <AlertTriangle size={18} className="text-red-500 shrink-0 mt-0.5" /> },
  warning: { bg: 'bg-amber-50',  border: 'border-amber-200',  icon: <AlertCircle   size={18} className="text-amber-500 shrink-0 mt-0.5" /> },
  good:    { bg: 'bg-green-50',  border: 'border-green-200',  icon: <CheckCircle2  size={18} className="text-green-600 shrink-0 mt-0.5" /> },
  info:    { bg: 'bg-blue-50',   border: 'border-blue-200',   icon: <Info          size={18} className="text-blue-500 shrink-0 mt-0.5" /> },
  action:  { bg: 'bg-purple-50', border: 'border-purple-200', icon: <Lightbulb     size={18} className="text-purple-500 shrink-0 mt-0.5" /> },
}

function InsightCardItem({ card }: { card: InsightCard }) {
  const s = CARD_STYLES[card.type]
  return (
    <div className={`rounded-2xl border ${s.bg} ${s.border} p-4`}>
      <div className="flex gap-3">
        {s.icon}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 leading-snug">{card.title}</p>
          <p className="text-sm text-gray-600 mt-1 leading-relaxed">{card.body}</p>
          {card.action && (
            <Link
              href={card.action.href}
              className="inline-flex items-center gap-1 mt-2 text-sm font-medium text-gray-700 hover:text-gray-900 underline underline-offset-2"
            >
              {card.action.label} <ArrowRight size={13} />
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Variant row ───────────────────────────────────────────────────────────────

function VariantRow({
  v,
  fmt,
  currency,
}: {
  v: VariantInsightRow
  fmt: ReturnType<typeof useFmt>
  currency: string
}) {
  const profitPerUnit =
    v.avgCostPerUnit !== null ? null : null // uses sale-based margin

  return (
    <div className="pl-4 border-l-2 border-gray-100 ml-1 py-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      <span className="font-medium text-gray-700 min-w-[120px]">{v.variantName}</span>

      {v.avgCostPerUnit !== null ? (
        <span className="text-gray-500">{fmt.money(v.avgCostPerUnit)} cost</span>
      ) : (
        <span className="text-gray-400 text-xs">No production cost yet</span>
      )}

      {v.totalRevenue > 0 && (
        <>
          <span className="text-gray-500">{fmt.money(v.totalRevenue)} revenue</span>
          <MarginPill pct={v.marginPct} />
        </>
      )}

      {v.runCount > 0 && (
        <span className="text-xs text-gray-400">{v.runCount} {v.runCount === 1 ? 'run' : 'runs'}</span>
      )}

      {/* Inline prompts */}
      {v.noIngredients && v.runCount > 0 && (
        <Link href="/dashboard/production" className="text-xs text-amber-600 hover:underline">
          + Add ingredients to see real cost
        </Link>
      )}

      {profitPerUnit !== null && v.totalRevenue === 0 && (
        <span className="text-xs text-gray-400">No sales yet</span>
      )}
    </div>
  )
}

// ── Product row ───────────────────────────────────────────────────────────────

function ProductRow({
  p,
  fmt,
  currency,
}: {
  p: ProductInsightRow
  fmt: ReturnType<typeof useFmt>
  currency: string
}) {
  const [expanded, setExpanded] = useState(false)
  const hasVariants = p.variants.length > 0

  const profitPerUnit =
    p.salePrice > 0 && p.avgCostPerUnit !== null
      ? p.salePrice - p.avgCostPerUnit
      : null

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-gray-900">{p.productName}</span>
              <MarginPill pct={p.marginPct} />
              {p.wasteRate !== null && p.wasteRate > 10 && (
                <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">
                  {p.wasteRate.toFixed(0)}% waste
                </span>
              )}
            </div>
          </div>
          {hasVariants && (
            <button
              type="button"
              onClick={() => setExpanded(v => !v)}
              className="shrink-0 text-gray-400 hover:text-gray-700 p-1 rounded-lg"
              aria-label={expanded ? 'Collapse variants' : 'Expand variants'}
            >
              {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
          )}
        </div>

        {/* Core metrics grid */}
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Sale price */}
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Sale price</p>
            {p.hasSalePrice ? (
              <p className="text-sm font-semibold text-gray-900">{fmt.money(p.salePrice)}</p>
            ) : (
              <Link href="/dashboard/products" className="text-xs text-amber-600 hover:underline font-medium">
                Set price →
              </Link>
            )}
          </div>

          {/* Avg production cost */}
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Avg cost/unit</p>
            {p.avgCostPerUnit !== null ? (
              <p className="text-sm font-semibold text-gray-900">{fmt.money(p.avgCostPerUnit)}</p>
            ) : p.hasRuns && p.noIngredients ? (
              <Link href="/dashboard/production" className="text-xs text-amber-600 hover:underline font-medium">
                Add ingredients →
              </Link>
            ) : p.hasRuns ? (
              <p className="text-xs text-gray-400">No cost data</p>
            ) : (
              <p className="text-xs text-gray-400">No runs yet</p>
            )}
          </div>

          {/* Profit per unit */}
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Profit/unit</p>
            {profitPerUnit !== null ? (
              <p className={`text-sm font-semibold ${profitPerUnit >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                {profitPerUnit >= 0 ? '' : '-'}{fmt.money(profitPerUnit)}
              </p>
            ) : (
              <p className="text-xs text-gray-400">
                {!p.hasSalePrice && !p.avgCostPerUnit ? 'Needs price + cost' : '—'}
              </p>
            )}
          </div>

          {/* Revenue this period */}
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Revenue</p>
            {p.hasSalesData ? (
              <p className="text-sm font-semibold text-gray-900">{fmt.money(p.totalRevenue)}</p>
            ) : (
              <p className="text-xs text-gray-400">No sales yet</p>
            )}
          </div>
        </div>

        {/* Secondary stats */}
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-400">
          {p.totalUnitsSold > 0 && <span>{fmt.num(p.totalUnitsSold)} sold</span>}
          {p.totalProduced > 0 && <span>{fmt.num(p.totalProduced)} produced</span>}
          {p.runCount > 0 && <span>{p.runCount} {p.runCount === 1 ? 'run' : 'runs'}</span>}
          {p.totalGivenAway > 0 && <span>{fmt.num(p.totalGivenAway)} given away</span>}
          {p.totalSpoiled > 0 && <span className="text-orange-500">{fmt.num(p.totalSpoiled)} spoiled</span>}
          {p.totalNotSold > 0 && <span className="text-orange-500">{fmt.num(p.totalNotSold)} unsold</span>}
        </div>

        {/* Missing data prompts */}
        {!p.hasRuns && !p.hasSalesData && (
          <p className="mt-3 text-xs text-gray-400 bg-gray-50 rounded-xl px-3 py-2 border border-gray-100">
            No activity in this period yet. Log a production run or a sale to start seeing data here.
          </p>
        )}
        {p.hasRuns && !p.hasSalesData && (
          <p className="mt-2 text-xs text-gray-400">
            Produced but no sales logged — use{' '}
            <button
              type="button"
              onClick={() =>
                window.dispatchEvent(
                  new CustomEvent('operbase:quick-log', { detail: { tab: 'sold', productName: p.productName } })
                )
              }
              className="underline hover:text-gray-600"
            >
              I sold
            </button>{' '}
            to record revenue.
          </p>
        )}
      </div>

      {/* Expanded variants */}
      {expanded && hasVariants && (
        <div className="border-t border-gray-100 px-4 py-3 space-y-1 bg-gray-50/60">
          <p className="text-xs font-medium text-gray-400 mb-2 uppercase tracking-wide">Variants</p>
          {p.variants.map(v => (
            <VariantRow key={v.variantId} v={v} fmt={fmt} currency={currency} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function InsightsPageClient({ initialData, businessId, timezone, currency }: Props) {
  const [data, setData]     = useState<InsightsData>(initialData)
  const [period, setPeriod] = useState<InsightsPeriod>('this_month')
  const [isLoading, setIsLoading] = useState(false)
  const supabase = useMemo(() => createClient(), [])
  const fmt = useFmt(currency)

  async function changePeriod(p: InsightsPeriod) {
    if (p === period) return
    setPeriod(p)
    setIsLoading(true)
    try {
      const d = await loadInsightsData(supabase, businessId, timezone, p, currency)
      setData(d)
    } catch {
      // keep showing old data
    } finally {
      setIsLoading(false)
    }
  }

  const { overview, byProduct, insightCards, periodLabel } = data

  const hasAnyActivity = overview.totalRevenue > 0 || overview.totalProduced > 0

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Insights</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          How your business is performing — {periodLabel}
        </p>
      </div>

      {/* Period selector */}
      <div className="flex flex-wrap gap-2">
        {PERIODS.map(per => (
          <button
            key={per.id}
            type="button"
            onClick={() => void changePeriod(per.id)}
            disabled={isLoading}
            className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
              period === per.id
                ? 'text-white border-transparent'
                : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
            }`}
            style={period === per.id ? { backgroundColor: 'var(--brand)' } : undefined}
          >
            {per.label}
          </button>
        ))}
        {isLoading && <Loader2 size={18} className="animate-spin text-gray-400 self-center ml-1" />}
      </div>

      {/* Empty state */}
      {!hasAnyActivity && (
        <div className="text-center py-16 text-gray-400">
          <TrendingUp size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium text-gray-500">Nothing logged in this period yet</p>
          <p className="text-sm mt-1">
            Log a production run or a sale to start seeing insights here.
          </p>
        </div>
      )}

      {hasAnyActivity && (
        <>
          {/* Overview KPIs */}
          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Overview</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KpiCard
                label="Revenue"
                value={overview.totalRevenue > 0 ? fmt.money(overview.totalRevenue) : '—'}
                sub={overview.totalUnitsSold > 0 ? `${fmt.num(overview.totalUnitsSold)} units sold` : undefined}
                dimmed={overview.totalRevenue === 0}
              />
              <KpiCard
                label="Production cost"
                value={overview.totalProductionCost > 0 ? fmt.money(overview.totalProductionCost) : '—'}
                sub={overview.totalProduced > 0 ? `${fmt.num(overview.totalProduced)} units made` : undefined}
                dimmed={overview.totalProductionCost === 0}
              />
              <KpiCard
                label="Gross profit"
                value={overview.totalRevenue > 0 ? fmt.money(overview.totalProfit) : '—'}
                sub={overview.hasCostGap ? 'Some COGS missing' : undefined}
                positive={overview.totalRevenue > 0 ? overview.totalProfit >= 0 : undefined}
                dimmed={overview.totalRevenue === 0}
              />
              <KpiCard
                label="Margin"
                value={fmt.pct(overview.marginPct)}
                sub={
                  overview.unsoldStockCost > 0
                    ? `${fmt.money(overview.unsoldStockCost)} unsold`
                    : undefined
                }
                positive={
                  overview.marginPct !== null
                    ? overview.marginPct >= 25
                    : undefined
                }
                dimmed={overview.marginPct === null}
              />
            </div>

            {/* Secondary overview stats */}
            {(overview.totalSpoiledUnits > 0 || overview.totalNotSoldUnits > 0 || overview.totalGivenAway > 0) && (
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-gray-500 bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
                {overview.totalSpoiledUnits > 0 && (
                  <span>
                    <span className="font-medium text-orange-600">{fmt.num(overview.totalSpoiledUnits)}</span> units spoiled
                    {overview.totalSpoiledCost > 0 && ` · ${fmt.money(overview.totalSpoiledCost)} lost`}
                  </span>
                )}
                {overview.totalNotSoldUnits > 0 && (
                  <span>
                    <span className="font-medium text-orange-600">{fmt.num(overview.totalNotSoldUnits)}</span> unsold
                    {overview.totalNotSoldCost > 0 && ` · ${fmt.money(overview.totalNotSoldCost)} stuck`}
                  </span>
                )}
                {overview.totalGivenAway > 0 && (
                  <span>
                    <span className="font-medium text-gray-600">{fmt.num(overview.totalGivenAway)}</span> given away
                  </span>
                )}
              </div>
            )}
          </section>

          {/* Insight cards */}
          {insightCards.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">What the data says</h2>
              <div className="space-y-3">
                {insightCards.map(card => (
                  <InsightCardItem key={card.id} card={card} />
                ))}
              </div>
            </section>
          )}

          {/* Per-product breakdown */}
          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">By product</h2>
            {byProduct.length === 0 ? (
              <p className="text-sm text-gray-400">No active products found.</p>
            ) : (
              <div className="space-y-3">
                {byProduct.map(p => (
                  <ProductRow key={p.productId} p={p} fmt={fmt} currency={currency} />
                ))}
              </div>
            )}

            {/* Missing sale price global prompt */}
            {byProduct.some(p => !p.hasSalePrice) && (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                <p className="font-medium">Some products have no sale price</p>
                <p className="mt-1 text-amber-700">
                  Without a price, it is impossible to calculate margin or know if you are making a profit.{' '}
                  <Link href="/dashboard/products" className="underline font-medium">
                    Set prices on the Products page →
                  </Link>
                </p>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
