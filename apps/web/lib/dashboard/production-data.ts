import type { SupabaseClient } from '@supabase/supabase-js'

export type ProductionBatchRow = {
  id: string
  product_id: string | null
  product_name: string
  units_produced: number
  units_remaining: number
  /** Samples, waste, gifts at make time — not for sale (still part of production cost). */
  units_given_away: number
  /** Sold from this run (also reflected in lower remaining). */
  units_sold_from_batch: number
  /** Marked went bad after production. */
  units_spoiled: number
  /** Given out after production (not at make time). */
  units_given_out_extra: number
  /** Written off as didn’t sell — cost won’t come back. */
  units_not_sold_loss: number
  cost_of_goods: number | null
  notes: string | null
  produced_at: string
  has_inventory_lines: boolean
  /** Sum of sale revenue logged against this run. */
  revenue_from_batch: number
}

export type ProductionStockItemRow = {
  id: string
  name: string
  type: string
  usage_unit_name: string
  /** Rolling average in recipe units; 0 if not yet calculated */
  avg_cost_per_usage_unit: number
  cost_per_unit: number
  conversion_ratio: number
}

function mapBatchRow(
  b: Record<string, unknown>,
  revenueFromBatch: number
): ProductionBatchRow {
  const products = b.products as { name?: string } | null
  const bi = b.batch_items as { id: string }[] | null
  const notes = b.notes as string | null
  return {
    id: b.id as string,
    product_id: (b.product_id as string | null) ?? null,
    product_name: products?.name ?? notes ?? 'Unnamed batch',
    units_produced: Number(b.units_produced),
    units_remaining: Number(b.units_remaining),
    units_given_away: b.units_given_away != null ? Number(b.units_given_away) : 0,
    units_sold_from_batch:
      b.units_sold_from_batch != null ? Number(b.units_sold_from_batch) : 0,
    units_spoiled: b.units_spoiled != null ? Number(b.units_spoiled) : 0,
    units_given_out_extra:
      b.units_given_out_extra != null ? Number(b.units_given_out_extra) : 0,
    units_not_sold_loss:
      b.units_not_sold_loss != null ? Number(b.units_not_sold_loss) : 0,
    cost_of_goods: b.cost_of_goods != null ? Number(b.cost_of_goods) : null,
    notes,
    produced_at: b.produced_at as string,
    has_inventory_lines: Array.isArray(bi) && bi.length > 0,
    revenue_from_batch: revenueFromBatch,
  }
}

export async function loadProductionInitial(
  supabase: SupabaseClient,
  businessId: string
): Promise<{ batches: ProductionBatchRow[]; stockItems: ProductionStockItemRow[] }> {
  const [batchesRes, stockRes, salesRes] = await Promise.all([
    supabase
      .from('batches')
      .select('*, products(name), batch_items(id)')
      .eq('business_id', businessId)
      .order('produced_at', { ascending: false }),
    supabase
      .from('items')
      .select(
        `
        id, name, type,
        cost_per_unit, conversion_ratio, avg_cost_per_usage_unit,
        usage_unit:units!items_usage_unit_id_fkey (name)
      `
      )
      .eq('business_id', businessId)
      .order('name'),
    supabase
      .from('sales')
      .select('batch_id, revenue')
      .eq('business_id', businessId)
      .not('batch_id', 'is', null),
  ])

  const revenueByBatch = new Map<string, number>()
  for (const row of salesRes.data ?? []) {
    const r = row as { batch_id: string | null; revenue: number | string | null }
    if (!r.batch_id || r.revenue == null) continue
    const prev = revenueByBatch.get(r.batch_id) ?? 0
    revenueByBatch.set(r.batch_id, prev + Number(r.revenue))
  }

  const batches: ProductionBatchRow[] = (batchesRes.data ?? []).map((b: Record<string, unknown>) =>
    mapBatchRow(b, revenueByBatch.get(b.id as string) ?? 0)
  )

  const stockItems: ProductionStockItemRow[] = (stockRes.data ?? []).map(
    (row: Record<string, unknown>) => {
      const uu = row.usage_unit as { name?: string } | null
      return {
        id: row.id as string,
        name: row.name as string,
        type: row.type as string,
        usage_unit_name: uu?.name ?? '',
        avg_cost_per_usage_unit: Number(row.avg_cost_per_usage_unit ?? 0),
        cost_per_unit: Number(row.cost_per_unit ?? 0),
        conversion_ratio: Number(row.conversion_ratio ?? 1),
      }
    }
  )

  return { batches, stockItems }
}
