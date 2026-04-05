/** Unit names must match `units` seed (e.g. kilogram, cup, piece). */
export type ItemKind = 'ingredient' | 'packaging'

export interface IngredientPreset {
  name: string
  /** Single unit for both purchase and recipe (ratio 1). */
  unit: string
}

export const COMMON_INGREDIENTS: IngredientPreset[] = [
  { name: 'All-purpose flour', unit: 'kilogram' },
  { name: 'White sugar', unit: 'kilogram' },
  { name: 'Brown sugar', unit: 'kilogram' },
  { name: 'Butter', unit: 'pound' },
  { name: 'Eggs', unit: 'piece' },
  { name: 'Milk', unit: 'litre' },
  { name: 'Salt', unit: 'kilogram' },
  { name: 'Yeast', unit: 'gram' },
  { name: 'Vanilla extract', unit: 'millilitre' },
  { name: 'Baking powder', unit: 'gram' },
  { name: 'Oil', unit: 'litre' },
  { name: 'Honey', unit: 'kilogram' },
]

export const COMMON_PACKAGING: IngredientPreset[] = [
  { name: 'Bread bags', unit: 'piece' },
  { name: 'Cake boxes', unit: 'piece' },
  { name: 'Napkins', unit: 'piece' },
  { name: 'Labels', unit: 'roll' },
]

/** Product names for one-tap batch titles. */
export const COMMON_BAKES = [
  'Sourdough loaf',
  'Baguettes',
  'Croissants',
  'Cookies',
  'Muffins',
  'Cinnamon rolls',
  'Custom…',
] as const

export const COMMON_BATCH_SIZES = [6, 12, 24, 48] as const

export const COMMON_SALE_AMOUNTS = [1, 2, 3, 6, 12] as const

/** Typical loaf / item prices (USD) — quick picks only. */
export const COMMON_SALE_PRICES = [4, 5, 6, 7, 8, 10] as const

/** Cup fractions for volume ingredients (usage unit = cup). */
export const CUP_FRACTIONS: { label: string; value: number }[] = [
  { label: '1 cup', value: 1 },
  { label: '½', value: 0.5 },
  { label: '¼', value: 0.25 },
  { label: '⅛', value: 0.125 },
]
