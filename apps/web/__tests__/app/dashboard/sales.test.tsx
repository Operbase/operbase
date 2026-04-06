import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockSupabaseClient, resetSupabaseMocks, createQueryBuilder } from '../../helpers/supabase-mock'
import { toast } from 'sonner'

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => mockSupabaseClient,
}))

vi.mock('@/providers/business-provider', () => ({
  useBusinessContext: () => ({
    businessId: 'biz-123',
    businessName: 'Test Bakery',
    brandColor: '#d97706',
    logoUrl: null,
    currency: 'USD',
    loading: false,
    error: null,
    refetch: vi.fn(),
  }),
}))

// Recharts renders SVG; suppress resize observer errors in jsdom
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

import type { SalesRow } from '@/lib/dashboard/sales-data'
import { SalesPageClient } from '@/app/dashboard/sales/sales-page-client'

const MOCK_SALES = [
  {
    id: 'sale-1',
    units_sold: 10,
    unit_price: 5.0,
    revenue: 50.0,
    cogs: 20,
    gross_profit: 30,
    batch_id: null,
    sold_at: '2026-04-01T10:00:00Z',
    customers: { name: "John's Cafe" },
  },
  {
    id: 'sale-2',
    units_sold: 5,
    unit_price: 8.0,
    revenue: 40.0,
    cogs: null,
    gross_profit: 40,
    batch_id: null,
    sold_at: '2026-04-02T14:00:00Z',
    customers: null,
  },
]

function toInitialSales(): SalesRow[] {
  return MOCK_SALES.map((s) => ({
    id: s.id,
    customer_name: (s.customers as { name?: string } | null)?.name ?? 'Walk-in',
    product_name: 'Sourdough',
    units_sold: s.units_sold,
    unit_price: s.unit_price,
    revenue: s.revenue,
    cogs: s.cogs,
    gross_profit: s.gross_profit,
    sold_at: s.sold_at,
    batch_id: s.batch_id,
  }))
}

function renderSales() {
  return render(<SalesPageClient initialSales={toInitialSales()} initialBatches={[]} />)
}

function setupMocks() {
  mockSupabaseClient.from.mockImplementation((table: string) => {
    if (table === 'sales') {
      return {
        ...createQueryBuilder({ data: MOCK_SALES }),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: MOCK_SALES, error: null }),
        insert: vi.fn().mockResolvedValue({ error: null }),
        update: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis(),
      }
    }
    if (table === 'batches') {
      return {
        ...createQueryBuilder({ data: [] }),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      }
    }
    if (table === 'customers') {
      return {
        ...createQueryBuilder({ data: null }),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        insert: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { id: 'cust-new' }, error: null }),
      }
    }
    return createQueryBuilder()
  })
}

beforeEach(() => {
  resetSupabaseMocks()
  setupMocks()
})

