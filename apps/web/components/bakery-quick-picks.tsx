'use client'

import { Button } from '@/components/ui/button'
import { CUP_FRACTIONS } from '@/lib/bakery/simple-presets'
import { cn } from '@/lib/utils'

export function CupFractionRow({
  onPick,
  className,
}: {
  onPick: (value: number) => void
  className?: string
}) {
  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {CUP_FRACTIONS.map(({ label, value }) => (
        <Button
          key={label}
          type="button"
          variant="secondary"
          size="sm"
          className="min-h-11 min-w-[4.5rem] text-base font-medium"
          onClick={() => onPick(value)}
        >
          {label}
        </Button>
      ))}
    </div>
  )
}

export function WholeNumberChips({
  values,
  onPick,
  className,
}: {
  values: readonly number[]
  onPick: (value: number) => void
  className?: string
}) {
  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {values.map((n) => (
        <Button
          key={n}
          type="button"
          variant="secondary"
          size="sm"
          className="min-h-11 min-w-11 text-base font-semibold"
          onClick={() => onPick(n)}
        >
          {n}
        </Button>
      ))}
    </div>
  )
}

export function PriceChips({
  amounts,
  onPick,
  className,
}: {
  amounts: readonly number[]
  onPick: (dollars: number) => void
  className?: string
}) {
  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {amounts.map((n) => (
        <Button
          key={n}
          type="button"
          variant="secondary"
          size="sm"
          className="min-h-11 min-w-[3.25rem] text-base font-semibold"
          onClick={() => onPick(n)}
        >
          ${n}
        </Button>
      ))}
    </div>
  )
}
