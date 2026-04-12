import type { SupabaseClient } from '@supabase/supabase-js'

export type RecipeItem = {
  id: string
  item_id: string
  item_name: string
  usage_unit_name: string
  quantity: number
  notes: string | null
}

export type Recipe = {
  id: string
  business_id: string
  product_id: string
  variant_id: string | null
  name: string
  yield_quantity: number
  notes: string | null
  created_at: string
  items: RecipeItem[]
}

export type RecipeExpectedCost = {
  recipe_id: string
  recipe_name: string
  yield_quantity: number
  expected_cost_per_yield: number
  expected_cost_per_unit: number
  ingredient_count: number
}

/** Fetch all recipes for a product (optionally filtered to a specific variant) */
export async function fetchRecipesForProduct(
  supabase: SupabaseClient,
  businessId: string,
  productId: string,
): Promise<Recipe[]> {
  const { data, error } = await supabase
    .from('recipes')
    .select(`
      id, business_id, product_id, variant_id, name, yield_quantity, notes, created_at,
      recipe_items (
        id, item_id, quantity, notes,
        items ( name, usage_unit:units!items_usage_unit_id_fkey (name) )
      )
    `)
    .eq('business_id', businessId)
    .eq('product_id', productId)
    .order('created_at', { ascending: true })

  if (error) throw error

  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    business_id: r.business_id as string,
    product_id: r.product_id as string,
    variant_id: r.variant_id as string | null,
    name: r.name as string,
    yield_quantity: Number(r.yield_quantity),
    notes: r.notes as string | null,
    created_at: r.created_at as string,
    items: ((r.recipe_items as Record<string, unknown>[]) ?? []).map((ri) => {
      const item = ri.items as Record<string, unknown> | null
      const unit = item?.usage_unit as Record<string, unknown> | null
      return {
        id: ri.id as string,
        item_id: ri.item_id as string,
        item_name: (item?.name as string) ?? '',
        usage_unit_name: (unit?.name as string) ?? '',
        quantity: Number(ri.quantity),
        notes: ri.notes as string | null,
      }
    }),
  }))
}

/** Fetch expected costs for all recipes for a product from the view */
export async function fetchRecipeExpectedCosts(
  supabase: SupabaseClient,
  businessId: string,
  productId: string,
): Promise<RecipeExpectedCost[]> {
  const { data, error } = await supabase
    .from('recipe_expected_costs')
    .select('recipe_id, recipe_name, yield_quantity, expected_cost_per_yield, expected_cost_per_unit, ingredient_count')
    .eq('business_id', businessId)
    .eq('product_id', productId)

  if (error) throw error
  return (data ?? []).map((r: Record<string, unknown>) => ({
    recipe_id: r.recipe_id as string,
    recipe_name: r.recipe_name as string,
    yield_quantity: Number(r.yield_quantity),
    expected_cost_per_yield: Number(r.expected_cost_per_yield),
    expected_cost_per_unit: Number(r.expected_cost_per_unit),
    ingredient_count: Number(r.ingredient_count),
  }))
}

/** Scale a recipe's items to a target unit count */
export function scaleRecipeItems(
  recipe: Recipe,
  targetUnits: number,
): Array<{ item_id: string; item_name: string; usage_unit_name: string; quantity: number; notes: string | null }> {
  if (recipe.yield_quantity <= 0 || targetUnits <= 0) return recipe.items.map(i => ({ ...i }))
  const factor = targetUnits / recipe.yield_quantity
  return recipe.items.map((i) => ({
    item_id: i.item_id,
    item_name: i.item_name,
    usage_unit_name: i.usage_unit_name,
    quantity: Math.round(i.quantity * factor * 10000) / 10000,
    notes: i.notes,
  }))
}
