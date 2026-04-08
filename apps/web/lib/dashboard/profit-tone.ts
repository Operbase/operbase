/**
 * Plain-language profit / loss styling for dashboard tables and cards.
 * Uses standard Tailwind greens / reds (not remapped by brand CSS).
 */

export function profitTextClass(amount: number | null | undefined): string {
  if (amount == null || Number.isNaN(amount)) return 'text-gray-600'
  if (amount < 0) return 'text-red-600 font-semibold'
  if (amount > 0) return 'text-emerald-700 font-semibold'
  return 'text-gray-700'
}

export function profitCardClass(amount: number | null | undefined): string {
  if (amount == null || Number.isNaN(amount)) return 'text-gray-900'
  if (amount < 0) return 'text-red-600'
  if (amount > 0) return 'text-emerald-700'
  return 'text-gray-800'
}

export function profitRowClass(amount: number | null | undefined): string {
  if (amount == null || Number.isNaN(amount)) return ''
  if (amount < 0) return 'bg-red-50/80'
  return ''
}
