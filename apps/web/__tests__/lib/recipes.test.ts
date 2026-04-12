import { describe, it, expect } from 'vitest'
import { scaleRecipeItems, type Recipe } from '@/lib/recipes'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRecipe(yieldQty: number, items: { item_id: string; quantity: number }[]): Recipe {
  return {
    id: 'recipe-1',
    business_id: 'biz-1',
    product_id: 'prod-1',
    variant_id: null,
    name: 'Test Recipe',
    yield_quantity: yieldQty,
    notes: null,
    created_at: '2026-01-01T00:00:00Z',
    items: items.map((i, idx) => ({
      id: `item-${idx}`,
      item_id: i.item_id,
      item_name: `Item ${idx}`,
      usage_unit_name: 'g',
      quantity: i.quantity,
      notes: null,
    })),
  }
}

// ── scaleRecipeItems ──────────────────────────────────────────────────────────

describe('scaleRecipeItems', () => {
  it('returns quantities unchanged when target equals yield', () => {
    const recipe = makeRecipe(12, [
      { item_id: 'flour', quantity: 500 },
      { item_id: 'sugar', quantity: 200 },
    ])
    const result = scaleRecipeItems(recipe, 12)
    expect(result[0].quantity).toBe(500)
    expect(result[1].quantity).toBe(200)
  })

  it('doubles quantities when target is 2x yield', () => {
    const recipe = makeRecipe(12, [
      { item_id: 'flour', quantity: 500 },
      { item_id: 'eggs',  quantity: 3   },
    ])
    const result = scaleRecipeItems(recipe, 24)
    expect(result[0].quantity).toBe(1000)
    expect(result[1].quantity).toBe(6)
  })

  it('halves quantities when target is 0.5x yield', () => {
    const recipe = makeRecipe(12, [
      { item_id: 'flour', quantity: 600 },
    ])
    const result = scaleRecipeItems(recipe, 6)
    expect(result[0].quantity).toBe(300)
  })

  it('scales to non-integer factor correctly', () => {
    // yield=12, target=18 → factor=1.5
    const recipe = makeRecipe(12, [
      { item_id: 'flour', quantity: 100 },
    ])
    const result = scaleRecipeItems(recipe, 18)
    expect(result[0].quantity).toBe(150)
  })

  it('preserves item_id and metadata after scaling', () => {
    const recipe = makeRecipe(1, [
      { item_id: 'butter', quantity: 50 },
    ])
    const result = scaleRecipeItems(recipe, 4)
    expect(result[0].item_id).toBe('butter')
    expect(result[0].item_name).toBe('Item 0')
    expect(result[0].usage_unit_name).toBe('g')
  })

  it('returns original quantities when targetUnits <= 0', () => {
    const recipe = makeRecipe(12, [{ item_id: 'flour', quantity: 500 }])
    const zeroResult = scaleRecipeItems(recipe, 0)
    expect(zeroResult[0].quantity).toBe(500)
    const negResult = scaleRecipeItems(recipe, -1)
    expect(negResult[0].quantity).toBe(500)
  })

  it('returns original quantities when yield_quantity <= 0 (defensive)', () => {
    const recipe = makeRecipe(0, [{ item_id: 'flour', quantity: 500 }])
    const result = scaleRecipeItems(recipe, 12)
    expect(result[0].quantity).toBe(500)
  })

  it('handles fractional quantities rounded to 4 decimal places', () => {
    // yield=3, target=1 → factor=0.333…, qty=100 → 33.3333
    const recipe = makeRecipe(3, [{ item_id: 'flour', quantity: 100 }])
    const result = scaleRecipeItems(recipe, 1)
    expect(result[0].quantity).toBe(33.3333)
  })

  it('returns empty array when recipe has no items', () => {
    const recipe = makeRecipe(12, [])
    const result = scaleRecipeItems(recipe, 24)
    expect(result).toHaveLength(0)
  })

  it('does not mutate the original recipe items', () => {
    const recipe = makeRecipe(12, [{ item_id: 'flour', quantity: 500 }])
    const original = recipe.items[0].quantity
    scaleRecipeItems(recipe, 24)
    expect(recipe.items[0].quantity).toBe(original)
  })

  it('handles large scale factors without precision loss', () => {
    const recipe = makeRecipe(1, [{ item_id: 'flour', quantity: 100 }])
    const result = scaleRecipeItems(recipe, 1000)
    expect(result[0].quantity).toBe(100000)
  })

  it('scales multiple items independently', () => {
    const recipe = makeRecipe(6, [
      { item_id: 'flour',  quantity: 300 },
      { item_id: 'butter', quantity: 150 },
      { item_id: 'eggs',   quantity: 2   },
    ])
    const result = scaleRecipeItems(recipe, 12) // 2x
    expect(result[0].quantity).toBe(600)
    expect(result[1].quantity).toBe(300)
    expect(result[2].quantity).toBe(4)
  })
})
