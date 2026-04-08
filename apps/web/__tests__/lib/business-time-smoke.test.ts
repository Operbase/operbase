import { describe, it, expect } from 'vitest'
import { getStartOfDay } from '@/lib/business-time'

describe('business-time smoke', () => {
  it('resolves start of day in Africa/Lagos', () => {
    const d = getStartOfDay('Africa/Lagos', new Date('2026-01-15T12:00:00Z'))
    expect(d.toISOString()).toMatch(/2026-01-14T23:00:00\.000Z/)
  })
})
