import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('@/components/getting-started-helper', () => ({
  GettingStartedHelper: () => <div data-testid="getting-started-helper" />,
}))

const mockRefresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}))

const mockTrackEvent = vi.fn().mockResolvedValue(undefined)
vi.mock('@/lib/services/events', () => ({
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
}))

const mockBizContext = {
  businessId: 'biz-123',
  businessName: 'Test Bakery',
  brandColor: '#d97706',
  logoUrl: null,
  currency: 'USD',
  timezone: 'Africa/Lagos',
  loading: false,
  error: null,
  refetch: vi.fn(),
}

vi.mock('@/providers/business-provider', () => ({
  useBusinessContext: () => mockBizContext,
}))

import { DashboardHomeClient } from '@/app/dashboard/dashboard-home-client'
import type {
  DashboardMetrics,
  DashboardSpendRow,
  DashboardAlertItem,
  DashboardAtRisk,
  DashboardDailyTotals,
} from '@/lib/dashboard/load-home-data'

const EMPTY_METRICS: DashboardMetrics = {
  totalRevenue: 0,
  totalCogs: 0,
  grossProfit: 0,
  totalSales: 0,
  totalBatches: 0,
  totalItems: 0,
}

const METRICS: DashboardMetrics = {
  totalRevenue: 1200,
  totalCogs: 450,
  grossProfit: 750,
  totalSales: 8,
  totalBatches: 3,
  totalItems: 12,
}

const AT_RISK: DashboardAtRisk = { itemsLeft: 24, moneyTiedUp: 180 }

const DAILY: DashboardDailyTotals = {
  madeToday: 40,
  soldUnitsToday: 15,
  lostUnitsLifetime: 6,
}

const SPEND: DashboardSpendRow[] = [
  { item_name: 'Flour', total_spend: 120 },
  { item_name: 'Sugar', total_spend: 45 },
]

const ALERTS: DashboardAlertItem[] = [
  { id: 'item-1', name: 'Flour', quantity_on_hand: 0, usage_unit_name: 'kg', reason: 'Out of stock' },
  { id: 'item-2', name: 'Butter', quantity_on_hand: 0.5, usage_unit_name: 'kg', reason: 'At or below threshold (1)' },
]

function renderHome(overrides?: Partial<{
  todayMetrics: DashboardMetrics
  metricsLifetime: DashboardMetrics
  atRisk: DashboardAtRisk
  dailyTotals: DashboardDailyTotals
  monthlySpend: DashboardSpendRow[]
  alerts: DashboardAlertItem[]
  loadError: string | null
  userName: string
}>) {
  return render(
    <DashboardHomeClient
      todayMetrics={overrides?.todayMetrics ?? METRICS}
      metricsLifetime={overrides?.metricsLifetime ?? METRICS}
      atRisk={overrides?.atRisk ?? AT_RISK}
      dailyTotals={overrides?.dailyTotals ?? DAILY}
      monthlySpend={overrides?.monthlySpend ?? []}
      alerts={overrides?.alerts ?? []}
      loadError={overrides?.loadError ?? null}
      userName={overrides?.userName ?? 'abbey'}
    />
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockBizContext.loading = false
  mockBizContext.error = null
  mockBizContext.businessId = 'biz-123'
})

