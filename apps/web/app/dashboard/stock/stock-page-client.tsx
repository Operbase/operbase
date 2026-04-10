'use client'

import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Trash2, Plus, AlertCircle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useBusinessContext } from '@/providers/business-provider'
import { formatCurrency } from '@/lib/format-currency'
import { trackEvent } from '@/lib/services/events'
import { costPerUsageUnit, usageQuantityFromPurchaseQty } from '@/lib/bakery/cost'
import {
  COMMON_INGREDIENTS,
  COMMON_PACKAGING,
  type IngredientPreset,
} from '@/lib/bakery/simple-presets'
import { CupFractionRow, WholeNumberChips } from '@/components/bakery-quick-picks'
import type { StockItemRow, StockUnitRow } from '@/lib/dashboard/stock-data'
import { loadWeeklyStock, type WeeklyStockRow } from '@/lib/dashboard/weekly-stock-data'
import { friendlyError } from '@/lib/errors'

type Item = StockItemRow
type Unit = StockUnitRow

// Ratio = how many usage units fit in one purchase unit
// e.g. kilogram → gram: 1 kg = 1000 g, ratio = 1000
const KNOWN_RATIOS: Record<string, number> = {
  'kilogram→gram': 1000,
  'litre→millilitre': 1000,
  'dozen→piece': 12,
}

function unitIdByName(units: Unit[], unitName: string): string {
  const n = unitName.toLowerCase()
  return units.find((u) => u.name.toLowerCase() === n)?.id ?? ''
}

function isLowStock(item: Item): boolean {
  if (item.quantity_on_hand <= 0) return true
  if (item.low_stock_threshold != null && item.quantity_on_hand <= item.low_stock_threshold) {
    return true
  }
  return false
}

