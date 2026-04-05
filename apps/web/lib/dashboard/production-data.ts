import type { SupabaseClient } from '@supabase/supabase-js'

export type ProductionBatchRow = {
  id: string
  product_name: string
  units_produced: number
  units_remaining: number
  cost_of_goods: number | null
  notes: string | null
  produced_at: string
  has_inventory_lines: boolean
}

export type ProductionStockItemRow = {
  id: string
  name: string
  type: string
  usage_unit_name: string
}

export async function loadProductionInitial(
  supabase: SupabaseClient,
  businessId: string
): Promise<{ batches: ProductionBatchRow[]; stockItems: ProductionStockItemRow[] }> {
  const [batchesRes, stockRes] = await Promise.all([
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
        usage_unit:units!items_usage_unit_id_fkey (name)
      `
      )
      .eq('business_id', businessId)
      .order('name'),
  ])

  const batches: ProductionBatchRow[] = (batchesRes.data ?? []).map((b: Record<string, unknown>) => {
    const products = b.products as { name?: string } | null
    const bi = b.batch_items as { id: string }[] | null
    const notes = b.notes as string | null
    return {
      id: b.id as string,
      product_name: products?.name ?? notes ?? 'Unnamed batch',
      units_produced: Number(b.units_produced),
      units_remaining: Number(b.units_remaining),
      cost_of_goods: b.cost_of_goods != null ? Number(b.cost_of_goods) : null,
      notes,
      produced_at: b.produced_at as string,
      has_inventory_lines: Array.isArray(bi) && bi.length > 0,
    }
  })

  const stockItems: ProductionStockItemRow[] = (stockRes.data ?? []).map(
    (row: Record<string, unknown>) => {
      const uu = row.usage_unit as { name?: string } | null
      return {
        id: row.id as string,
        name: row.name as string,
        type: row.type as string,
        usage_unit_name: uu?.name ?? '—',
      }
    }
  )

  return { batches, stockItems }
}
