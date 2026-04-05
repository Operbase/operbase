import { describe, it, expect } from 'vitest'
import { businessInitials } from '@/lib/brand/business-initials'

describe('businessInitials()', () => {
  it('returns ? for empty name', () => {
    expect(businessInitials('')).toBe('?')
    expect(businessInitials('   ')).toBe('?')
    expect(businessInitials(null)).toBe('?')
  })

  it('uses first two words', () => {
    expect(businessInitials('Flour Power Bakery')).toBe('FP')
  })

  it('uses first letters of first word only when single word', () => {
    expect(businessInitials('Cafe')).toBe('C')
  })

  it('trims whitespace', () => {
    expect(businessInitials('  Sweet  Crumb  ')).toBe('SC')
  })
})
