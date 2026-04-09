import type { SupabaseClient } from '@supabase/supabase-js'

// ── Types ─────────────────────────────────────────────────────────────────────

export type InsightsPeriod = 'this_month' | 'last_month' | 'last_3_months' | 'all_time'

export type InsightCard = {
  id: string
  type: 'good' | 'warning' | 'danger' | 'info' | 'action'
  title: string
  body: string
  action?: { label: string; href: string }
}

export type VariantInsightRow = {
  variantId: string
  variantName: string
  // Sales
  totalRevenue: number
  totalUnitsSold: number
  saleCount: number
  totalCogs: number
  cogsIsReal: boolean       // false if all sales had null cogs
  totalProfit: number
  marginPct: number | null  // (profit / revenue) * 100
  // Production
  avgCostPerUnit: number | null
  totalProduced: number
  runCount: number
  noIngredients: boolean    // runs exist but all had cost_of_goods = 0
  // Waste
  totalSpoiled: number
  totalNotSold: number
  totalGivenAway: number
}

export type ProductInsightRow = {
  productId: string
  productName: string
  salePrice: number
  // Sales
  totalRevenue: number
  totalUnitsSold: number
  saleCount: number
  totalCogs: number
  cogsIsReal: boolean
  totalProfit: number
  marginPct: number | null
  // Production
  avgCostPerUnit: number | null
  totalProduced: number
  runCount: number
  noIngredients: boolean
  // Waste
  totalSpoiled: number
  totalNotSold: number
  totalGivenAway: number
  wasteRate: number | null  // (spoiled + notSold) / produced * 100
  // Variants
  variants: VariantInsightRow[]
  // Flags — drive the "what you need to input" prompts
  hasSalePrice: boolean
  hasRuns: boolean
  hasSalesData: boolean
  hasCostData: boolean      // at least one batch had cost_of_goods > 0
}

export type InsightsOverview = {
  totalRevenue: number
  totalCogs: number              // cost of the units actually sold
  totalProfit: number
  marginPct: number | null
  totalUnitsSold: number
  totalProduced: number
  totalProductionCost: number    // sum of all batch cost_of_goods this period
  unsoldStockCost: number        // still on shelf from this period's batches
  totalSpoiledUnits: number
  totalSpoiledCost: number       // estimated: spoiledUnits * avgCostPerUnit
  totalNotSoldUnits: number
  totalNotSoldCost: number
  totalGivenAway: number
  hasCostGap: boolean            // some sales missing cogs
}

export type InsightsData = {
  period: InsightsPeriod
  periodLabel: string
  overview: InsightsOverview
  byProduct: ProductInsightRow[]
  insightCards: InsightCard[]
}

// ── Period bounds ─────────────────────────────────────────────────────────────

type PeriodBounds = { from: string | null; to: string | null; label: string }

export function getPeriodBounds(period: InsightsPeriod, timezone: string): PeriodBounds {
  if (period === 'all_time') return { from: null, to: null, label: 'All time' }

  const now = new Date()

  // Get current year + month in business timezone
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone, year: 'numeric', month: '2-digit',
  }).formatToParts(now)
  const year  = Number(parts.find(p => p.type === 'year')!.value)
  const month = Number(parts.find(p => p.type === 'month')!.value)

  // UTC ISO string for midnight on the 1st of a given month in the business timezone
  function monthStartUtc(y: number, m: number): string {
    const refUtc = new Date(Date.UTC(y, m - 1, 1, 12, 0, 0))
    const localMs  = new Date(refUtc.toLocaleString('en-US', { timeZone: timezone })).getTime()
    const offsetMs = refUtc.getTime() - localMs
    return new Date(Date.UTC(y, m - 1, 1, 0, 0, 0) + offsetMs).toISOString()
  }

  function nextMonth(y: number, m: number) {
    return m === 12 ? { y: y + 1, m: 1 } : { y, m: m + 1 }
  }
  function prevMonth(y: number, m: number, n = 1) {
    let y2 = y, m2 = m - n
    while (m2 <= 0) { m2 += 12; y2-- }
    return { y: y2, m: m2 }
  }

  if (period === 'this_month') {
    const { y: ny, m: nm } = nextMonth(year, month)
    const label = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: timezone }).format(now)
    return { from: monthStartUtc(year, month), to: monthStartUtc(ny, nm), label }
  }

  if (period === 'last_month') {
    const { y: py, m: pm } = prevMonth(year, month)
    const d = new Date(Date.UTC(py, pm - 1, 15))
    const label = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: timezone }).format(d)
    return { from: monthStartUtc(py, pm), to: monthStartUtc(year, month), label }
  }

  if (period === 'last_3_months') {
    const { y: py, m: pm } = prevMonth(year, month, 3)
    const { y: ny, m: nm } = nextMonth(year, month)
    return { from: monthStartUtc(py, pm), to: monthStartUtc(ny, nm), label: 'Last 3 months' }
  }

  return { from: null, to: null, label: 'All time' }
}

