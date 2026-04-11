import type { SupabaseClient } from '@supabase/supabase-js'

export type ProductVariantRow = {
  id: string
  name: string
  sort_order: number
  cost_per_unit: number | null      // manually entered
  avgCostPerUnit: number | null     // computed from actual batch runs
  runCount: number                  // how many runs contributed
}

export type ProductAddonRow = {
  id: string
  name: string
  extra_cost: number | null
  sort_order: number
}

export type ProductCatalogRow = {
  id: string
  name: string
  sale_price: number
  is_active: boolean
  created_at: string
  variants: ProductVariantRow[]
  addons: ProductAddonRow[]
  avgCostPerUnit: number | null     // product-level avg (all runs, all variants combined)
  runCount: number
}

// ── Batch cost averages ───────────────────────────────────────────────────────

type CostRow = {
  product_id: string
  variant_id: string | null
  avg_cost_per_unit: number
  run_count: number
}

async function loadBatchCosts(
  supabase: SupabaseClient,
  businessId: string
): Promise<CostRow[]> {
  // Pull all batches with cost data, group in JS (PostgREST doesn't do GROUP BY)
  // Only include batches where ingredient costs were actually tracked (cost_of_goods > 0).
  // Batches logged without ingredient lines store cost_of_goods = 0 and must be excluded
  // so they don't dilute the average with false zeros.
  const { data, error } = await supabase
    .from('batches')
    .select('product_id, variant_id, cost_of_goods, units_produced')
    .eq('business_id', businessId)
    .gt('cost_of_goods', 0)
    .gt('units_produced', 0)

  if (error) throw error

  type BatchRow = { product_id: string; variant_id: string | null; cost_of_goods: number; units_produced: number }
  const rows = (data ?? []) as BatchRow[]

  // Key: `productId::variantId` or `productId::` for no variant
  const map = new Map<string, { totalCost: number; totalUnits: number; runCount: number }>()

  for (const row of rows) {
    const key = `${row.product_id}::${row.variant_id ?? ''}`
    const existing = map.get(key)
    const cost = Number(row.cost_of_goods)
    const units = Number(row.units_produced)
    if (existing) {
      existing.totalCost += cost
      existing.totalUnits += units
      existing.runCount += 1
    } else {
      map.set(key, { totalCost: cost, totalUnits: units, runCount: 1 })
    }
  }

  const result: CostRow[] = []
  for (const [key, val] of map.entries()) {
    const [productId, variantId] = key.split('::')
    result.push({
      product_id: productId,
      variant_id: variantId || null,
      avg_cost_per_unit: val.totalUnits > 0 ? val.totalCost / val.totalUnits : 0,
      run_count: val.runCount,
    })
  }
  return result
}

// ── Main loader ───────────────────────────────────────────────────────────────

export async function loadProductCatalog(
  supabase: SupabaseClient,
  businessId: string
): Promise<ProductCatalogRow[]> {
  const [catalogRes, costRows] = await Promise.all([
    supabase
      .from('products')
      .select(`
        id, name, sale_price, is_active, created_at,
        product_variants(id, name, sort_order, cost_per_unit),
        product_addons(id, name, extra_cost, sort_order)
      `)
      .eq('business_id', businessId)
      .eq('is_active', true)
      .order('name'),
    loadBatchCosts(supabase, businessId),
  ])

  if (catalogRes.error) throw catalogRes.error

  // Build lookup maps
  // productId -> { avg, runs } for unvariant batches
  // variantId -> { avg, runs }
  const productCosts = new Map<string, { avg: number; runs: number }>()
  const variantCosts = new Map<string, { avg: number; runs: number }>()

  for (const c of costRows) {
    if (c.variant_id) {
      variantCosts.set(c.variant_id, { avg: c.avg_cost_per_unit, runs: c.run_count })
    } else {
      productCosts.set(c.product_id, { avg: c.avg_cost_per_unit, runs: c.run_count })
    }
  }

  return (catalogRes.data ?? []).map((p: Record<string, unknown>) => {
    const productId = p.id as string
    const variants = ((p.product_variants as (ProductVariantRow & { sort_order: number })[] | null) ?? [])
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((v) => {
        const vc = variantCosts.get(v.id)
        return {
          ...v,
          cost_per_unit: v.cost_per_unit ?? null,
          avgCostPerUnit: vc ? vc.avg : null,
          runCount: vc ? vc.runs : 0,
        }
      })

    // Product-level avg: if variants exist, average across all variant costs;
    // otherwise use the product-level (no-variant) cost row
    let productAvg: number | null = null
    let productRuns = 0
    if (variants.length > 0) {
      const costsWithData = variants.filter((v) => v.avgCostPerUnit != null)
      if (costsWithData.length > 0) {
        productAvg = costsWithData.reduce((s, v) => s + (v.avgCostPerUnit ?? 0), 0) / costsWithData.length
        productRuns = costsWithData.reduce((s, v) => s + v.runCount, 0)
      }
    } else {
      const pc = productCosts.get(productId)
      if (pc) { productAvg = pc.avg; productRuns = pc.runs }
    }

    return {
      id: productId,
      name: p.name as string,
      sale_price: Number(p.sale_price ?? 0),
      is_active: p.is_active as boolean,
      created_at: p.created_at as string,
      variants,
      addons: ((p.product_addons as ProductAddonRow[] | null) ?? [])
        .slice()
        .sort((a, b) => a.sort_order - b.sort_order),
      avgCostPerUnit: productAvg,
      runCount: productRuns,
    }
  })
}
