import type { SupabaseClient } from '@supabase/supabase-js'

export type ProductVariantRow = {
  id: string
  name: string
  sort_order: number
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
}

export async function loadProductCatalog(
  supabase: SupabaseClient,
  businessId: string
): Promise<ProductCatalogRow[]> {
  const { data, error } = await supabase
    .from('products')
    .select(`
      id, name, sale_price, is_active, created_at,
      product_variants(id, name, sort_order),
      product_addons(id, name, extra_cost, sort_order)
    `)
    .eq('business_id', businessId)
    .eq('is_active', true)
    .order('name')

  if (error) throw error

  return (data ?? []).map((p: Record<string, unknown>) => ({
    id: p.id as string,
    name: p.name as string,
    sale_price: Number(p.sale_price ?? 0),
    is_active: p.is_active as boolean,
    created_at: p.created_at as string,
    variants: ((p.product_variants as ProductVariantRow[] | null) ?? [])
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order),
    addons: ((p.product_addons as ProductAddonRow[] | null) ?? [])
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order),
  }))
}