// ── Insight card generator ────────────────────────────────────────────────────

function buildInsightCards(
  products: ProductInsightRow[],
  overview: InsightsOverview,
  currency: string
): InsightCard[] {
  const cards: InsightCard[] = []
  const fmt = (n: number) => `${currency}${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`

  // 1. Selling below cost (DANGER — most important)
  const lossMakers = products.filter(p => p.marginPct !== null && p.marginPct < 0 && p.hasSalesData)
  for (const p of lossMakers) {
    const lossPerUnit = p.avgCostPerUnit && p.salePrice
      ? fmt(p.avgCostPerUnit - p.salePrice)
      : ''
    cards.push({
      id: `loss-${p.productId}`,
      type: 'danger',
      title: `${p.productName} is sold below cost`,
      body: `Every unit you sell loses money${lossPerUnit ? ` (${lossPerUnit} per unit)` : ''}. Either your price is too low or production costs are higher than expected. Review your ingredients and pricing.`,
      action: { label: 'Update price', href: '/dashboard/products' },
    })
  }

  // 2. Best margin product (GOOD)
  const withMargin = products.filter(p => p.marginPct !== null && p.hasSalesData && p.hasCostData)
  if (withMargin.length > 0) {
    const best = withMargin.reduce((a, b) => (a.marginPct ?? 0) > (b.marginPct ?? 0) ? a : b)
    if ((best.marginPct ?? 0) > 0) {
      cards.push({
        id: 'best-margin',
        type: 'good',
        title: `${best.productName} is your best earner`,
        body: `${best.marginPct!.toFixed(0)}% margin — for every ${fmt(best.salePrice || 0)} you charge, ${fmt((best.salePrice || 0) * best.marginPct! / 100)} is pure profit. Focus on selling more of this.`,
      })
    }
  }

  // 3. Low margin warning
  const tightMargin = products.filter(
    p => p.marginPct !== null && p.marginPct >= 0 && p.marginPct < 25 && p.hasSalesData && p.hasCostData
  )
  for (const p of tightMargin) {
    cards.push({
      id: `tight-${p.productId}`,
      type: 'warning',
      title: `${p.productName} has a thin margin`,
      body: `Only ${p.marginPct!.toFixed(0)}% margin. A small rise in ingredient costs could tip this into a loss. Consider raising your price or reducing production cost.`,
      action: { label: 'Review pricing', href: '/dashboard/products' },
    })
  }

  // 4. High waste (WARNING)
  const highWaste = products.filter(p => p.wasteRate !== null && p.wasteRate > 10 && p.totalProduced > 0)
  for (const p of highWaste) {
    const wastedCost = p.avgCostPerUnit
      ? fmt((p.totalSpoiled + p.totalNotSold) * p.avgCostPerUnit)
      : null
    cards.push({
      id: `waste-${p.productId}`,
      type: 'warning',
      title: `${p.wasteRate!.toFixed(0)}% of your ${p.productName} is wasted`,
      body: `${p.totalSpoiled + p.totalNotSold} units spoiled or unsold${wastedCost ? `, costing you ${wastedCost}` : ''}. Make smaller batches more often, or push harder on sales before end of day.`,
    })
  }

  // 5. Missing sale prices (ACTION)
  const noPrice = products.filter(p => !p.hasSalePrice && p.hasRuns)
  if (noPrice.length > 0) {
    const names = noPrice.slice(0, 2).map(p => p.productName).join(', ')
    const more  = noPrice.length > 2 ? ` and ${noPrice.length - 2} more` : ''
    cards.push({
      id: 'no-price',
      type: 'action',
      title: `Add prices to see your margins`,
      body: `${names}${more} ${noPrice.length === 1 ? 'has' : 'have'} no sale price set. Without a price, it is impossible to calculate margin or know if you are making a profit.`,
      action: { label: 'Set prices on Products', href: '/dashboard/products' },
    })
  }

  // 6. No ingredient tracking (ACTION)
  const noIngredients = products.filter(p => p.noIngredients && p.hasRuns)
  if (noIngredients.length > 0) {
    const names = noIngredients.slice(0, 2).map(p => p.productName).join(', ')
    const more  = noIngredients.length > 2 ? ` and ${noIngredients.length - 2} more` : ''
    cards.push({
      id: 'no-ingredients',
      type: 'action',
      title: `Track ingredients to see real production cost`,
      body: `${names}${more} ${noIngredients.length === 1 ? 'has' : 'have'} production runs but no ingredients logged. Without ingredients, the cost shown is zero — your margins look better than they really are.`,
      action: { label: 'Log ingredients on Production', href: '/dashboard/production' },
    })
  }

  // 7. Unsold stock (INFO)
  if (overview.unsoldStockCost > 0) {
    cards.push({
      id: 'unsold',
      type: 'info',
      title: `${fmt(overview.unsoldStockCost)} sitting unsold on your shelf`,
      body: `That is money you spent on ingredients that has not come back yet. Push sales of existing stock before making more — otherwise your cash stays locked up.`,
      action: { label: 'See production runs', href: '/dashboard/production' },
    })
  }

  // 8. Overall good performance
  if (overview.marginPct !== null && overview.marginPct >= 50 && overview.totalRevenue > 0) {
    cards.push({
      id: 'overall-good',
      type: 'good',
      title: `Solid overall: ${overview.marginPct.toFixed(0)}% margin`,
      body: `You kept ${fmt(overview.totalProfit)} from ${fmt(overview.totalRevenue)} in revenue. That is a healthy business. Keep your ingredient costs under control to maintain it.`,
    })
  }

  // Deduplicate and limit to 6 most important
  const priority = ['danger', 'action', 'warning', 'good', 'info']
  return cards
    .sort((a, b) => priority.indexOf(a.type) - priority.indexOf(b.type))
    .slice(0, 6)
}

