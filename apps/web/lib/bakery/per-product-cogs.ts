/**
 * Weighted average cost per output unit from production batches of one product.
 * Each batch contributes (cost_of_goods, units_produced) to the pool.
 */
export function weightedAverageOutputUnitCost(
  batches: Array<{ cost_of_goods: number | null; units_produced: number }>
): number | null {
  let totalCost = 0
  let totalUnits = 0
  for (const b of batches) {
    const u = Number(b.units_produced)
    const c = b.cost_of_goods != null ? Number(b.cost_of_goods) : NaN
    if (u > 0 && Number.isFinite(c) && c >= 0) {
      totalCost += c
      totalUnits += u
    }
  }
  if (totalUnits <= 0) return null
  return totalCost / totalUnits
}

/** COGS for units sold when average output-unit cost is known. */
export function saleCogsFromProductAvg(
  unitsSold: number,
  avgCostPerOutputUnit: number | null
): number | null {
  if (avgCostPerOutputUnit == null) return null
  if (!Number.isFinite(unitsSold) || unitsSold <= 0) return null
  return avgCostPerOutputUnit * unitsSold
}
