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

import type { StockItemRow } from '@/lib/dashboard/stock-data'
import { StockPageClient } from '@/app/dashboard/stock/stock-page-client'

function toInitialStockItems(): StockItemRow[] {
  return MOCK_ITEMS.filter((row) => row.type === 'ingredient').map((row) => {
    const q = MOCK_STOCK.find((s) => s.item_id === row.id)?.quantity_on_hand ?? 0
    const purchaseUnit = row.purchase_unit as { name?: string }
    const usageUnit = row.usage_unit as { name?: string }
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      unit_id: row.unit_id,
      purchase_unit_id: row.purchase_unit_id,
      usage_unit_id: row.usage_unit_id,
      purchase_unit_name: purchaseUnit?.name ?? '',
      usage_unit_name: usageUnit?.name ?? '',
      conversion_ratio: row.conversion_ratio,
      cost_per_unit: row.cost_per_unit,
      quantity_on_hand: q,
      low_stock_threshold: row.low_stock_threshold,
      notes: row.notes,
    }
  })
}

function renderStock() {
  return render(
    <StockPageClient initialItems={toInitialStockItems()} initialUnits={MOCK_UNITS} />
  )
}

const MOCK_ITEMS = [
  {
    id: 'item-1',
    name: 'All-Purpose Flour',
    type: 'ingredient',
    unit_id: 'unit-1',
    purchase_unit_id: 'unit-1',
    usage_unit_id: 'unit-1',
    conversion_ratio: 1,
    low_stock_threshold: null,
    purchase_unit: { id: 'unit-1', name: 'kilogram' },
    usage_unit: { id: 'unit-1', name: 'kilogram' },
    cost_per_unit: 2.5,
    notes: null,
  },
  {
    id: 'item-2',
    name: 'Bread Boxes',
    type: 'packaging',
    unit_id: 'unit-2',
    purchase_unit_id: 'unit-2',
    usage_unit_id: 'unit-2',
    conversion_ratio: 1,
    low_stock_threshold: null,
    purchase_unit: { id: 'unit-2', name: 'piece' },
    usage_unit: { id: 'unit-2', name: 'piece' },
    cost_per_unit: 0.5,
    notes: null,
  },
]

const MOCK_STOCK = [
  { item_id: 'item-1', quantity_on_hand: 50 },
  { item_id: 'item-2', quantity_on_hand: 100 },
]

const MOCK_UNITS = [
  { id: 'unit-1', name: 'kilogram', type: 'weight' },
  { id: 'unit-2', name: 'piece', type: 'count' },
]

function setupMocks() {
  mockSupabaseClient.from.mockImplementation((table: string) => {
    if (table === 'items') {
      return {
        ...createQueryBuilder({ data: MOCK_ITEMS }),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: MOCK_ITEMS, error: null }),
        insert: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: MOCK_ITEMS[0], error: null }),
      }
    }
    if (table === 'stock_levels') {
      return {
        ...createQueryBuilder({ data: MOCK_STOCK }),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: MOCK_STOCK, error: null }),
      }
    }
    if (table === 'units') {
      return {
        ...createQueryBuilder({ data: MOCK_UNITS }),
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: MOCK_UNITS, error: null }),
      }
    }
    if (table === 'stock_entries') {
      return {
        ...createQueryBuilder(),
        insert: vi.fn().mockResolvedValue({ error: null }),
      }
    }
    return createQueryBuilder()
  })
}

beforeEach(() => {
  resetSupabaseMocks()
  setupMocks()
})

describe('StockPage', () => {
  it('renders the page header', async () => {
    renderStock()
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /^stock$/i })).toBeInTheDocument()
      expect(
        screen.getByText(/Track what you buy and use/i)
      ).toBeInTheDocument()
    })
  })

  it('shows Other item button', async () => {
    renderStock()
    expect(screen.getByRole('button', { name: /other item/i })).toBeInTheDocument()
  })

  it('shows ingredient tab by default', async () => {
    renderStock()
    await waitFor(() => {
      expect(screen.getByText('All-Purpose Flour')).toBeInTheDocument()
    })
  })

  it('switches to packaging tab and shows packaging items', async () => {
    const user = userEvent.setup()
    renderStock()

    await waitFor(() => screen.getByText('All-Purpose Flour'))
    await user.click(screen.getByRole('tab', { name: /packaging/i }))

    await waitFor(() => {
      expect(screen.getByText('Bread Boxes')).toBeInTheDocument()
    })
  })

  it('opens Add Item dialog when button clicked', async () => {
    const user = userEvent.setup()
    renderStock()

    await user.click(screen.getByRole('button', { name: /other item/i }))

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText('Add item')).toBeInTheDocument()
    })
  })

  it('shows error when saving item without a name', async () => {
    const user = userEvent.setup()
    renderStock()

    await user.click(screen.getByRole('button', { name: /other item/i }))
    const dialog = await screen.findByRole('dialog')

    await user.click(within(dialog).getByRole('button', { name: /^save$/i }))

    expect(toast.error).toHaveBeenCalledWith('Pick a name or type one in')
  })

  it('calls supabase insert when saving a valid new item', async () => {
    const user = userEvent.setup()

    const insertMock = vi.fn().mockReturnThis()
    const selectMock = vi.fn().mockReturnThis()
    const singleMock = vi.fn().mockResolvedValue({ data: { id: 'new-item' }, error: null })

    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === 'items') {
        return {
          ...createQueryBuilder(),
          select: selectMock,
          insert: insertMock,
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
          single: singleMock,
        }
      }
      if (table === 'stock_levels') {
        return {
          ...createQueryBuilder({ data: [] }),
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        }
      }
      if (table === 'units') {
        return {
          ...createQueryBuilder({ data: MOCK_UNITS }),
          select: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: MOCK_UNITS, error: null }),
        }
      }
      return createQueryBuilder()
    })

    renderStock()

    await user.click(screen.getByRole('button', { name: /other item/i }))
    const dialog = await screen.findByRole('dialog')

    await user.type(within(dialog).getByPlaceholderText(/what do you call it/i), 'Butter')
    await user.type(within(dialog).getByLabelText(/^price per unit$/i), '3')
    await user.click(within(dialog).getByRole('button', { name: /^save$/i }))

    await waitFor(() => {
      expect(insertMock).toHaveBeenCalled()
    })
  })

  it('confirms before deleting an item', async () => {
    const user = userEvent.setup()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)

    renderStock()

    await waitFor(() => screen.getByText('All-Purpose Flour'))
    await user.click(screen.getByRole('button', { name: /remove all-purpose flour/i }))

    expect(confirmSpy).toHaveBeenCalled()
    confirmSpy.mockRestore()
  })
})