describe('DashboardHomeClient', () => {
  it('renders the greeting with userName', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-06-15T08:00:00.000Z'))
    try {
      renderHome({ userName: 'abbey' })
      expect(screen.getByRole('heading', { level: 1, name: 'Good morning, abbey' })).toBeTruthy()
    } finally {
      vi.useRealTimers()
    }
  })

  it('renders businessName in subtitle', () => {
    renderHome()
    expect(screen.getByText(/Test Bakery/)).toBeTruthy()
  })

  it('shows today profit headline when there have been sales', () => {
    renderHome()
    expect(screen.getByText(/You made \$750\.00 today/i)).toBeTruthy()
  })

  it('shows at-risk section when items are left', () => {
    renderHome()
    expect(screen.getByText(/What is still waiting to sell/)).toBeTruthy()
    expect(screen.getByText(/24/)).toBeTruthy()
    expect(screen.getByText(/If they do not sell, you lose this money/)).toBeTruthy()
    expect(screen.getByRole('link', { name: /sell now/i })).toHaveAttribute('href', '/dashboard/sales')
  })

  it('shows quick action buttons', () => {
    renderHome()
    expect(screen.getByRole('link', { name: /record production/i })).toBeTruthy()
    expect(screen.getByRole('link', { name: /^sell items$/i })).toBeTruthy()
    expect(screen.getByRole('link', { name: /^add stock$/i })).toBeTruthy()
  })

  it('shows daily summary numbers', () => {
    renderHome()
    expect(screen.getByText('Made today')).toBeTruthy()
    expect(screen.getByText('Sold today')).toBeTruthy()
    expect(screen.getByText('40')).toBeTruthy()
    expect(screen.getByText('15')).toBeTruthy()
  })

  it('shows empty hero when there has never been a sale', () => {
    renderHome({ metricsLifetime: EMPTY_METRICS, todayMetrics: EMPTY_METRICS })
    expect(screen.getByText(/Log a first sale/)).toBeTruthy()
  })

  it('renders GettingStartedHelper', () => {
    renderHome()
    expect(screen.getByTestId('getting-started-helper')).toBeTruthy()
  })

  it('calls trackEvent with dashboard_viewed on mount', async () => {
    renderHome()
    await waitFor(() => {
      expect(mockTrackEvent).toHaveBeenCalledWith('dashboard_viewed', 'biz-123')
    })
  })

  it('does NOT call trackEvent when businessId is missing', async () => {
    mockBizContext.businessId = ''
    renderHome()
    await new Promise((r) => setTimeout(r, 50))
    expect(mockTrackEvent).not.toHaveBeenCalled()
  })

  it('shows loading state when bizLoading and no businessId', () => {
    mockBizContext.loading = true
    mockBizContext.businessId = ''
    renderHome()
    expect(screen.getByText('Loading…')).toBeTruthy()
  })

  it('shows error state with retry button when bizError is set', async () => {
    mockBizContext.error = 'Failed to load business'
    renderHome()
    expect(screen.getByText('Failed to load business')).toBeTruthy()
    const btn = screen.getByRole('button', { name: /try again/i })
    await userEvent.click(btn)
    expect(mockBizContext.refetch).toHaveBeenCalled()
  })

  it('shows loadError banner with refresh button', async () => {
    renderHome({ loadError: 'Failed to load some dashboard data' })
    expect(screen.getByText('Failed to load some dashboard data')).toBeTruthy()
    const btn = screen.getByRole('button', { name: /refresh/i })
    await userEvent.click(btn)
    expect(mockRefresh).toHaveBeenCalled()
  })

  it('shows running low section when alerts exist', () => {
    renderHome({ alerts: ALERTS })
    expect(screen.getByText('Running low')).toBeTruthy()
    expect(screen.getByText('Flour')).toBeTruthy()
    expect(screen.getByText('Butter')).toBeTruthy()
  })

  it('does NOT show running low when alerts are empty', () => {
    renderHome({ alerts: [] })
    expect(screen.queryByText('Running low')).toBeNull()
  })

  it('shows monthly spend inside details when spend data exists', () => {
    renderHome({ monthlySpend: SPEND })
    expect(screen.getByText(/More details — what you spent this month/)).toBeTruthy()
    expect(screen.getByText('Flour')).toBeTruthy()
    expect(screen.getByText('Sugar')).toBeTruthy()
  })

  it('does NOT show monthly spend details when empty', () => {
    renderHome({ monthlySpend: [] })
    expect(screen.queryByText(/More details — what you spent this month/)).toBeNull()
  })

  it('shows loss headline when today profit is negative', () => {
    renderHome({
      todayMetrics: { ...METRICS, grossProfit: -120, totalSales: 3, totalRevenue: 50, totalCogs: 170 },
    })
    expect(screen.getByText(/You lost \$120\.00 today/i)).toBeTruthy()
  })
})
