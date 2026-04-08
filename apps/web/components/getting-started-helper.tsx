'use client'

/**
 * GettingStartedHelper
 *
 * A dismissible in-app guide shown to new users on the dashboard home.
 * State persisted in localStorage — survives page refreshes but is per-browser.
 *
 * Reopening: dispatching `new CustomEvent('operbase:show-helper')` on window
 * will reopen it (used by the "?" button in DashboardLayout sidebar).
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  X,
  Package,
  ChefHat,
  ShoppingBag,
  ArrowRight,
  Lightbulb,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const STORAGE_KEY = 'operbase_helper_dismissed'

const steps = [
  {
    icon: Package,
    label: 'Stock',
    title: 'Add ingredients you bought',
    description:
      'Pick one thing you buy all the time (flour, sugar, butter). You can add the rest after.',
    href: '/dashboard/stock',
    cta: 'Add your first ingredient',
    primary: true,
  },
  {
    icon: ChefHat,
    label: 'Production',
    title: 'Record what you made today',
    description: 'Log each run. What you used comes off stock automatically (oldest purchases first).',
    href: '/dashboard/production',
    cta: 'Record production',
    primary: false,
  },
  {
    icon: ShoppingBag,
    label: 'Sales',
    title: 'Record what you sold',
    description: 'Enter each sale. Your profit shows up on the dashboard instantly.',
    href: '/dashboard/sales',
    cta: 'Record a sale',
    primary: false,
  },
]

export function GettingStartedHelper() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const dismissed = localStorage.getItem(STORAGE_KEY)
    if (!dismissed) setVisible(true)

    // Listen for the reopen signal dispatched by the sidebar "?" button
    function handleReopen() {
      localStorage.removeItem(STORAGE_KEY)
      setVisible(true)
    }
    window.addEventListener('operbase:show-helper', handleReopen)
    return () => window.removeEventListener('operbase:show-helper', handleReopen)
  }, [])

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, '1')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      className="mb-6 rounded-2xl border border-amber-200/70 bg-amber-50/60 shadow-sm"
      role="region"
      aria-label="Getting started guide"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4 sm:px-6 sm:pt-6">
        <div className="flex items-center gap-2.5">
          <Lightbulb className="h-5 w-5 shrink-0 text-amber-600" aria-hidden />
          <div>
            <h2 className="text-sm font-bold text-gray-900">Getting started</h2>
            <p className="text-xs text-gray-500">Three short steps, then you see real profit on the dashboard.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 rounded-lg p-1.5 text-gray-400 hover:bg-amber-100 hover:text-gray-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
          aria-label="Close guide"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>

      {/* Steps */}
      <div className="px-5 pb-5 sm:px-6 sm:pb-6">
        <ol className="space-y-3">
          {steps.map((step, i) => {
            const Icon = step.icon
            return (
              <li
                key={step.label}
                className={cn(
                  'flex items-start gap-4 rounded-xl border p-4',
                  step.primary
                    ? 'border-amber-300 bg-amber-50'
                    : 'border-gray-100 bg-white opacity-70'
                )}
              >
                {/* Step number + icon */}
                <div className="flex shrink-0 flex-col items-center gap-1.5 pt-0.5">
                  <div
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-full',
                      step.primary ? 'bg-amber-600 text-white' : 'bg-amber-100 text-amber-700'
                    )}
                  >
                    <Icon className="h-4 w-4" aria-hidden />
                  </div>
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                    Step {i + 1}
                  </span>
                </div>

                {/* Text + CTA */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{step.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-gray-600">{step.description}</p>
                  {step.primary ? (
                    <Link href={step.href!}>
                      <Button
                        size="sm"
                        className="mt-3 h-8 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold"
                      >
                        {step.cta}
                        <ArrowRight className="ml-1 h-3 w-3" aria-hidden />
                      </Button>
                    </Link>
                  ) : (
                    <Link
                      href={step.href!}
                      className="mt-2.5 inline-flex items-center gap-1 text-xs font-semibold text-amber-700 hover:text-amber-800 transition-colors"
                    >
                      {step.cta}
                      <ArrowRight className="h-3 w-3" aria-hidden />
                    </Link>
                  )}
                </div>
              </li>
            )
          })}
        </ol>

        <div className="mt-4 flex justify-end">
          <Button
            size="sm"
            variant="ghost"
            onClick={dismiss}
            className="h-8 text-xs text-gray-400 hover:text-gray-600"
          >
            Dismiss
          </Button>
        </div>
      </div>
    </div>
  )
}
