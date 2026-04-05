import { describe, it, expect } from 'vitest'
import { cn } from '@/lib/utils'

describe('cn()', () => {
  it('returns a single class unchanged', () => {
    expect(cn('text-red-500')).toBe('text-red-500')
  })

  it('merges multiple classes', () => {
    expect(cn('px-4', 'py-2', 'text-white')).toBe('px-4 py-2 text-white')
  })

  it('deduplicates conflicting Tailwind classes (last wins)', () => {
    // tailwind-merge should keep only the last of conflicting utilities
    expect(cn('px-2', 'px-4')).toBe('px-4')
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500')
  })

  it('handles conditional classes', () => {
    expect(cn('base', true && 'active', false && 'hidden')).toBe('base active')
  })

  it('handles undefined and null gracefully', () => {
    expect(cn('base', undefined, null as any, 'end')).toBe('base end')
  })

  it('handles object syntax', () => {
    expect(cn({ 'text-red-500': true, 'text-blue-500': false })).toBe('text-red-500')
  })

  it('returns empty string when no classes given', () => {
    expect(cn()).toBe('')
  })

  it('merges clsx and tailwind-merge correctly together', () => {
    const isActive = true
    const result = cn(
      'rounded p-2',
      isActive ? 'bg-amber-600' : 'bg-gray-200',
      'bg-amber-700'   // should override bg-amber-600
    )
    expect(result).toBe('rounded p-2 bg-amber-700')
  })
})
