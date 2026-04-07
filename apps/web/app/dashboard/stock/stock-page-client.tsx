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
import { friendlyError } from '@/lib/errors'

type Item = StockItemRow
type Unit = StockUnitRow

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
  const { businessId, currency } = useBusinessContext()
  const [items, setItems] = useState<Item[]>(initialItems)
  const [units, setUnits] = useState<Unit[]>(initialUnits)
  const [isLoading, setIsLoading] = useState(false)
  const skipSsrItemsFetch = useRef(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [restockDialogOpen, setRestockDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<Item | null>(null)
  const [restockItem, setRestockItem] = useState<Item | null>(null)
  const [activeTab, setActiveTab] = useState<'ingredient' | 'packaging'>('ingredient')
  const [restockPurchaseQty, setRestockPurchaseQty] = useState('')
  const [restockCostPerPurchase, setRestockCostPerPurchase] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 50
  const [search, setSearch] = useState('')

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
          purchase_unit_name: purchaseUnit?.name ?? '—',
          usage_unit_name: usageUnit?.name ?? '—',
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
      toast.error(`Unit “${preset.unit}” not found. Ask your admin to run the units seed.`)
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
      toast.error('Conversion must be greater than zero')
      return
    }

    const purchaseId = form.purchaseUnitId || null
    const usageId = form.usageUnitId || null
    if (!purchaseId || !usageId) {
      toast.error('Choose units (or use a shortcut button)')
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
          const usageQty = usageQuantityFromPurchaseQty(openingPurchase, ratio)
          const cpu = costPerUsageUnit(costPurchase, ratio)
          await supabase.from('stock_entries').insert({
            business_id: businessId,
            item_id: newItem.id,
            quantity: usageQty,
            cost_per_unit: cpu,
            source: 'purchase',
            note: 'Opening stock',
          })
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
          `You already have an item called "${form.name.trim()}". Use the Restock button to add more stock.`
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

    // Use the entered price; fall back to the stored price if blank
    const enteredCost = parseFloat(restockCostPerPurchase)
    const costPerPurchase =
      enteredCost > 0 ? enteredCost : restockItem.cost_per_unit

    setIsSubmitting(true)
    try {
      const ratio = restockItem.conversion_ratio > 0 ? restockItem.conversion_ratio : 1
      const usageQty = usageQuantityFromPurchaseQty(purchaseQty, ratio)
      const cpu = costPerUsageUnit(costPerPurchase, ratio)

      const { error } = await supabase.from('stock_entries').insert({
        business_id: businessId,
        item_id: restockItem.id,
        quantity: usageQty,
        cost_per_unit: cpu,
        source: 'purchase',
        note: 'Restock',
      })

      if (error) throw error

      // Keep the item's cost_per_unit in sync with the latest purchase price
      // so batch costing always uses the current market price
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

  return (
    <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Stock</h1>
          <p className="text-gray-600 mt-1">
            Track what you buy and use. Add ingredients and packaging here — Operbase calculates your costs
            automatically.
          </p>
        </div>

        <div className="flex flex-wrap gap-3 items-center">
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openAddBlank} size="lg" className="bg-amber-600 hover:bg-amber-700 min-h-12">
                <Plus className="mr-2" size={20} />
                Other item…
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
              <DialogHeader>
                <DialogTitle>{editingItem ? 'Change item' : 'Add item'}</DialogTitle>
              </DialogHeader>
              <form noValidate onSubmit={handleSave} className="space-y-4">
                <div>
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="What do you call it?"
                    className="min-h-11 text-base"
                  />
                </div>
                <div>
                  <Label htmlFor="cost">Price per unit</Label>
                  <Input
                    id="cost"
                    type="number"
                    step="0.01"
                    min="0"
                    inputMode="decimal"
                    value={form.costPerPurchase}
                    onChange={(e) => setForm({ ...form, costPerPurchase: e.target.value })}
                    placeholder="0"
                    className="min-h-11 text-base"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Amount in {currency} — one bag, one kilo, one box, whatever you buy.
                  </p>
                </div>
                {!editingItem && (
                  <div>
                    <Label htmlFor="openingQty">Starting amount (same unit as above)</Label>
                    <WholeNumberChips
                      values={[1, 2, 5, 10]}
                      onPick={(n) => setForm((f) => ({ ...f, openingPurchaseQty: String(n) }))}
                      className="mb-2"
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

                <details className="text-sm border rounded-lg p-3 bg-gray-50">
                  <summary className="cursor-pointer font-medium text-gray-800 py-1">
                    Advanced — different buy vs recipe units
                  </summary>
                  <div className="space-y-3 pt-3 mt-2 border-t">
                    <div className="grid grid-cols-1 gap-3">
                      <div>
                        <Label htmlFor="purchaseUnit">Purchase unit</Label>
                        <select
                          id="purchaseUnit"
                          value={form.purchaseUnitId}
                          onChange={(e) => setForm({ ...form, purchaseUnitId: e.target.value })}
                          className="w-full px-3 py-2.5 border border-gray-200 rounded-md text-base min-h-11"
                        >
                          <option value="">— choose —</option>
                          {units.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <Label htmlFor="usageUnit">Recipe unit</Label>
                        <select
                          id="usageUnit"
                          value={form.usageUnitId}
                          onChange={(e) => setForm({ ...form, usageUnitId: e.target.value })}
                          className="w-full px-3 py-2.5 border border-gray-200 rounded-md text-base min-h-11"
                        >
                          <option value="">— choose —</option>
                          {units.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="ratio">How many recipe units in one purchase?</Label>
                      <Input
                        id="ratio"
                        type="number"
                        step="0.000001"
                        min="0.000001"
                        inputMode="decimal"
                        value={form.conversionRatio}
                        onChange={(e) => setForm({ ...form, conversionRatio: e.target.value })}
                        className="min-h-11"
                      />
                    </div>
                    <div>
                      <Label htmlFor="lowStock">Alert me when at or below (optional)</Label>
                      <Input
                        id="lowStock"
                        type="number"
                        step="0.01"
                        min="0"
                        value={form.lowStockThreshold}
                        onChange={(e) => setForm({ ...form, lowStockThreshold: e.target.value })}
                        className="min-h-11"
                      />
                    </div>
                    <div>
                      <Label htmlFor="notes">Notes</Label>
                      <Input
                        id="notes"
                        value={form.notes}
                        onChange={(e) => setForm({ ...form, notes: e.target.value })}
                        className="min-h-11"
                      />
                    </div>
                  </div>
                </details>

                {form.costPerPurchase && form.conversionRatio && parseFloat(form.conversionRatio) > 0 && (
                  <p className="text-sm text-gray-600 bg-amber-50 border border-amber-100 p-2 rounded">
                    Per recipe unit:{' '}
                    <strong>
                      {formatCurrency(
                        costPerUsageUnit(
                          parseFloat(form.costPerPurchase) || 0,
                          parseFloat(form.conversionRatio) || 1
                        ),
                        currency
                      )}
                    </strong>
                  </p>
                )}

                <Button type="submit" size="lg" className="w-full bg-amber-600 hover:bg-amber-700 min-h-12 text-base" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <><Loader2 size={18} className="mr-2 animate-spin" />Saving…</>
                  ) : editingItem ? 'Save changes' : 'Save'}
                </Button>
              </form>
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

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'ingredient' | 'packaging')}>
          <TabsList className="h-12 w-full sm:w-auto">
            <TabsTrigger value="ingredient" className="text-base px-6">
              Ingredients
            </TabsTrigger>
            <TabsTrigger value="packaging" className="text-base px-6">
              Packaging
            </TabsTrigger>
          </TabsList>

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
                Stock value ~<strong className="text-gray-900">{formatCurrency(totalValue, currency)}</strong>
              </span>
              {lowStockCount > 0 && (
                <span className="text-orange-700 font-medium">
                  {lowStockCount} need attention
                </span>
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
                    Nothing here yet. Tap a shortcut above.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Item</TableHead>
                          <TableHead>On hand</TableHead>
                          <TableHead>Unit</TableHead>
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
                              <TableCell className="text-right">
                                <div className="flex flex-wrap gap-2 justify-end">
                                  <Button
                                    size="lg"
                                    variant="default"
                                    className="bg-amber-600 hover:bg-amber-700 min-h-11"
                                    onClick={() => {
                                      setRestockItem(item)
                                      setRestockPurchaseQty('')
                                      setRestockCostPerPurchase(item.cost_per_unit.toString())
                                      setRestockDialogOpen(true)
                                    }}
                                  >
                                    Add stock
                                  </Button>
                                  <Button size="lg" variant="outline" className="min-h-11" onClick={() => openEdit(item)}>
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
        </Tabs>

        <Dialog open={restockDialogOpen} onOpenChange={setRestockDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-xl">Add stock — {restockItem?.name}</DialogTitle>
            </DialogHeader>
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
                  Or type amount
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
                <Label htmlFor="restockCost" className="text-base">
                  Price per {restockItem?.purchase_unit_name ?? 'unit'}
                </Label>
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
              <Button type="submit" size="lg" className="w-full bg-amber-600 hover:bg-amber-700 min-h-12 text-base" disabled={isSubmitting}>
                {isSubmitting ? (
                  <><Loader2 size={18} className="mr-2 animate-spin" />Adding…</>
                ) : 'Add to stock'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
  )
}