export function StockPageClient({
  initialItems,
  initialUnits,
}: {
  initialItems: StockItemRow[]
  initialUnits: StockUnitRow[]
}) {
  const { businessId, currency, timezone } = useBusinessContext()
  const [items, setItems] = useState<Item[]>(initialItems)
  const [units, setUnits] = useState<Unit[]>(initialUnits)
  const [isLoading, setIsLoading] = useState(false)
  const skipSsrItemsFetch = useRef(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [restockDialogOpen, setRestockDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<Item | null>(null)
  const [restockItem, setRestockItem] = useState<Item | null>(null)
  const [activeTab, setActiveTab] = useState<'ingredient' | 'packaging' | 'weekly'>('ingredient')
  const [restockPurchaseQty, setRestockPurchaseQty] = useState('')
  const [restockCostPerPurchase, setRestockCostPerPurchase] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 50
  const [search, setSearch] = useState('')
  const [weeklyRows, setWeeklyRows] = useState<WeeklyStockRow[]>([])
  const [weeklyLoading, setWeeklyLoading] = useState(false)
  const weeklyFetchedRef = useRef(false)

  const [form, setForm] = useState({
    name: '',
    purchaseUnitId: '',
    usageUnitId: '',
    conversionRatio: '1',
    costPerPurchase: '',
    openingPurchaseQty: '',
    lowStockThreshold: '',
    notes: '',
  })

  const supabase = useMemo(() => createClient(), [])

  const presets = useMemo(
    () => (activeTab === 'ingredient' ? COMMON_INGREDIENTS : COMMON_PACKAGING),
    [activeTab]
  )

  // Auto-fill conversion ratio for known unit pairs
  useEffect(() => {
    if (!form.purchaseUnitId || !form.usageUnitId) return
    if (form.purchaseUnitId === form.usageUnitId) {
      setForm((f) => ({ ...f, conversionRatio: '1' }))
      return
    }
    const pName = units.find((u) => u.id === form.purchaseUnitId)?.name?.toLowerCase() ?? ''
    const uName = units.find((u) => u.id === form.usageUnitId)?.name?.toLowerCase() ?? ''
    const key = `${pName}→${uName}`
    const known = KNOWN_RATIOS[key]
    if (known) {
      setForm((f) => ({ ...f, conversionRatio: String(known) }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.purchaseUnitId, form.usageUnitId])

  const fetchItems = useCallback(async () => {
    if (!businessId) return
    setIsLoading(true)

    const from = page * PAGE_SIZE
    const to = from + PAGE_SIZE - 1

    let query = supabase
      .from('items')
      .select(
        `
        *,
        purchase_unit:units!items_purchase_unit_id_fkey (id, name),
        usage_unit:units!items_usage_unit_id_fkey (id, name)
      `
      )
      .eq('business_id', businessId)
      .eq('type', activeTab)

    if (search.trim()) {
      query = query.ilike('name', `%${search.trim()}%`)
    }

    const { data: itemsData, error: itemsError } = await query
      .range(from, to)
      .order('name')

    if (itemsError) {
      toast.error(friendlyError(itemsError, 'Failed to load items'))
      setIsLoading(false)
      return
    }

    const { data: stockData, error: stockError } = await supabase
      .from('stock_levels')
      .select('item_id, quantity_on_hand')
      .eq('business_id', businessId)

    if (stockError) {
      toast.error('Failed to load stock levels')
    }

    const stockMap = new Map(
      (stockData ?? []).map((s) => [s.item_id, Number(s.quantity_on_hand ?? 0)])
    )

    setItems(
      (itemsData ?? []).map((row: Record<string, unknown>) => {
        const purchaseUnit = row.purchase_unit as { name?: string } | null
        const usageUnit = row.usage_unit as { name?: string } | null
        return {
          id: row.id as string,
          name: row.name as string,
          type: row.type as string,
          unit_id: row.unit_id as string | null,
          purchase_unit_id: row.purchase_unit_id as string | null,
          usage_unit_id: row.usage_unit_id as string | null,
          purchase_unit_name: purchaseUnit?.name ?? '',
          usage_unit_name: usageUnit?.name ?? '',
          conversion_ratio: Number(row.conversion_ratio ?? 1),
          cost_per_unit: Number(row.cost_per_unit ?? 0),
          quantity_on_hand: stockMap.get(row.id as string) ?? 0,
          low_stock_threshold:
            row.low_stock_threshold != null ? Number(row.low_stock_threshold) : null,
          notes: row.notes as string | null,
        }
      })
    )

    setIsLoading(false)
  }, [businessId, supabase, page, activeTab, search])

  useEffect(() => {
    setItems(initialItems)
  }, [initialItems])

  useEffect(() => {
    setUnits(initialUnits)
  }, [initialUnits])

  useEffect(() => {
    if (!businessId) return
    if (initialUnits.length === 0) {
      void supabase
        .from('units')
        .select('id, name, type')
        .order('name')
        .then(({ data }) => setUnits(data ?? []))
    }
  }, [businessId, initialUnits.length, supabase])

  useEffect(() => {
    if (!businessId) return
    const isDefaultView = activeTab === 'ingredient' && page === 0 && !search.trim()
    if (skipSsrItemsFetch.current && isDefaultView) {
      skipSsrItemsFetch.current = false
      return
    }
    void fetchItems()
  }, [businessId, fetchItems, page, activeTab, search])

  // Reset to page 0 when tab changes
  useEffect(() => {
    setPage(0)
  }, [activeTab])

  // Load weekly data when weekly tab is first opened
  useEffect(() => {
    if (activeTab !== 'weekly' || !businessId || weeklyFetchedRef.current) return
    weeklyFetchedRef.current = true
    setWeeklyLoading(true)
    loadWeeklyStock(supabase, businessId, timezone ?? 'UTC')
      .then((rows) => setWeeklyRows(rows))
      .catch((err) => toast.error(friendlyError(err, 'Could not load weekly view')))
      .finally(() => setWeeklyLoading(false))
  }, [activeTab, businessId, supabase, timezone])

  // Reset to page 0 when search changes
  useEffect(() => {
    setPage(0)
  }, [search])

  function openAddBlank() {
    setEditingItem(null)
    const kg = unitIdByName(units, 'kilogram')
    setForm({
      name: '',
      purchaseUnitId: kg,
      usageUnitId: kg,
      conversionRatio: '1',
      costPerPurchase: '',
      openingPurchaseQty: '1',
      lowStockThreshold: '',
      notes: '',
    })
    setDialogOpen(true)
  }

  function openFromPreset(preset: IngredientPreset) {
    setEditingItem(null)
    const uid = unitIdByName(units, preset.unit)
    if (!uid) {
      toast.error(
        `We couldn't find a unit called "${preset.unit}". Tap "${activeTab === 'ingredient' ? 'Other ingredient' : 'Other packaging'}" to add this and pick your own unit.`
      )
      return
    }
    setForm({
      name: preset.name,
      purchaseUnitId: uid,
      usageUnitId: uid,
      conversionRatio: '1',
      costPerPurchase: '',
      openingPurchaseQty: '1',
      lowStockThreshold: '',
      notes: '',
    })
    setDialogOpen(true)
  }

  function openEdit(item: Item) {
    setEditingItem(item)
    setForm({
      name: item.name,
      purchaseUnitId: item.purchase_unit_id ?? '',
      usageUnitId: item.usage_unit_id ?? '',
      conversionRatio: item.conversion_ratio.toString(),
      costPerPurchase: item.cost_per_unit.toString(),
      openingPurchaseQty: '',
      lowStockThreshold: item.low_stock_threshold?.toString() ?? '',
      notes: item.notes ?? '',
    })
    setDialogOpen(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!businessId || isSubmitting) return
    if (!form.name.trim()) {
      toast.error('Pick a name or type one in')
      return
    }

    const ratio = parseFloat(form.conversionRatio)
    if (!ratio || ratio <= 0) {
      toast.error('Conversion ratio must be more than zero')
      return
    }

    const purchaseId = form.purchaseUnitId || null
    const usageId = form.usageUnitId || null
    if (!purchaseId || !usageId) {
      toast.error('Choose how you buy it and how you measure it in recipes')
      return
    }

    const costPurchase = parseFloat(form.costPerPurchase) || 0
    setIsSubmitting(true)

    try {
      const payload = {
        business_id: businessId,
        name: form.name.trim(),
        type: activeTab,
        unit_id: usageId,
        purchase_unit_id: purchaseId,
        usage_unit_id: usageId,
        conversion_ratio: ratio,
        cost_per_unit: costPurchase,
        low_stock_threshold:
          form.lowStockThreshold.trim() === '' ? null : parseFloat(form.lowStockThreshold),
        notes: form.notes || null,
      }

      if (editingItem) {
        const { error } = await supabase.from('items').update(payload).eq('id', editingItem.id)
        if (error) throw error
        toast.success('Saved!')
      } else {
        const { data: newItem, error } = await supabase.from('items').insert(payload).select().single()
        if (error) throw error

        const openingPurchase = parseFloat(form.openingPurchaseQty)
        if (openingPurchase > 0) {
          const totalPaid = costPurchase * openingPurchase
          const { error: lotErr } = await supabase.rpc('add_purchase_lot', {
            p_business_id: businessId,
            p_item_id: newItem.id,
            p_purchase_qty: openingPurchase,
            p_total_cost_paid: totalPaid,
            p_note: 'Opening stock',
          })
          if (lotErr) throw lotErr
        }

        trackEvent('item_created', businessId, { item_type: activeTab })
        toast.success('Added!')
      }

      setDialogOpen(false)
      fetchItems()
    } catch (error: unknown) {
      const code = (error as Record<string, unknown>)?.code
      if (code === '23505') {
        toast.error(
          `You already have an item called "${form.name.trim()}". Use Add stock on the list to buy more.`
        )
      } else {
        toast.error(friendlyError(error, 'Failed to save'))
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Remove this item and all its history?')) return

    const { error } = await supabase.from('items').delete().eq('id', id)
    if (error) {
      toast.error(friendlyError(error))
      return
    }
    toast.success('Removed')
    fetchItems()
  }

  async function handleRestock(e: React.FormEvent) {
    e.preventDefault()
    if (!businessId || !restockItem || isSubmitting) return
    const purchaseQty = parseFloat(restockPurchaseQty)
    if (!purchaseQty || purchaseQty <= 0) {
      toast.error('Pick an amount below or type a number')
      return
    }

    const enteredCost = parseFloat(restockCostPerPurchase)
    const costPerPurchase =
      enteredCost > 0 ? enteredCost : restockItem.cost_per_unit

    setIsSubmitting(true)
    try {
      const ratio = restockItem.conversion_ratio > 0 ? restockItem.conversion_ratio : 1
      const usageQty = usageQuantityFromPurchaseQty(purchaseQty, ratio)
      const totalPaid = costPerPurchase * purchaseQty

      const { error } = await supabase.rpc('add_purchase_lot', {
        p_business_id: businessId,
        p_item_id: restockItem.id,
        p_purchase_qty: purchaseQty,
        p_total_cost_paid: totalPaid,
        p_note: 'Add stock',
      })

      if (error) throw error

      if (costPerPurchase !== restockItem.cost_per_unit) {
        await supabase
          .from('items')
          .update({ cost_per_unit: costPerPurchase })
          .eq('id', restockItem.id)
      }

      trackEvent('stock_updated', businessId, { item_id: restockItem.id, quantity: usageQty })
      toast.success(`Added to ${restockItem.name}`)
      setRestockDialogOpen(false)
      setRestockPurchaseQty('')
      setRestockCostPerPurchase('')
      fetchItems()
    } catch (error: unknown) {
      toast.error(friendlyError(error, 'Failed to restock'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const displayItems = items.filter((i) => i.type === activeTab)
  const totalValue = displayItems.reduce((sum, i) => {
    const cpu = costPerUsageUnit(i.cost_per_unit, i.conversion_ratio)
    return sum + i.quantity_on_hand * cpu
  }, 0)

  const lowStockCount = displayItems.filter(isLowStock).length
  const purchaseIsCup = restockItem?.purchase_unit_name?.toLowerCase() === 'cup'

  // Derived values for the add/edit form
  const purchaseUnitName = units.find((u) => u.id === form.purchaseUnitId)?.name ?? ''
  const usageUnitName = units.find((u) => u.id === form.usageUnitId)?.name ?? ''
  const sameUnit = form.purchaseUnitId && form.purchaseUnitId === form.usageUnitId
  const autoRatioKey = `${purchaseUnitName.toLowerCase()}→${usageUnitName.toLowerCase()}`
  const autoRatio = !sameUnit ? KNOWN_RATIOS[autoRatioKey] : undefined
  const showRatioInput = form.purchaseUnitId && form.usageUnitId && !sameUnit && !autoRatio

  const costPreviewPurchase = parseFloat(form.costPerPurchase)
  const costPreviewRatio = parseFloat(form.conversionRatio) || 1

  const restockLive = useMemo(() => {
    if (!restockItem) return null
    const pq = parseFloat(restockPurchaseQty)
    const cp = parseFloat(restockCostPerPurchase)
    const ratio = restockItem.conversion_ratio > 0 ? restockItem.conversion_ratio : 1
    if (!pq || pq <= 0) return null
    const priceOne = cp > 0 ? cp : restockItem.cost_per_unit
    const totalSpend = priceOne * pq
    const perRecipe = costPerUsageUnit(priceOne, ratio)
    const usageAdded = usageQuantityFromPurchaseQty(pq, ratio)
    return { totalSpend, perRecipe, usageAdded }
  }, [restockItem, restockPurchaseQty, restockCostPerPurchase])

  const addButtonLabel = activeTab === 'ingredient' ? 'Other ingredient' : 'Other packaging'
  const dialogTitle = editingItem
    ? `Change ${editingItem.name}`
    : activeTab === 'ingredient'
      ? 'Add ingredient'
      : 'Add packaging'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Stock</h1>
        <p className="text-gray-600 mt-1">
          When you buy something, add it here. We show what each gram, cup, or piece costs you so
          production stays honest.
        </p>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button
              onClick={openAddBlank}
              size="lg"
              style={{ backgroundColor: 'var(--brand)' }}
              className="min-h-12 text-white hover:opacity-90"
            >
              <Plus className="mr-2" size={20} />
              {addButtonLabel}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md p-0">
            {/* Branded header */}
            <div
              className="px-6 py-4 rounded-t-lg"
              style={{
                backgroundColor: 'var(--brand-light)',
                borderBottom: '1px solid var(--brand-mid)',
              }}
            >
              <DialogHeader>
                <DialogTitle className="text-lg font-semibold" style={{ color: 'var(--brand-dark)' }}>
                  {dialogTitle}
                </DialogTitle>
              </DialogHeader>
            </div>
            <div className="px-6 py-5">
              <form noValidate onSubmit={handleSave} className="space-y-4">
                {/* Name */}
                <div>
                  <Label htmlFor="name">What is it?</Label>
                  <Input
                    id="name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder={
                      activeTab === 'ingredient'
                        ? 'e.g. Bread flour, large eggs'
                        : 'e.g. Takeaway boxes, paper bags'
                    }
                    className="min-h-11 text-base mt-1"
                  />
                </div>

                {/* Purchase unit */}
                <div>
                  <Label htmlFor="purchaseUnit">How you buy it</Label>
                  <select
                    id="purchaseUnit"
                    value={form.purchaseUnitId}
                    onChange={(e) => setForm({ ...form, purchaseUnitId: e.target.value })}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-md text-base min-h-11 mt-1"
                  >
                    <option value="">Select unit</option>
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Cost per purchase */}
                <div>
                  <Label htmlFor="cost">
                    What you paid for one {purchaseUnitName || 'purchase'}
                  </Label>
                  <Input
                    id="cost"
                    type="number"
                    step="0.01"
                    min="0"
                    inputMode="decimal"
                    value={form.costPerPurchase}
                    onChange={(e) => setForm({ ...form, costPerPurchase: e.target.value })}
                    placeholder="0.00"
                    className="min-h-11 text-base mt-1"
                  />
                </div>

                {/* Usage unit */}
                <div>
                  <Label htmlFor="usageUnit">How you measure it in recipes</Label>
                  <select
                    id="usageUnit"
                    value={form.usageUnitId}
                    onChange={(e) => setForm({ ...form, usageUnitId: e.target.value })}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-md text-base min-h-11 mt-1"
                  >
                    <option value="">Select unit</option>
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                  {sameUnit && purchaseUnitName && (
                    <p className="text-xs text-gray-500 mt-1">
                      Tracking in {purchaseUnitName} — same as how you buy it.
                    </p>
                  )}
                  {autoRatio && !sameUnit && (
                    <p className="text-xs mt-1" style={{ color: 'var(--brand-dark)' }}>
                      1 {purchaseUnitName} = {autoRatio} {usageUnitName} — we have worked this out for you.
                    </p>
                  )}
                </div>

                {/* Ratio input — only for unknown unit pairs */}
                {showRatioInput && (
                  <div>
                    <Label htmlFor="ratio">
                      How many {usageUnitName || 'units'} in one {purchaseUnitName || 'purchase unit'}?
                    </Label>
                    <Input
                      id="ratio"
                      type="number"
                      step="0.000001"
                      min="0.000001"
                      inputMode="decimal"
                      value={form.conversionRatio}
                      onChange={(e) => setForm({ ...form, conversionRatio: e.target.value })}
                      placeholder="e.g. 4"
                      className="min-h-11 mt-1"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      e.g. if 1 bag holds 4 cups, enter 4
                    </p>
                  </div>
                )}

                {/* Opening qty — new items only */}
                {!editingItem && (
                  <div>
                    <Label htmlFor="openingQty">
                      How many did you buy?
                    </Label>
                    <p className="text-xs text-gray-500 mt-0.5">
                      In {purchaseUnitName || 'purchase units'} — this sets your starting stock
                    </p>
                    <WholeNumberChips
                      values={[1, 2, 5, 10]}
                      onPick={(n) => setForm((f) => ({ ...f, openingPurchaseQty: String(n) }))}
                      className="my-2"
                    />
                    <Input
                      id="openingQty"
                      type="number"
                      step="0.01"
                      min="0"
                      inputMode="decimal"
                      value={form.openingPurchaseQty}
                      onChange={(e) => setForm({ ...form, openingPurchaseQty: e.target.value })}
                      className="min-h-11 text-base"
                    />
                  </div>
                )}

                {/* Cost preview */}
                {costPreviewPurchase > 0 && (
                  <div
                    className="rounded-lg border p-3 space-y-1.5 text-sm"
                    style={{
                      borderColor: 'var(--brand-mid)',
                      backgroundColor: 'var(--brand-light)',
                    }}
                  >
                    <div className="flex justify-between gap-3">
                      <span className="text-gray-700">Per {purchaseUnitName || 'purchase'}</span>
                      <strong className="tabular-nums" style={{ color: 'var(--brand-dark)' }}>
                        {formatCurrency(costPreviewPurchase, currency)}
                      </strong>
                    </div>
                    {!sameUnit && costPreviewRatio > 0 && usageUnitName && (
                      <div className="flex justify-between gap-3">
                        <span className="text-gray-700">Per {usageUnitName}</span>
                        <strong className="tabular-nums" style={{ color: 'var(--brand-dark)' }}>
                          {formatCurrency(
                            costPerUsageUnit(costPreviewPurchase, costPreviewRatio),
                            currency
                          )}
                        </strong>
                      </div>
                    )}
                  </div>
                )}

                {/* Advanced options */}
                <details className="text-sm border rounded-lg p-3 bg-gray-50">
                  <summary className="cursor-pointer font-medium text-gray-800 py-1">
                    More options
                  </summary>
                  <div className="space-y-3 pt-3 mt-2 border-t">
                    <div>
                      <Label htmlFor="lowStock">Alert me when at or below (optional)</Label>
                      <Input
                        id="lowStock"
                        type="number"
                        step="0.01"
                        min="0"
                        value={form.lowStockThreshold}
                        onChange={(e) => setForm({ ...form, lowStockThreshold: e.target.value })}
                        className="min-h-11 mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="notes">Notes</Label>
                      <Input
                        id="notes"
                        value={form.notes}
                        onChange={(e) => setForm({ ...form, notes: e.target.value })}
                        className="min-h-11 mt-1"
                      />
                    </div>
                  </div>
                </details>

                <Button
                  type="submit"
                  size="lg"
                  className="w-full min-h-12 text-base text-white hover:opacity-90"
                  style={{ backgroundColor: 'var(--brand)' }}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={18} className="mr-2 animate-spin" />
                      Saving…
                    </>
                  ) : editingItem ? (
                    'Save changes'
                  ) : (
                    'Save'
                  )}
                </Button>
              </form>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="flex gap-3">
        <Input
          type="search"
          placeholder="Search by name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs min-h-10"
        />
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as 'ingredient' | 'packaging' | 'weekly')}
      >
        <TabsList className="h-12 w-full sm:w-auto">
          <TabsTrigger value="ingredient" className="text-base px-6">
            Ingredients
          </TabsTrigger>
          <TabsTrigger value="packaging" className="text-base px-6">
            Packaging
          </TabsTrigger>
          <TabsTrigger value="weekly" className="text-base px-6">
            This week
          </TabsTrigger>
        </TabsList>

        <TabsContent value="weekly" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">What moved this week</CardTitle>
            </CardHeader>
            <CardContent>
              {weeklyLoading ? (
                <p className="text-center text-gray-500 py-8">Loading…</p>
              ) : weeklyRows.length === 0 ? (
                <p className="text-center text-gray-500 py-8">
                  No stock movement recorded this week yet.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead className="text-right tabular-nums">Start of week</TableHead>
                        <TableHead className="text-right tabular-nums">Used</TableHead>
                        <TableHead className="text-right tabular-nums">Added</TableHead>
                        <TableHead className="text-right tabular-nums">On hand now</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {weeklyRows.map((row) => (
                        <TableRow key={row.itemId}>
                          <TableCell className="font-medium">
                            {row.name}
                            {row.usageUnitName ? (
                              <span className="text-xs text-gray-500 ml-1">
                                ({row.usageUnitName})
                              </span>
                            ) : null}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-gray-600">
                            {row.startOfWeek.toFixed(1)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-red-700">
                            {row.usedThisWeek > 0 ? `-${row.usedThisWeek.toFixed(1)}` : '—'}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-green-700">
                            {row.addedThisWeek > 0 ? `+${row.addedThisWeek.toFixed(1)}` : '—'}
                          </TableCell>
                          <TableCell className="text-right tabular-nums font-medium">
                            {row.onHandNow.toFixed(1)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {activeTab !== 'weekly' && (
          <TabsContent value={activeTab} className="mt-4 space-y-4">
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Quick add</p>
              <div className="flex flex-wrap gap-2">
                {presets.map((p) => (
                  <Button
                    key={p.name}
                    type="button"
                    variant="outline"
                    size="lg"
                    className="min-h-11 text-base border-amber-200 hover:bg-amber-50"
                    onClick={() => openFromPreset(p)}
                  >
                    {p.name}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-4 text-sm text-gray-600">
              <span>
                <strong className="text-gray-900">{displayItems.length}</strong> items
              </span>
              <span>
                Stock value ~
                <strong className="text-gray-900">{formatCurrency(totalValue, currency)}</strong>
              </span>
              {lowStockCount > 0 && (
                <span className="text-orange-700 font-medium">{lowStockCount} need attention</span>
              )}
            </div>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Your list</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <p className="text-center text-gray-500 py-8">Loading…</p>
                ) : displayItems.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">
                    Nothing added yet. Tap a preset above, or tap &quot;
                    {addButtonLabel}&quot; to add your first{' '}
                    {activeTab === 'ingredient' ? 'ingredient' : 'packaging item'}.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Item</TableHead>
                          <TableHead>On hand</TableHead>
                          <TableHead>Unit</TableHead>
                          <TableHead className="text-right tabular-nums">Cost to you</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {displayItems.map((item) => {
                          const low = isLowStock(item)
                          return (
                            <TableRow key={item.id} className={low ? 'bg-orange-50' : ''}>
                              <TableCell className="font-medium text-base">
                                {low && (
                                  <AlertCircle
                                    size={18}
                                    className="inline mr-2 text-orange-600 align-text-bottom"
                                    aria-hidden
                                  />
                                )}
                                {item.name}
                              </TableCell>
                              <TableCell className="text-base tabular-nums">
                                {item.quantity_on_hand.toFixed(1)}
                              </TableCell>
                              <TableCell className="text-base">{item.usage_unit_name}</TableCell>
                              <TableCell className="text-base text-right tabular-nums text-gray-700">
                                {formatCurrency(
                                  costPerUsageUnit(item.cost_per_unit, item.conversion_ratio),
                                  currency
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex flex-wrap gap-2 justify-end">
                                  <Button
                                    size="lg"
                                    className="min-h-11 text-white hover:opacity-90"
                                    style={{ backgroundColor: 'var(--brand)' }}
                                    onClick={() => {
                                      setRestockItem(item)
                                      setRestockPurchaseQty('')
                                      setRestockCostPerPurchase(item.cost_per_unit.toString())
                                      setRestockDialogOpen(true)
                                    }}
                                  >
                                    Add stock
                                  </Button>
                                  <Button
                                    size="lg"
                                    variant="outline"
                                    className="min-h-11"
                                    onClick={() => openEdit(item)}
                                  >
                                    Edit
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="text-destructive min-h-11 min-w-11"
                                    onClick={() => handleDelete(item.id)}
                                    aria-label={`Remove ${item.name}`}
                                  >
                                    <Trash2 size={20} />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                    {displayItems.length === PAGE_SIZE && (
                      <div className="flex items-center justify-between mt-4 text-sm text-gray-600">
                        <span>Page {page + 1}</span>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={page === 0}
                            onClick={() => setPage((p) => p - 1)}
                          >
                            Previous
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage((p) => p + 1)}
                          >
                            Next
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* Restock dialog */}
      <Dialog open={restockDialogOpen} onOpenChange={setRestockDialogOpen}>
        <DialogContent className="sm:max-w-md p-0">
          {/* Branded header */}
          <div
            className="px-6 py-4 rounded-t-lg"
            style={{
              backgroundColor: 'var(--brand-light)',
              borderBottom: '1px solid var(--brand-mid)',
            }}
          >
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold" style={{ color: 'var(--brand-dark)' }}>
                Add stock: {restockItem?.name}
              </DialogTitle>
            </DialogHeader>
          </div>
          <div className="px-6 py-5">
            <form noValidate onSubmit={handleRestock} className="space-y-4">
              <p className="text-sm text-gray-600">
                Count in <strong>{restockItem?.purchase_unit_name}</strong>
                {restockItem && restockItem.conversion_ratio !== 1 && (
                  <>
                    {' '}
                    (1 {restockItem.purchase_unit_name} = {restockItem.conversion_ratio}{' '}
                    {restockItem.usage_unit_name})
                  </>
                )}
              </p>
              <div>
                <Label className="text-base">Quick amounts</Label>
                <div className="mt-2 space-y-3">
                  {purchaseIsCup && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Cup measures</p>
                      <CupFractionRow onPick={(v) => setRestockPurchaseQty(String(v))} />
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Whole numbers</p>
                    <WholeNumberChips
                      values={[1, 2, 3, 5, 10]}
                      onPick={(n) => setRestockPurchaseQty(String(n))}
                    />
                  </div>
                </div>
              </div>
              <div>
                <Label htmlFor="restockQty" className="text-base">
                  How many {restockItem?.purchase_unit_name ?? 'units'} did you buy?
                </Label>
                <Input
                  id="restockQty"
                  type="number"
                  step="0.01"
                  min="0.01"
                  inputMode="decimal"
                  value={restockPurchaseQty}
                  onChange={(e) => setRestockPurchaseQty(e.target.value)}
                  className="min-h-12 text-lg mt-1"
                  autoFocus
                />
              </div>
              <div>
                {(() => {
                  const pq = parseFloat(restockPurchaseQty)
                  const unit = restockItem?.purchase_unit_name ?? 'unit'
                  const qtyStr = pq > 0 ? `${pq} ${unit}` : unit
                  return (
                    <Label htmlFor="restockCost" className="text-base">
                      How much did you pay for {qtyStr}?
                    </Label>
                  )
                })()}
                <p className="text-xs text-gray-500 mt-0.5">
                  Update if the price has changed since last time
                </p>
                <Input
                  id="restockCost"
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  value={restockCostPerPurchase}
                  onChange={(e) => setRestockCostPerPurchase(e.target.value)}
                  className="min-h-11 mt-1"
                />
              </div>
              {restockLive && restockItem ? (
                <div
                  className="rounded-lg border p-3 text-sm space-y-2"
                  style={{
                    borderColor: 'var(--brand-mid)',
                    backgroundColor: 'var(--brand-light)',
                  }}
                >
                  <div className="flex justify-between gap-3 text-gray-800">
                    <span>Total for this add</span>
                    <strong className="tabular-nums">
                      {formatCurrency(restockLive.totalSpend, currency)}
                    </strong>
                  </div>
                  <div className="flex justify-between gap-3 text-gray-700 text-xs">
                    <span>
                      Adds ~{restockLive.usageAdded.toFixed(1)} {restockItem.usage_unit_name} to
                      stock
                    </span>
                  </div>
                  <p
                    className="text-xs border-t pt-2"
                    style={{ borderColor: 'var(--brand-mid)', color: 'var(--brand-dark)' }}
                  >
                    Each {restockItem.usage_unit_name} will cost{' '}
                    <strong>{formatCurrency(restockLive.perRecipe, currency)}</strong>.
                  </p>
                </div>
              ) : null}
              <Button
                type="submit"
                size="lg"
                className="w-full min-h-12 text-base text-white hover:opacity-90"
                style={{ backgroundColor: 'var(--brand)' }}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={18} className="mr-2 animate-spin" />
                    Adding…
                  </>
                ) : (
                  'Add to stock'
                )}
              </Button>
            </form>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
