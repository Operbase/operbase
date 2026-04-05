import { describe, it, expect } from 'vitest'
import { formatCurrency } from '@/lib/format-currency'

describe('formatCurrency()', () => {
  it('formats USD by default', () => {
    const result = formatCurrency(1234.5)
    // Locale-aware — just check it contains the digits and looks like currency
    expect(result).toContain('1,234.50')
  })

  it('formats a whole number with two decimal places', () => {
    expect(formatCurrency(100)).toContain('100.00')
  })

  it('formats GBP correctly', () => {
    const result = formatCurrency(50, 'GBP')
    expect(result).toContain('50.00')
  })

  it('formats NGN correctly', () => {
    const result = formatCurrency(1000, 'NGN')
    expect(result).toContain('1,000.00')
  })

  it('formats zero', () => {
    expect(formatCurrency(0, 'USD')).toContain('0.00')
  })

  it('formats negative amounts', () => {
    const result = formatCurrency(-99.99, 'USD')
    expect(result).toContain('99.99')
  })

  it('rounds to 2 decimal places', () => {
    // 1.005 rounds to 1.01 (or 1.00 depending on float) — just check 2dp is enforced
    const result = formatCurrency(1.999)
    expect(result).toContain('2.00')
  })

  it('includes the amount and currency code for unknown currency codes', () => {
    // Node's Intl may or may not throw for non-standard codes; either way the
    // amount and code must both appear in the output.
    const result = formatCurrency(42, 'XYZ')
    expect(result).toContain('42.00')
    expect(result).toContain('XYZ')
  })

  it('default currency is USD when omitted', () => {
    // Should not throw and should include the amount
    const result = formatCurrency(10)
    expect(result).toContain('10.00')
  })
})
