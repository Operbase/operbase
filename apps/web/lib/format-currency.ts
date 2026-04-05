/**
 * Format a number as currency using the business's configured currency code.
 * Falls back gracefully if the currency code is unrecognised.
 */
export function formatCurrency(amount: number, currency = 'USD'): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)
  } catch {
    // Unknown currency code — show raw amount with code
    return `${currency} ${amount.toFixed(2)}`
  }
}
