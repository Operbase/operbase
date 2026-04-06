import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// --- mock recharts to avoid canvas/resize issues in jsdom ---
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  BarChart: ({ children }: any) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  PieChart: () => null,
  Pie: () => null,
  Cell: () => null,
}))

// --- mock getting-started-helper so it doesn't need localStorage ---
vi.mock('@/components/getting-started-helper', () => ({
  GettingStartedHelper: () => <div data-testid="getting-started-helper" />,
}))

// --- mock next/navigation ---
const mockRefresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}))

// --- mock trackEvent (silent) ---
const mockTrackEvent = vi.fn().mockResolvedValue(undefined)
vi.mock('@/lib/services/events', () => ({
  trackEvent: (...args: any[]) => mockTrackEvent(...args),
}))

// --- mock business context ---
const mockBizContext = {
  businessId: 'biz-123',
  businessName: 'Test Bakery',
  brandColor: '#d97706',
  logoUrl: null,
  currency: 'USD',
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
  DashboardSalesPeriod,
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

const SPEND: DashboardSpendRow[] = [
  { item_name: 'Flour', total_spend: 120 },
  { item_name: 'Sugar', total_spend: 45 },
]

const ALERTS: DashboardAlertItem[] = [
  { id: 'item-1', name: 'Flour', quantity_on_hand: 0, usage_unit_name: 'kg', reason: 'Out of stock' },
  { id: 'item-2', name: 'Butter', quantity_on_hand: 0.5, usage_unit_name: 'kg', reason: 'At or below threshold (1)' },
]

function renderHome(overrides?: Partial<{
  metrics: DashboardMetrics
  metricsLifetime: DashboardMetrics
  initialSalesPeriod: DashboardSalesPeriod
  monthlySpend: DashboardSpendRow[]
  alerts: DashboardAlertItem[]
  loadError: string | null
  userName: string
}>) {
  const metrics = overrides?.metrics ?? METRICS
  return render(
    <DashboardHomeClient
      metrics={metrics}
      metricsLifetime={overrides?.metricsLifetime ?? metrics}
      initialSalesPeriod={overrides?.initialSalesPeriod ?? 'month'}
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
    renderHome({ userName: 'abbey' })
    expect(screen.getByText('Hi, abbey!')).toBeTruthy()
  })

  it('renders businessName in subtitle', () => {
    renderHome()
    expect(screen.getByText(/Test Bakery/)).toBeTruthy()
  })

  it('shows profit block with formatted values', () => {
    renderHome()
    expect(screen.getByText(/750/)).toBeTruthy()
    expect(screen.getByText(/1,200/)).toBeTruthy()
    expect(screen.getByText(/450/)).toBeTruthy()
    expect(screen.getByText('3')).toBeTruthy()
    expect(screen.getByText('12')).toBeTruthy()
  })

  it('shows sales count for selected period', () => {
    renderHome()
    expect(screen.getByText(/8 sales/)).toBeTruthy()
  })

  it('shows empty profit hero when there has never been a sale', () => {
    renderHome({ metrics: EMPTY_METRICS, metricsLifetime: EMPTY_METRICS })
    expect(screen.getByText(/Your profit will show here/)).toBeTruthy()
    expect(screen.queryByTestId('bar-chart')).toBeNull()
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
    expect(screen.getByText('Loading dashboard...')).toBeTruthy()
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

  it('shows stock alerts section when alerts exist', () => {
    renderHome({ alerts: ALERTS })
    expect(screen.getByText('Stock alerts')).toBeTruthy()
    expect(screen.getByText('Flour')).toBeTruthy()
    expect(screen.getByText('Butter')).toBeTruthy()
    expect(screen.getByText(/Out of stock/)).toBeTruthy()
  })

  it('does NOT show stock alerts section when alerts are empty', () => {
    renderHome({ alerts: [] })
    expect(screen.queryByText('Stock alerts')).toBeNull()
  })

  it('shows monthly spend table when spend data exists', () => {
    renderHome({ monthlySpend: SPEND })
    expect(screen.getByText('This month — spend by item (purchases)')).toBeTruthy()
    expect(screen.getByText('Flour')).toBeTruthy()
    expect(screen.getByText('Sugar')).toBeTruthy()
  })

  it('does NOT show monthly spend table when empty', () => {
    renderHome({ monthlySpend: [] })
    expect(screen.queryByText('This month — spend by item (purchases)')).toBeNull()
  })

  it('renders nav links to Stock, Baking, Sales', () => {
    renderHome()
    expect(screen.getByText('Stock')).toBeTruthy()
    expect(screen.getByText('Baking')).toBeTruthy()
    expect(screen.getByText('Sales')).toBeTruthy()
  })

  it('renders the money snapshot bar chart', () => {
    renderHome()
    expect(screen.getByTestId('bar-chart')).toBeTruthy()
  })
})
