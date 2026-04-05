import { describe, it, expect } from 'vitest'
import {
  costPerUsageUnit,
  usageQuantityFromPurchaseQty,
  costPerOutputUnit,
  saleCogsFromBatch,
} from '@/lib/bakery/cost'

describe('bakery cost helpers', () => {
  it('computes cost per usage unit', () => {
    expect(costPerUsageUnit(50, 25)).toBeCloseTo(2)
    expect(costPerUsageUnit(10, 1)).toBeCloseTo(10)
  })

  it('converts purchase qty to usage qty', () => {
    expect(usageQuantityFromPurchaseQty(2, 25)).toBe(50)
    expect(usageQuantityFromPurchaseQty(3, 1)).toBe(3)
  })

  it('computes cost per output unit', () => {
    expect(costPerOutputUnit(100, 50)).toBeCloseTo(2)
    expect(costPerOutputUnit(100, 0)).toBe(0)
  })

  it('computes sale COGS from batch', () => {
    expect(saleCogsFromBatch(10, 100, 50)).toBeCloseTo(20)
  })
})
