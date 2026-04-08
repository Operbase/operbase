import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockSupabaseClient, resetSupabaseMocks, createQueryBuilder } from '../../helpers/supabase-mock'
import { toast } from 'sonner'

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => mockSupabaseClient,
}))

// cmdk uses scrollIntoView + ResizeObserver APIs absent in JSDOM — provide a
// minimal React-component stub so shadcn's Command wrapper can render without hanging.
vi.mock('cmdk', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react')
  function Command({ children, ...props }: any) {
    return React.createElement('div', props, children)
  }
  Command.Input = function CmdInput({ onValueChange, ...props }: any) {
    return React.createElement('input', {
      onChange: (e: any) => onValueChange?.(e.target.value),
      ...props,
    })
  }
  Command.List = function CmdList({ children, ...props }: any) {
    return React.createElement('div', props, children)
  }
  Command.Empty = function CmdEmpty({ children, ...props }: any) {
    return React.createElement('div', props, children)
  }
  Command.Group = function CmdGroup({ children, heading: _h, ...props }: any) {
    return React.createElement('div', props, children)
  }
  Command.Item = function CmdItem({ onSelect, value: _v, children, ...props }: any) {
    return React.createElement('div', { ...props, role: 'option', onClick: () => onSelect?.() }, children)
  }
  Command.Separator = function CmdSep({ ...props }: any) {
    return React.createElement('hr', props)
  }
  return { Command }
})

vi.mock('@/providers/business-provider', () => ({
  useBusinessContext: () => ({
    businessId: 'biz-123',
    businessName: 'Test Bakery',
    brandColor: '#d97706',
    logoUrl: null,
    currency: 'USD',
    timezone: 'Africa/Lagos',
    loading: false,
    error: null,
    refetch: vi.fn(),
  }),
}))

// next/navigation is mocked globally in vitest.setup.ts (useSearchParams + useRouter)

import type { SalesRow } from '@/lib/dashboard/sales-data'
import { SalesPageClient } from '@/app/dashboard/sales/sales-page-client'

// computeAutoCogs queries 'batches' — mock it to return empty (no production logged)
// so COGS = null in tests, matching existing sale fixture data

const MOCK_SALES = [
  {
    id: 'sale-1',
    product_name: 'Sourdough loaf',
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
    product_name: 'Danish',
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
    product_id: 'prod-sourdough',
    product_name: s.product_name,
    batch_id: s.batch_id,
    units_sold: s.units_sold,
    unit_price: s.unit_price,
    revenue: s.revenue,
    cogs: s.cogs,
    gross_profit: s.gross_profit,
    sold_at: s.sold_at,
  }))
}

function renderSales() {
  return render(<SalesPageClient initialSales={toInitialSales()} />)
}

const MOCK_PRODUCTS = [
  { id: 'prod-bagel', name: 'Bagels' },
  { id: 'prod-danish', name: 'Danish' },
  { id: 'prod-muffin', name: 'Muffins' },
  { id: 'prod-cake', name: 'Custom cake' },
]