// ── Main loader ───────────────────────────────────────────────────────────────

export async function loadInsightsData(
  supabase: SupabaseClient,
  businessId: string,
  timezone: string,
  period: InsightsPeriod,
  currency: string
): Promise<InsightsData> {
  const { from, to, label } = getPeriodBounds(period, timezone)

  // Build filtered queries
  function applySalesFilter(q: ReturnType<typeof supabase.from>) {
    let r = q.eq('business_id', businessId)
    if (from) r = r.gte('sold_at', from)
    if (to)   r = r.lt('sold_at', to)
    return r
  }
  function applyBatchFilter(q: ReturnType<typeof supabase.from>) {
    let r = q.eq('business_id', businessId)
    if (from) r = r.gte('produced_at', from)
    if (to)   r = r.lt('produced_at', to)
    return r
  }

  const [salesRes, batchesRes, productsRes] = await Promise.all([
    applySalesFilter(
      supabase.from('sales').select(
        'product_id, variant_id, revenue, cogs, gross_profit, units_sold, unit_price'
      )
    ),
    applyBatchFilter(
      supabase.from('batches').select(
        'product_id, variant_id, units_produced, units_remaining, units_sold_from_batch, units_given_away, units_given_out_extra, units_spoiled, units_not_sold_loss, cost_of_goods'
      )
    ),
    supabase.from('products')
      .select('id, name, sale_price, product_variants(id, name, sort_order)')
      .eq('business_id', businessId)
      .eq('is_active', true)
      .order('name'),
  ])

  if (salesRes.error)    throw salesRes.error
  if (batchesRes.error)  throw batchesRes.error
  if (productsRes.error) throw productsRes.error

  type SaleRow = {
    product_id: string; variant_id: string | null
    revenue: number; cogs: number | null; gross_profit: number | null; units_sold: number
  }
  type BatchRow = {
    product_id: string; variant_id: string | null
    units_produced: number; units_remaining: number; units_given_away: number
    units_given_out_extra: number; units_spoiled: number; units_not_sold_loss: number
    cost_of_goods: number | null
  }
  type ProductRow = {
    id: string; name: string; sale_price: number | null
    product_variants: { id: string; name: string; sort_order: number }[] | null
  }

  const sales    = (salesRes.data    ?? []) as SaleRow[]
  const batches  = (batchesRes.data  ?? []) as BatchRow[]
  const products = (productsRes.data ?? []) as ProductRow[]

  // Aggregate sales by product+variant
  type SalesAgg = { revenue: number; unitsSold: number; cogs: number; profit: number; count: number; hasNullCogs: boolean }
  const salesByKey = new Map<string, SalesAgg>()

  for (const s of sales) {
    const key  = `${s.product_id}::${s.variant_id ?? ''}`
    const pkey = `${s.product_id}::`
    for (const k of [key, ...(s.variant_id ? [pkey] : [])]) {
      const e = salesByKey.get(k) ?? { revenue: 0, unitsSold: 0, cogs: 0, profit: 0, count: 0, hasNullCogs: false }
      e.revenue   += Number(s.revenue ?? 0)
      e.unitsSold += Number(s.units_sold ?? 0)
      e.cogs      += Number(s.cogs ?? 0)
      e.profit    += Number(s.gross_profit ?? 0)
      e.count     += 1
      if (s.cogs == null) e.hasNullCogs = true
      salesByKey.set(k, e)
    }
  }

  // Aggregate batches by product+variant
  type BatchAgg = {
    totalProduced: number; totalRemaining: number; totalCog: number; runCount: number
    totalSpoiled: number; totalNotSold: number; totalGivenAway: number; allZeroCog: boolean
  }
  const batchByKey = new Map<string, BatchAgg>()

  for (const b of batches) {
    const key  = `${b.product_id}::${b.variant_id ?? ''}`
    const pkey = `${b.product_id}::`
    for (const k of [key, ...(b.variant_id ? [pkey] : [])]) {
      const e = batchByKey.get(k) ?? { totalProduced: 0, totalRemaining: 0, totalCog: 0, runCount: 0, totalSpoiled: 0, totalNotSold: 0, totalGivenAway: 0, allZeroCog: true }
      e.totalProduced   += Number(b.units_produced ?? 0)
      e.totalRemaining  += Number(b.units_remaining ?? 0)
      e.totalCog        += Number(b.cost_of_goods ?? 0)
      e.runCount        += 1
      e.totalSpoiled    += Number(b.units_spoiled ?? 0)
      e.totalNotSold    += Number(b.units_not_sold_loss ?? 0)
      e.totalGivenAway  += Number(b.units_given_away ?? 0) + Number(b.units_given_out_extra ?? 0)
      if (Number(b.cost_of_goods ?? 0) > 0) e.allZeroCog = false
      batchByKey.set(k, e)
    }
  }

  // Build per-product rows
  const byProduct: ProductInsightRow[] = products.map((p) => {
    const pkey = `${p.id}::`
    const sa   = salesByKey.get(pkey)
    const ba   = batchByKey.get(pkey)
    const salePriceNum = Number(p.sale_price ?? 0)

    const avgCpu = ba && ba.totalProduced > 0 ? ba.totalCog / ba.totalProduced : null
    const marginPct = sa && sa.revenue > 0 ? (sa.profit / sa.revenue) * 100 : null
    const wasteRate = ba && ba.totalProduced > 0
      ? ((ba.totalSpoiled + ba.totalNotSold) / ba.totalProduced) * 100
      : null

    const unsoldCost = ba && avgCpu ? ba.totalRemaining * avgCpu : 0

    const variants: VariantInsightRow[] = ((p.product_variants ?? []) as { id: string; name: string; sort_order: number }[])
      .slice().sort((a, b) => a.sort_order - b.sort_order)
      .map((v) => {
        const vkey = `${p.id}::${v.id}`
        const vs   = salesByKey.get(vkey)
        const vb   = batchByKey.get(vkey)
        const vAvg = vb && vb.totalProduced > 0 ? vb.totalCog / vb.totalProduced : null
        return {
          variantId:       v.id,
          variantName:     v.name,
          totalRevenue:    vs?.revenue   ?? 0,
          totalUnitsSold:  vs?.unitsSold ?? 0,
          saleCount:       vs?.count     ?? 0,
          totalCogs:       vs?.cogs      ?? 0,
          cogsIsReal:      !!vs && !vs.hasNullCogs && vs.cogs > 0,
          totalProfit:     vs?.profit    ?? 0,
          marginPct:       vs && vs.revenue > 0 ? (vs.profit / vs.revenue) * 100 : null,
          avgCostPerUnit:  vAvg,
          totalProduced:   vb?.totalProduced  ?? 0,
          runCount:        vb?.runCount       ?? 0,
          noIngredients:   !!vb && vb.allZeroCog,
          totalSpoiled:    vb?.totalSpoiled   ?? 0,
          totalNotSold:    vb?.totalNotSold   ?? 0,
          totalGivenAway:  vb?.totalGivenAway ?? 0,
        }
      })

    return {
      productId:      p.id,
      productName:    p.name,
      salePrice:      salePriceNum,
      totalRevenue:   sa?.revenue   ?? 0,
      totalUnitsSold: sa?.unitsSold ?? 0,
      saleCount:      sa?.count     ?? 0,
      totalCogs:      sa?.cogs      ?? 0,
      cogsIsReal:     !!sa && !sa.hasNullCogs && sa.cogs > 0,
      totalProfit:    sa?.profit    ?? 0,
      marginPct,
      avgCostPerUnit: avgCpu,
      totalProduced:  ba?.totalProduced  ?? 0,
      runCount:       ba?.runCount       ?? 0,
      noIngredients:  !!ba && ba.allZeroCog,
      totalSpoiled:   ba?.totalSpoiled   ?? 0,
      totalNotSold:   ba?.totalNotSold   ?? 0,
      totalGivenAway: ba?.totalGivenAway ?? 0,
      wasteRate,
      variants,
      hasSalePrice:  salePriceNum > 0,
      hasRuns:       (ba?.runCount ?? 0) > 0,
      hasSalesData:  (sa?.count    ?? 0) > 0,
      hasCostData:   !!ba && !ba.allZeroCog,
    }
  })

  // Also catch products that appear in sales/batches but not in catalog (shouldn't happen but defensive)
  // Build overview
  const totalRevenue = sales.reduce((s, r) => s + Number(r.revenue ?? 0), 0)
  const totalCogs    = sales.reduce((s, r) => s + Number(r.cogs ?? 0), 0)
  const totalProfit  = sales.reduce((s, r) => s + Number(r.gross_profit ?? 0), 0)
  const hasCostGap   = sales.some(r => r.cogs == null)

  const totalProduced       = batches.reduce((s, b) => s + Number(b.units_produced ?? 0), 0)
  const totalProductionCost = batches.reduce((s, b) => s + Number(b.cost_of_goods ?? 0), 0)
  const totalSpoiledUnits   = batches.reduce((s, b) => s + Number(b.units_spoiled ?? 0), 0)
  const totalNotSoldUnits   = batches.reduce((s, b) => s + Number(b.units_not_sold_loss ?? 0), 0)
  const totalGivenAway      = batches.reduce((s, b) => s + Number(b.units_given_away ?? 0) + Number(b.units_given_out_extra ?? 0), 0)

  // Estimate spoiled/not-sold cost using avg cost across all batches
  const globalAvgCpu = totalProduced > 0 ? totalProductionCost / totalProduced : 0
  const totalSpoiledCost  = totalSpoiledUnits  * globalAvgCpu
  const totalNotSoldCost  = totalNotSoldUnits  * globalAvgCpu

  // Unsold stock from this period's batches
  const unsoldStockCost = byProduct.reduce((s, p) => {
    const ba = batchByKey.get(`${p.productId}::`)
    const cpu = p.avgCostPerUnit
    if (!ba || !cpu) return s
    return s + ba.totalRemaining * cpu
  }, 0)

  const overview: InsightsOverview = {
    totalRevenue,
    totalCogs,
    totalProfit,
    marginPct: totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : null,
    totalUnitsSold: sales.reduce((s, r) => s + Number(r.units_sold ?? 0), 0),
    totalProduced,
    totalProductionCost,
    unsoldStockCost,
    totalSpoiledUnits,
    totalSpoiledCost,
    totalNotSoldUnits,
    totalNotSoldCost,
    totalGivenAway,
    hasCostGap,
  }

  const insightCards = buildInsightCards(byProduct, overview, currency)

  return { period, periodLabel: label, overview, byProduct, insightCards }
}
