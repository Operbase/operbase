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
  Home,
  Package,
  ChefHat,
  ShoppingBag,
  ArrowRight,
  CheckCircle2,
  Lightbulb,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const STORAGE_KEY = 'operbase_helper_dismissed'

const steps = [
  {
    icon: Home,
    label: 'Home',
    title: 'Your profit at a glance',
    description:
      'The dashboard shows revenue, costs, and gross profit. Alerts appear here when any stock item is running low.',
    href: null,
    cta: null,
  },
  {
    icon: Package,
    label: 'Stock',
    title: 'Add what you buy and use',
    description:
      'Add every ingredient and packaging item with the unit you buy in and the unit you use in production. Do this first — batches and costs depend on it.',
    href: '/dashboard/stock',
    cta: 'Go to Stock',
  },
  {
    icon: ChefHat,
    label: 'Baking',
    title: 'Log what you make',
    description:
      'Record each production run. Ingredients are deducted from your stock automatically and cost per batch is calculated for you.',
    href: '/dashboard/production',
    cta: 'Go to Baking',
  },
  {
    icon: ShoppingBag,
    label: 'Sales',
    title: 'Record what you sell',
    description:
      'Enter what sold and at what price. Revenue vs cost appears on your dashboard immediately — no formulas needed.',
    href: '/dashboard/sales',
    cta: 'Go to Sales',
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
            <p className="text-xs text-gray-500">Follow these steps to get the most out of Operbase.</p>
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
                  'flex items-start gap-4 rounded-xl border bg-white p-4',
                  i === 1 ? 'border-amber-300/60' : 'border-gray-100'
                )}
              >
                {/* Step number + icon */}
                <div className="flex shrink-0 flex-col items-center gap-1.5 pt-0.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                    <Icon className="h-4 w-4" aria-hidden />
                  </div>
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                    {i === 0 ? 'Now' : `Step ${i}`}
                  </span>
                </div>

                {/* Text + CTA */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{step.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-gray-600">{step.description}</p>
                  {step.href && step.cta && (
                    <Link
                      href={step.href}
                      className="mt-2.5 inline-flex items-center gap-1 text-xs font-semibold text-amber-700 hover:text-amber-800 transition-colors"
                    >
                      {step.cta}
                      <ArrowRight className="h-3 w-3" aria-hidden />
                    </Link>
                  )}
                </div>

                {/* "You are here" marker for step 0 */}
                {i === 0 && (
                  <CheckCircle2
                    className="h-4 w-4 shrink-0 text-emerald-500 mt-0.5"
                    aria-label="Current page"
                  />
                )}
              </li>
            )
          })}
        </ol>

        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-xs text-gray-400">
            Start with Stock — everything else builds on it.
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={dismiss}
            className="shrink-0 h-8 border-amber-200 text-xs font-semibold text-amber-800 hover:bg-amber-100 hover:border-amber-300"
          >
            Got it, close
          </Button>
        </div>
      </div>
    </div>
  )
}
