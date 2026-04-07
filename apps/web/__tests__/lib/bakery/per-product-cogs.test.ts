import { describe, it, expect } from 'vitest'
import {
  saleCogsFromProductAvg,
  weightedAverageOutputUnitCost,
} from '@/lib/bakery/per-product-cogs'

describe('weightedAverageOutputUnitCost', () => {
  it('returns null for empty batches', () => {
    expect(weightedAverageOutputUnitCost([])).toBeNull()
  })

  it('returns null when no batch has positive units and cost', () => {
    expect(
      weightedAverageOutputUnitCost([
        { cost_of_goods: 10, units_produced: 0 },
        { cost_of_goods: null, units_produced: 5 },
      ])
    ).toBeNull()
  })

  it('averages cost across batches of the same product', () => {
    // Product A: batch1 100 cost / 10 units = 10/unit; batch2 150 cost / 10 units = 15/unit
    // Pooled: 250 / 20 = 12.5 per unit
    const avg = weightedAverageOutputUnitCost([
      { cost_of_goods: 100, units_produced: 10 },
      { cost_of_goods: 150, units_produced: 10 },
    ])
    expect(avg).toBeCloseTo(12.5, 5)
  })

  it('does not mix with another product when given only one product pool', () => {
    const cheap = weightedAverageOutputUnitCost([{ cost_of_goods: 50, units_produced: 10 }])
    const expensive = weightedAverageOutputUnitCost([{ cost_of_goods: 200, units_produced: 10 }])
    expect(cheap).toBeCloseTo(5, 5)
    expect(expensive).toBeCloseTo(20, 5)
  })
})

describe('saleCogsFromProductAvg', () => {
  it('returns null when average is unknown', () => {
    expect(saleCogsFromProductAvg(5, null)).toBeNull()
  })

  it('returns null for non-positive units', () => {
    expect(saleCogsFromProductAvg(0, 10)).toBeNull()
    expect(saleCogsFromProductAvg(-1, 10)).toBeNull()
  })

  it('multiplies units sold by average cost per unit', () => {
    expect(saleCogsFromProductAvg(5, 12.5)).toBeCloseTo(62.5, 5)
  })
})