describe('SalesPage', () => {
  it('renders the page header', () => {
    renderSales()
    expect(screen.getByText('Sales')).toBeInTheDocument()
  })

  it('shows Log sale button', () => {
    renderSales()
    expect(screen.getByRole('button', { name: /log sale/i })).toBeInTheDocument()
  })

  it('displays sales from Supabase', async () => {
    renderSales()
    await waitFor(() => {
      expect(screen.getByText("John's Cafe")).toBeInTheDocument()
      expect(screen.getByText('Walk-in')).toBeInTheDocument()
    })
  })

  it('shows total revenue metric', async () => {
    renderSales()
    await waitFor(() => {
      // $50 + $40 = $90 (may appear in multiple cards)
      const matches = screen.getAllByText('$90.00')
      expect(matches.length).toBeGreaterThanOrEqual(1)
    })
  })

  it('opens Record Sale dialog', async () => {
    const user = userEvent.setup()
    renderSales()

    await user.click(screen.getByRole('button', { name: /log sale/i }))

    await waitFor(() => {
      const dialog = screen.getByRole('dialog')
      expect(dialog).toBeInTheDocument()
      expect(within(dialog).getByRole('heading', { name: /log sale/i })).toBeInTheDocument()
    })
  })

  it('shows error when units or price are zero', async () => {
    const user = userEvent.setup()
    renderSales()

    await user.click(screen.getByRole('button', { name: /log sale/i }))
    const dialog = await screen.findByRole('dialog')

    await user.type(within(dialog).getByLabelText(/what did you sell/i), 'Bagels')
    await user.click(within(dialog).getByRole('button', { name: /^save sale$/i }))

    expect(toast.error).toHaveBeenCalledWith('Please enter valid units and price')
  })

  it('shows running total when units and price are entered', async () => {
    const user = userEvent.setup()
    renderSales()

    await user.click(screen.getByRole('button', { name: /log sale/i }))
    const dialog = await screen.findByRole('dialog')

    await user.type(within(dialog).getByLabelText(/what did you sell/i), 'Muffins')
    await user.type(within(dialog).getByLabelText(/^how many/i), '5')
    await user.type(within(dialog).getByLabelText(/^price each/i), '10')
    await waitFor(() => {
      expect(within(dialog).getByText('$50.00')).toBeInTheDocument()
    })
  })

  it('creates a sale with valid input and no customer name (walk-in)', async () => {
    const user = userEvent.setup()
    const insertMock = vi.fn().mockResolvedValue({ error: null })

    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === 'sales') {
        return {
          ...createQueryBuilder({ data: [] }),
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
          insert: insertMock,
        }
      }
      if (table === 'batches') {
        return {
          ...createQueryBuilder({ data: [] }),
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        }
      }
      return createQueryBuilder()
    })

    renderSales()

    await user.click(screen.getByRole('button', { name: /log sale/i }))
    await waitFor(() => screen.getByRole('dialog'))

    const dlg = await screen.findByRole('dialog')
    await user.type(within(dlg).getByLabelText(/what did you sell/i), 'Danish')
    await user.type(within(dlg).getByLabelText(/^how many/i), '10')
    await user.type(within(dlg).getByLabelText(/^price each/i), '5')
    await user.click(within(dlg).getByRole('button', { name: /^save sale$/i }))

    await waitFor(() => {
      expect(insertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          business_id: 'biz-123',
          customer_id: null,
          batch_id: null,
          cogs: null,
          product_name: 'Danish',
          units_sold: 10,
          unit_price: 5,
        })
      )
      expect(toast.success).toHaveBeenCalledWith('Sale recorded!')
    })
  })

  it('creates a customer record when customer name is provided', async () => {
    const user = userEvent.setup()

    const customerInsertMock = vi.fn().mockReturnThis()
    const customerSingleMock = vi.fn().mockResolvedValue({ data: { id: 'cust-new' }, error: null })
    const saleInsertMock = vi.fn().mockResolvedValue({ error: null })

    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === 'customers') {
        return {
          ...createQueryBuilder({ data: null }),
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          insert: customerInsertMock,
          single: customerSingleMock,
        }
      }
      if (table === 'sales') {
        return {
          ...createQueryBuilder({ data: [] }),
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
          insert: saleInsertMock,
        }
      }
      if (table === 'batches') {
        return {
          ...createQueryBuilder({ data: [] }),
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        }
      }
      return createQueryBuilder()
    })

    renderSales()

    await user.click(screen.getByRole('button', { name: /log sale/i }))
    await waitFor(() => screen.getByRole('dialog'))

    const dlg = await screen.findByRole('dialog')
    await user.type(within(dlg).getByLabelText(/what did you sell/i), 'Custom cake')
    await user.click(within(dlg).getByText(/customer or batch/i))
    await user.type(within(dlg).getByPlaceholderText(/leave blank for walk-in/i), 'New Customer')
    await user.type(within(dlg).getByLabelText(/^how many/i), '3')
    await user.type(within(dlg).getByLabelText(/^price each/i), '12')
    await user.click(within(dlg).getByRole('button', { name: /^save sale$/i }))

    await waitFor(() => {
      expect(customerInsertMock).toHaveBeenCalled()
      expect(saleInsertMock).toHaveBeenCalledWith(
        expect.objectContaining({ customer_id: 'cust-new' })
      )
    })
  })

  it('confirms before deleting a sale', async () => {
    const user = userEvent.setup()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)

    renderSales()
    await waitFor(() => screen.getByText("John's Cafe"))

    const deleteButtons = screen.getAllByRole('button', { name: '' })
    await user.click(deleteButtons[0])

    expect(confirmSpy).toHaveBeenCalledWith('Delete this sale?')
    confirmSpy.mockRestore()
  })
})
