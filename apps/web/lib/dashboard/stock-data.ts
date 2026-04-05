import type { SupabaseClient } from '@supabase/supabase-js'

const PAGE_SIZE = 50

const ITEM_SELECT = `
  *,
  purchase_unit:units!items_purchase_unit_id_fkey (id, name),
  usage_unit:units!items_usage_unit_id_fkey (id, name)
`

export type StockItemRow = {
  id: string
  name: string
  type: string
  unit_id: string | null
  purchase_unit_id: string | null
  usage_unit_id: string | null
  purchase_unit_name: string
  usage_unit_name: string
  conversion_ratio: number
  cost_per_unit: number
  quantity_on_hand: number
  low_stock_threshold: number | null
  notes: string | null
}

export type StockUnitRow = {
  id: string
  name: string
  type: string
}

export function mapItemsWithStockLevels(
  stockMap: Map<string, number>,
  itemsData: Record<string, unknown>[]
): StockItemRow[] {
  return itemsData.map((row) => {
    const purchaseUnit = row.purchase_unit as { name?: string } | null
    const usageUnit = row.usage_unit as { name?: string } | null
    return {
      id: row.id as string,
      name: row.name as string,
      type: row.type as string,
      unit_id: row.unit_id as string | null,
      purchase_unit_id: row.purchase_unit_id as string | null,
      usage_unit_id: row.usage_unit_id as string | null,
      purchase_unit_name: purchaseUnit?.name ?? '—',
      usage_unit_name: usageUnit?.name ?? '—',
      conversion_ratio: Number(row.conversion_ratio ?? 1),
      cost_per_unit: Number(row.cost_per_unit ?? 0),
      quantity_on_hand: stockMap.get(row.id as string) ?? 0,
      low_stock_threshold:
        row.low_stock_threshold != null ? Number(row.low_stock_threshold) : null,
      notes: row.notes as string | null,
    }
  })
}

export async function loadStockInitial(
  supabase: SupabaseClient,
  businessId: string,
  activeTab: 'ingredient' | 'packaging' = 'ingredient'
): Promise<{ items: StockItemRow[]; units: StockUnitRow[] }> {
  const [unitsRes, itemsRes, stockRes] = await Promise.all([
    supabase.from('units').select('id, name, type').order('name'),
    supabase
      .from('items')
      .select(ITEM_SELECT)
      .eq('business_id', businessId)
      .eq('type', activeTab)
      .range(0, PAGE_SIZE - 1)
      .order('name'),
    supabase.from('stock_levels').select('item_id, quantity_on_hand').eq('business_id', businessId),
  ])

  const stockMap = new Map(
    (stockRes.data ?? []).map((s) => [s.item_id, Number(s.quantity_on_hand ?? 0)])
  )

  const items = mapItemsWithStockLevels(stockMap, (itemsRes.data ?? []) as Record<string, unknown>[])

  return {
    items,
    units: (unitsRes.data ?? []) as StockUnitRow[],
  }
}
