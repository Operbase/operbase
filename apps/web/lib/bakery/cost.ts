/** Cost per usage unit from purchase-unit price and conversion ratio. */
export function costPerUsageUnit(costPerPurchaseUnit: number, conversionRatio: number): number {
  const r = conversionRatio > 0 ? conversionRatio : 1
  return costPerPurchaseUnit / r
}

/** Stock ledger quantity (usage units) from a purchase-unit restock count. */
export function usageQuantityFromPurchaseQty(purchaseQty: number, conversionRatio: number): number {
  const r = conversionRatio > 0 ? conversionRatio : 1
  return purchaseQty * r
}

/** Total batch cost divided by units produced → cost per loaf (or per output unit). */
export function costPerOutputUnit(totalBatchCost: number, unitsProduced: number): number {
  if (!unitsProduced || unitsProduced <= 0) return 0
  return totalBatchCost / unitsProduced
}

/** COGS for a sale when allocating from a batch’s landed cost. */
export function saleCogsFromBatch(
  unitsSold: number,
  batchTotalCost: number,
  batchUnitsProduced: number
): number {
  return unitsSold * costPerOutputUnit(batchTotalCost, batchUnitsProduced)
}