function setupMocks() {
  mockSupabaseClient.rpc.mockImplementation((name: string) => {
    if (name === 'ensure_product') {
      return Promise.resolve({ data: 'prod-test', error: null })
    }
    if (name === 'record_sale_with_batch') {
      return Promise.resolve({ data: 'sale-new', error: null })
    }
    if (name === 'delete_sale_restores_batch') {
      return Promise.resolve({ data: null, error: null })
    }
    return Promise.resolve({ data: null, error: null })
  })
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
    if (table === 'products') {
      return createQueryBuilder({ data: MOCK_PRODUCTS })
    }
    if (table === 'batches') {
      return createQueryBuilder({ data: [] })
    }
    if (table === 'batch_items') {
      return createQueryBuilder({ data: [] })
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
    const user = userEvent.setup()
    renderSales()
    // Product name is in its own element; customer is appended to the date string
    await waitFor(() => {
      expect(screen.getByText('Sourdough loaf')).toBeInTheDocument()
    })
    // Expand second sale (Danish / Walk-in) to see customer in details row
    await user.click(screen.getAllByRole('button', { name: /show sale details/i })[1])
    await waitFor(() => {
      expect(screen.queryAllByText(/Walk-in/).length).toBeGreaterThan(0)
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

    await user.click(within(dialog).getByRole('combobox'))
    await user.click(await screen.findByText(/^Bagels$/))
    await user.click(within(dialog).getByRole('button', { name: /^save sale$/i }))

    expect(toast.error).toHaveBeenCalledWith('Enter how many you sold.')
  })

  it('shows running total when units and price are entered', async () => {
    const user = userEvent.setup()
    renderSales()

    await user.click(screen.getByRole('button', { name: /log sale/i }))
    const dialog = await screen.findByRole('dialog')

    await user.click(within(dialog).getByRole('combobox'))
    await user.click(await screen.findByText(/^Muffins$/))
    await user.type(within(dialog).getByLabelText(/^how many/i), '5')
    await user.type(within(dialog).getByLabelText(/^price each/i), '10')
    await waitFor(() => {
      expect(within(dialog).getByText('$50.00')).toBeInTheDocument()
    })
  })

  it('creates a sale with valid input and no customer name (walk-in)', async () => {
    const user = userEvent.setup()
    const recordRpc = vi.fn().mockResolvedValue({ data: 'sale-new', error: null })

    mockSupabaseClient.rpc.mockImplementation((name: string, args?: Record<string, unknown>) => {
      if (name === 'ensure_product') {
        return Promise.resolve({ data: 'prod-danish', error: null })
      }
      if (name === 'record_sale_with_batch') {
        return recordRpc(args)
      }
      return Promise.resolve({ data: null, error: null })
    })
    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === 'sales') {
        return {
          ...createQueryBuilder({ data: [] }),
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        }
      }
      if (table === 'products') {
        return createQueryBuilder({ data: MOCK_PRODUCTS })
      }
      if (table === 'batches') {
        return createQueryBuilder({ data: [] })
      }
      return createQueryBuilder()
    })

    renderSales()

    await user.click(screen.getByRole('button', { name: /log sale/i }))
    await waitFor(() => screen.getByRole('dialog'))

    const dlg = await screen.findByRole('dialog')
    await user.click(within(dlg).getByRole('combobox'))
    // Use role='option' to target the picker item, not the Danish sale row in the table
    await user.click(await screen.findByRole('option', { name: /^Danish$/ }))
    await user.type(within(dlg).getByLabelText(/^how many/i), '10')
    await user.type(within(dlg).getByLabelText(/^price each/i), '5')
    await user.click(within(dlg).getByRole('button', { name: /^save sale$/i }))

    await waitFor(() => {
      expect(recordRpc).toHaveBeenCalled()
      const args = recordRpc.mock.calls[0][0] as Record<string, unknown>
      expect(args.p_business_id).toBe('biz-123')
      expect(args.p_product_id).toBe('prod-danish')
      expect(args.p_product_name).toBe('Danish')
      expect(args.p_units_sold).toBe(10)
      expect(args.p_unit_price).toBe(5)
      expect(args.p_batch_id).toBeNull()
      expect(args.p_cogs_if_no_batch).toBeNull()
      expect(toast.success).toHaveBeenCalledWith('Sale recorded!')
    })
  })

  it('computes COGS from batches for the same product only', async () => {
    const user = userEvent.setup()
    const recordRpc = vi.fn().mockResolvedValue({ data: 'sale-muffin', error: null })
    const batchesEqSpy = vi.fn()

    mockSupabaseClient.rpc.mockImplementation((name: string, args?: Record<string, unknown>) => {
      if (name === 'ensure_product') {
        return Promise.resolve({ data: 'prod-muffin', error: null })
      }
      if (name === 'record_sale_with_batch') {
        return recordRpc(args)
      }
      return Promise.resolve({ data: null, error: null })
    })
    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === 'sales') {
        return {
          ...createQueryBuilder({ data: [] }),
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        }
      }
      if (table === 'products') {
        return createQueryBuilder({ data: MOCK_PRODUCTS })
      }
      if (table === 'batches') {
        const b = createQueryBuilder({
          data: [{ cost_of_goods: 100, units_produced: 10 }],
        })
        b.eq = vi.fn((col: string, val: unknown) => {
          batchesEqSpy(col, val)
          return b
        })
        return b
      }
      return createQueryBuilder()
    })

    renderSales()

    await user.click(screen.getByRole('button', { name: /log sale/i }))
    const dlg = await screen.findByRole('dialog')
    await user.click(within(dlg).getByRole('combobox'))
    await user.click(await screen.findByText(/^Muffins$/))
    await user.type(within(dlg).getByLabelText(/^how many/i), '5')
    await user.type(within(dlg).getByLabelText(/^price each/i), '4')
    await user.click(within(dlg).getByRole('button', { name: /^save sale$/i }))

    await waitFor(() => {
      expect(batchesEqSpy).toHaveBeenCalledWith('product_id', 'prod-muffin')
      const args = recordRpc.mock.calls[0][0] as Record<string, unknown>
      expect(args.p_cogs_if_no_batch).toBe(50)
      expect(args.p_product_id).toBe('prod-muffin')
    })
  })

  it('creates a customer record when customer name is provided', async () => {
    const user = userEvent.setup()

    const customerInsertMock = vi.fn().mockReturnThis()
    const customerSingleMock = vi.fn().mockResolvedValue({ data: { id: 'cust-new' }, error: null })
    const recordRpc = vi.fn().mockResolvedValue({ data: 'sale-cake', error: null })

    mockSupabaseClient.rpc.mockImplementation((name: string, args?: Record<string, unknown>) => {
      if (name === 'ensure_product') {
        return Promise.resolve({ data: 'prod-cake', error: null })
      }
      if (name === 'record_sale_with_batch') {
        return recordRpc(args)
      }
      return Promise.resolve({ data: null, error: null })
    })
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
        }
      }
      if (table === 'products') {
        return createQueryBuilder({ data: MOCK_PRODUCTS })
      }
      if (table === 'batches') {
        return createQueryBuilder({ data: [] })
      }
      return createQueryBuilder()
    })

    renderSales()

    await user.click(screen.getByRole('button', { name: /log sale/i }))
    await waitFor(() => screen.getByRole('dialog'))

    const dlg = await screen.findByRole('dialog')
    await user.click(within(dlg).getByRole('combobox'))
    await user.click(await screen.findByText(/^Custom cake$/))
    await user.click(within(dlg).getByText(/customer \(optional\)/i))
    await user.type(within(dlg).getByPlaceholderText(/leave blank for walk-in/i), 'New Customer')
    await user.type(within(dlg).getByLabelText(/^how many/i), '3')
    await user.type(within(dlg).getByLabelText(/^price each/i), '12')
    await user.click(within(dlg).getByRole('button', { name: /^save sale$/i }))

    await waitFor(() => {
      expect(customerInsertMock).toHaveBeenCalled()
      const args = recordRpc.mock.calls[0][0] as Record<string, unknown>
      expect(args.p_customer_id).toBe('cust-new')
    })
  })

  it('confirms before deleting a sale', async () => {
    const user = userEvent.setup()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)

    renderSales()
    await waitFor(() => screen.getByText('Sourdough loaf'))

    await user.click(screen.getByRole('button', { name: /delete sale sourdough loaf/i }))

    expect(confirmSpy).toHaveBeenCalledWith('Delete this sale?')
    confirmSpy.mockRestore()
  })
})
