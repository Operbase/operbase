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
  product_name:
    (b.products as { name?: string } | null)?.name ?? (b.notes as string) ?? 'Unnamed batch',
  units_produced: b.units_produced,
  units_remaining: b.units_remaining,
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
    expect(screen.getByRole('heading', { name: /^baking$/i })).toBeInTheDocument()
    expect(
      screen.getByText(/log each bake here/i)
    ).toBeInTheDocument()
  })

  it('shows Log a batch button', () => {
    renderProduction()
    expect(screen.getByRole('button', { name: /log a batch/i })).toBeInTheDocument()
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

  it('opens New Batch dialog', async () => {
    const user = userEvent.setup()
    renderProduction()

    await user.click(screen.getByRole('button', { name: /log a batch/i }))

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText('New batch')).toBeInTheDocument()
    })
  })

  it('shows error when submitting empty batch form', async () => {
    const user = userEvent.setup()
    renderProduction()

    await user.click(screen.getByRole('button', { name: /log a batch/i }))
    const dialog = await screen.findByRole('dialog')

    await user.click(within(dialog).getByRole('button', { name: /save batch/i }))

    expect(toast.error).toHaveBeenCalledWith('Please fill in all required fields')
  })

  it('creates a batch with valid input via RPC', async () => {
    const user = userEvent.setup()
    const rpcMock = vi.fn().mockResolvedValue({ data: 'new-batch-id', error: null })
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

    await user.click(screen.getByRole('button', { name: /log a batch/i }))
    const dlg = await screen.findByRole('dialog')

    await user.click(within(dlg).getByRole('button', { name: /^baguettes$/i }))
    await user.type(within(dlg).getByPlaceholderText(/or type a number/i), '75')
    await user.click(within(dlg).getByRole('button', { name: /save batch/i }))

    await waitFor(() => {
      expect(rpcMock).toHaveBeenCalledWith(
        'create_production_batch',
        expect.objectContaining({
          p_business_id: 'biz-123',
          p_units_produced: 75,
          p_display_name: 'Baguettes',
          p_lines: [],
        })
      )
      expect(toast.success).toHaveBeenCalledWith('Batch saved. Stock updated.')
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
