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

import type { ProductionBatchRow } from '@/lib/dashboard/production-data'
import { ProductionPageClient } from '@/app/dashboard/production/production-page-client'

const MOCK_BATCHES = [
  {
    id: 'batch-1',
    product_id: 'prod-sourdough',
    products: { name: 'Sourdough Bread' },
    batch_items: [{ id: 'bi-1' }],
    units_produced: 50,
    units_remaining: 30,
    cost_of_goods: 120,
    notes: 'Sourdough Bread',
    produced_at: '2026-04-01T08:00:00Z',
  },
  {
    id: 'batch-2',
    product_id: null,
    products: null,
    batch_items: [],
    units_produced: 100,
    units_remaining: 100,
    cost_of_goods: null,
    notes: 'Croissants · batch #002',
    produced_at: '2026-04-02T08:00:00Z',
  },
]

const initialBatches: ProductionBatchRow[] = MOCK_BATCHES.map((b) => ({
  id: b.id,
  product_id: b.product_id as string | null,
  product_name:
    (b.products as { name?: string } | null)?.name ?? (b.notes as string) ?? 'Unnamed batch',
  units_produced: b.units_produced,
  units_remaining: b.units_remaining,
  units_given_away: 0,
  cost_of_goods: b.cost_of_goods,
  notes: b.notes as string,
  produced_at: b.produced_at as string,
  has_inventory_lines: Array.isArray(b.batch_items) && b.batch_items.length > 0,
}))

function renderProduction() {
  return render(
    <ProductionPageClient initialBatches={initialBatches} initialStockItems={[]} />
  )
}

function setupMocks() {
  mockSupabaseClient.from.mockImplementation((table: string) => {
    if (table === 'batches') {
      return {
        ...createQueryBuilder({ data: MOCK_BATCHES }),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: MOCK_BATCHES, error: null }),
        insert: vi.fn().mockResolvedValue({ error: null }),
        update: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis(),
      }
    }
    if (table === 'items') {
      return {
        ...createQueryBuilder({ data: [] }),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      }
    }
    return createQueryBuilder()
  })
  mockSupabaseClient.rpc.mockImplementation((name: string) => {
    if (name === 'ensure_product') {
      return Promise.resolve({ data: 'prod-default', error: null })
    }
    if (name === 'create_production_batch') {
      return Promise.resolve({ data: 'new-batch-id', error: null })
    }
    if (name === 'delete_production_batch') {
      return Promise.resolve({ data: null, error: null })
    }
    return Promise.resolve({ data: null, error: null })
  })
}

beforeEach(() => {
  resetSupabaseMocks()
  setupMocks()
})

describe('ProductionPage', () => {
  it('renders the page header', async () => {
    renderProduction()
    expect(screen.getByRole('heading', { name: /^production$/i })).toBeInTheDocument()
    expect(
      screen.getByText(/record what you made/i)
    ).toBeInTheDocument()
  })

  it('shows Record production button', () => {
    renderProduction()
    expect(screen.getByRole('button', { name: /record production/i })).toBeInTheDocument()
  })

  it('displays batches from Supabase', async () => {
    renderProduction()
    await waitFor(() => {
      expect(screen.getByText('Sourdough Bread')).toBeInTheDocument()
      expect(screen.getByText('Croissants · batch #002')).toBeInTheDocument()
    })
  })

  it('shows summary stats', async () => {
    renderProduction()
    await waitFor(() => {
      expect(screen.getByText('2')).toBeInTheDocument() // Total Batches
      expect(screen.getByText('150')).toBeInTheDocument() // Total Produced (50+100)
    })
  })

  it('opens Record production dialog', async () => {
    const user = userEvent.setup()
    renderProduction()

    await user.click(screen.getByRole('button', { name: /record production/i }))

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByRole('heading', { name: /record production/i })).toBeInTheDocument()
    })
  })

  it('shows error when submitting empty batch form', async () => {
    const user = userEvent.setup()
    renderProduction()

    await user.click(screen.getByRole('button', { name: /record production/i }))
    const dialog = await screen.findByRole('dialog')

    await user.click(within(dialog).getByRole('button', { name: /save production/i }))

    expect(toast.error).toHaveBeenCalledWith('Please fill in all required fields')
  })

  it('creates a batch with valid input via RPC', async () => {
    const user = userEvent.setup()
    const rpcMock = vi
      .fn()
      .mockResolvedValueOnce({ data: 'prod-baguette', error: null })
      .mockResolvedValueOnce({ data: 'new-batch-id', error: null })
    mockSupabaseClient.rpc.mockImplementation(rpcMock)

    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === 'batches') {
        return {
          ...createQueryBuilder({ data: [] }),
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        }
      }
      if (table === 'items') {
        return {
          ...createQueryBuilder({ data: [] }),
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        }
      }
      return createQueryBuilder()
    })

    renderProduction()

    await user.click(screen.getByRole('button', { name: /record production/i }))
    const dlg = await screen.findByRole('dialog')

    await user.click(within(dlg).getByRole('button', { name: /^baguettes$/i }))
    await user.type(within(dlg).getByPlaceholderText(/or type a number/i), '75')
    await user.click(within(dlg).getByRole('button', { name: /save production/i }))

    await waitFor(() => {
      expect(rpcMock).toHaveBeenCalledTimes(2)
      expect(rpcMock.mock.calls[0][0]).toBe('ensure_product')
      expect(rpcMock.mock.calls[0][1]).toMatchObject({
        p_business_id: 'biz-123',
        p_name: 'Baguettes',
      })
      expect(rpcMock).toHaveBeenCalledWith(
        'create_production_batch',
        expect.objectContaining({
          p_business_id: 'biz-123',
          p_units_produced: 75,
          p_display_name: 'Baguettes',
          p_product_id: 'prod-baguette',
          p_lines: [],
          p_units_not_for_sale: 0,
        })
      )
      expect(toast.success).toHaveBeenCalledWith('Saved. Stock updated from what you used.')
    })
  })

  it('confirms before deleting a batch', async () => {
    const user = userEvent.setup()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)

    renderProduction()

    await waitFor(() => screen.getByText('Sourdough Bread'))

    const deleteButtons = screen.getAllByRole('button', { name: '' })
    await user.click(deleteButtons[0])

    expect(confirmSpy).toHaveBeenCalledWith(
      'Delete this batch? Stock from ingredients will be restored if applicable.'
    )
    confirmSpy.mockRestore()
  })
})
