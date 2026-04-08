'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
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
import Link from 'next/link'
import { Plus, Trash2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useBusinessContext } from '@/providers/business-provider'
import { formatCurrency } from '@/lib/format-currency'
import { trackEvent } from '@/lib/services/events'
import { costPerOutputUnit } from '@/lib/bakery/cost'
import { COMMON_BAKES, COMMON_BATCH_SIZES } from '@/lib/bakery/simple-presets'
import { CupFractionRow, WholeNumberChips } from '@/components/bakery-quick-picks'
import { friendlyError } from '@/lib/errors'
import type {
  ProductionBatchRow,
  ProductionStockItemRow,
} from '@/lib/dashboard/production-data'

type Batch = ProductionBatchRow
type StockItemOption = ProductionStockItemRow

interface LineRow {
  itemId: string
  quantity: string
  /** Empty = FIFO from oldest purchase lot */
  purchaseLotId: string
}

type PurchaseLotOption = {
  id: string
  quantity_remaining: number
  purchased_at: string
  cost_per_usage_unit: number
  label: string
}

export function ProductionPageClient({
  initialBatches,
  initialStockItems,
}: {
  initialBatches: ProductionBatchRow[]
  initialStockItems: ProductionStockItemRow[]
}) {
  const { businessId, currency } = useBusinessContext()
  const [batches, setBatches] = useState<Batch[]>(initialBatches)
  const [stockItems, setStockItems] = useState<StockItemOption[]>(initialStockItems)
  const [isLoading, setIsLoading] = useState(false)
  const skipInitialFetch = useRef(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingBatch, setEditingBatch] = useState<Batch | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [form, setForm] = useState({
    productName: '',
    unitsProduced: '',
    unitsGivenAway: '',
    notes: '',
    producedAt: new Date().toISOString().split('T')[0],
  })
  const [lines, setLines] = useState<LineRow[]>([
    { itemId: '', quantity: '', purchaseLotId: '' },
  ])
  const [lotOptionsByItem, setLotOptionsByItem] = useState<
    Record<string, PurchaseLotOption[]>
  >({})

  const fetchStockItems = useCallback(async () => {
    if (!businessId) return
    const client = createClient()
    const { data, error } = await client
      .from('items')
      .select(
        `
        id, name, type,
        usage_unit:units!items_usage_unit_id_fkey (name)
      `
      )
      .eq('business_id', businessId)
      .order('name')

    if (error) {
      toast.error(friendlyError(error))
      return
    }

    setStockItems(
      (data ?? []).map((row: Record<string, unknown>) => {
        const uu = row.usage_unit as { name?: string } | null
        return {
          id: row.id as string,
          name: row.name as string,
          type: row.type as string,
          usage_unit_name: uu?.name ?? '',
        }
      })
    )
  }, [businessId])

  const fetchLotsForItem = useCallback(
    async (itemId: string) => {
      if (!businessId || !itemId) return
      const client = createClient()
      const { data, error } = await client
        .from('purchase_lots')
        .select('id, quantity_remaining, purchased_at, cost_per_usage_unit, label')
        .eq('business_id', businessId)
        .eq('item_id', itemId)
        .gt('quantity_remaining', 0)
        .order('purchased_at', { ascending: true })

      if (error) {
        if (error.code === '42P01' || error.message?.includes('purchase_lots')) {
          return
        }
        toast.error(friendlyError(error, 'Could not load stock batches'))
        return
      }
      setLotOptionsByItem((prev) => ({
        ...prev,
        [itemId]: (data ?? []) as PurchaseLotOption[],
      }))
    },
    [businessId]
  )

  const fetchBatches = useCallback(async () => {
    if (!businessId) return
    setIsLoading(true)
    const client = createClient()

    const { data, error } = await client
      .from('batches')
      .select('*, products(name), batch_items(id)')
      .eq('business_id', businessId)
      .order('produced_at', { ascending: false })

    if (error) {
      toast.error(friendlyError(error))
      setIsLoading(false)
      return
    }

    setBatches(
      (data ?? []).map((b: Record<string, unknown>) => {
        const products = b.products as { name?: string } | null
        const bi = b.batch_items as { id: string }[] | null
        const notes = b.notes as string | null
        return {
          id: b.id as string,
          product_id: (b.product_id as string | null) ?? null,
          product_name: products?.name ?? notes ?? 'Unnamed batch',
          units_produced: Number(b.units_produced),
          units_remaining: Number(b.units_remaining),
          units_given_away:
            b.units_given_away != null ? Number(b.units_given_away) : 0,
          cost_of_goods: b.cost_of_goods != null ? Number(b.cost_of_goods) : null,
          notes,
          produced_at: b.produced_at as string,
          has_inventory_lines: Array.isArray(bi) && bi.length > 0,
        }
      })
    )
    setIsLoading(false)
  }, [businessId])

  useEffect(() => {
    setBatches(initialBatches)
  }, [initialBatches])

  useEffect(() => {
    setStockItems(initialStockItems)
  }, [initialStockItems])

  useEffect(() => {
    if (!businessId) return
    if (skipInitialFetch.current) {
      skipInitialFetch.current = false
      return
    }
    void fetchBatches()
    void fetchStockItems()
  }, [businessId, fetchBatches, fetchStockItems])

  function openAdd() {
    setEditingBatch(null)
    setLotOptionsByItem({})
    setForm({
      productName: '',
      unitsProduced: '',
      unitsGivenAway: '',
      notes: '',
      producedAt: new Date().toISOString().split('T')[0],
    })
    setLines([{ itemId: '', quantity: '', purchaseLotId: '' }])
    setDialogOpen(true)
  }

  function openEdit(batch: Batch) {
    if (batch.has_inventory_lines) {
      toast.message('Batches with ingredient deductions can only be deleted (stock is restored).')
      return
    }
    setEditingBatch(batch)
    setForm({
      productName: batch.product_name,
      unitsProduced: batch.units_produced.toString(),
      unitsGivenAway: '',
      notes: '',
      producedAt: batch.produced_at.split('T')[0],
    })
    setLines([{ itemId: '', quantity: '', purchaseLotId: '' }])
    setDialogOpen(true)
  }

  function addLine() {
    setLines((prev) => [...prev, { itemId: '', quantity: '', purchaseLotId: '' }])
  }

  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!businessId || isSubmitting) return

    const nameTrim = form.productName.trim()
    if (!nameTrim || !parseFloat(form.unitsProduced) || parseFloat(form.unitsProduced) <= 0) {
      toast.error('Please fill in all required fields')
      return
    }
    if (nameTrim.length > 200) {
      toast.error('Product name is too long. Keep it under 200 characters.')
      return
    }

    const units = parseFloat(form.unitsProduced)
    const givenAway = !editingBatch ? Math.max(0, parseFloat(form.unitsGivenAway) || 0) : 0
    if (!editingBatch && givenAway > units) {
      toast.error('Samples or giveaways can’t be more than how many you made.')
      return
    }

    const resolvedLines = lines
      .filter((l) => l.itemId && parseFloat(l.quantity) > 0)
      .map((l) => {
        const row: { item_id: string; quantity: number; purchase_lot_id?: string } = {
          item_id: l.itemId,
          quantity: parseFloat(l.quantity),
        }
        if (l.purchaseLotId.trim()) {
          row.purchase_lot_id = l.purchaseLotId.trim()
        }
        return row
      })

    const client = createClient()
    setIsSubmitting(true)

    try {
      const { data: productId, error: productErr } = await client.rpc('ensure_product', {
        p_business_id: businessId,
        p_name: nameTrim,
      })
      if (productErr) throw productErr
      if (!productId || typeof productId !== 'string') {
        toast.error('Could not save the product for this batch. Try again.')
        return
      }

      if (editingBatch) {
        const extra = form.notes.trim()
        const notes = `${nameTrim}${extra ? ' · ' + extra : ''}`
        const { error } = await client
          .from('batches')
          .update({
            notes,
            product_id: productId,
            units_produced: units,
            units_remaining: units,
            produced_at: form.producedAt,
          })
          .eq('id', editingBatch.id)

        if (error) throw error
        toast.success('Batch updated!')
      } else {
        const { data: batchId, error } = await client.rpc('create_production_batch', {
          p_business_id: businessId,
          p_units_produced: units,
          p_produced_at: new Date(form.producedAt).toISOString(),
          p_display_name: nameTrim,
          p_extra_notes: form.notes.trim() || null,
          p_lines: resolvedLines,
          p_product_id: productId,
          p_units_not_for_sale: givenAway,
        })

        if (error) throw error
        if (!batchId) throw new Error('No batch id returned')
        trackEvent('batch_created', businessId, { batch_id: batchId, units_produced: units })
        toast.success('Saved. Stock updated from what you used.')
      }

      setDialogOpen(false)
      fetchBatches()
      fetchStockItems()
    } catch (error: unknown) {
      toast.error(friendlyError(error, 'Failed to save batch'))
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this batch? Stock from ingredients will be restored if applicable.')) return

    const batch = batches.find((b) => b.id === id)
    const client = createClient()
    const { error } = batch?.has_inventory_lines
      ? await client.rpc('delete_production_batch', { p_batch_id: id })
      : await client.from('batches').delete().eq('id', id)

    if (error) {
      toast.error(friendlyError(error))
      return
    }
    toast.success('Batch deleted')
    fetchBatches()
    fetchStockItems()
  }

  const totalProduced = batches.reduce((sum, b) => sum + b.units_produced, 0)
  const totalRemaining = batches.reduce((sum, b) => sum + b.units_remaining, 0)
  const totalSoldFromBatches = batches.reduce(
    (sum, b) =>
      sum + Math.max(0, b.units_produced - b.units_given_away - b.units_remaining),
    0
  )

  function lineUsageUnitName(line: LineRow): string | null {
    const it = stockItems.find((s) => s.id === line.itemId)
    return it?.usage_unit_name?.toLowerCase() ?? null
  }

  function setLineQty(index: number, value: string) {
    setLines((prev) => prev.map((row, i) => (i === index ? { ...row, quantity: value } : row)))
  }

  return (
    <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Production</h1>
          <p className="text-gray-600 mt-1">
            Record what you made. Enter what you used (in your recipe units); we take stock from the oldest
            purchases first unless you pick a specific delivery.{' '}
            <Link href="/dashboard/stock" className="text-amber-700 underline font-medium">
              Add stock first
            </Link>{' '}
            if something is missing.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="lg" className="bg-amber-600 hover:bg-amber-700 min-h-12 text-base shrink-0">
                <Plus size={20} className="mr-2" />
                Record production
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto max-w-lg">
              <DialogHeader>
                <DialogTitle className="text-xl">
                  {editingBatch ? 'Edit run' : 'Record production'}
                </DialogTitle>
              </DialogHeader>
              <form noValidate onSubmit={handleSave} className="space-y-4">
                <div>
                  <Label className="text-base">What is it?</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {COMMON_BAKES.map((name) => (
                      <Button
                        key={name}
                        type="button"
                        variant="outline"
                        size="lg"
                        className="min-h-11 text-base"
                        disabled={!!editingBatch?.has_inventory_lines}
                        onClick={() => {
                          if (name === 'Custom…') setForm((f) => ({ ...f, productName: '' }))
                          else setForm((f) => ({ ...f, productName: name }))
                        }}
                      >
                        {name}
                      </Button>
                    ))}
                  </div>
                  <Input
                    id="productName"
                    value={form.productName}
                    onChange={(e) => setForm({ ...form, productName: e.target.value })}
                    placeholder="Type a name if you picked Custom"
                    className="mt-3 min-h-11 text-base"
                    disabled={!!editingBatch?.has_inventory_lines}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Use the same wording in Sales when you ring up that item so cost lines up.
                  </p>
                </div>
                <div>
                  <Label className="text-base">How many did you make?</Label>
                  <WholeNumberChips
                    values={[...COMMON_BATCH_SIZES]}
                    onPick={(n) => setForm((f) => ({ ...f, unitsProduced: String(n) }))}
                    className="mt-2"
                  />
                  <Input
                    id="units"
                    type="number"
                    step="0.01"
                    min="0.01"
                    inputMode="decimal"
                    value={form.unitsProduced}
                    onChange={(e) => setForm({ ...form, unitsProduced: e.target.value })}
                    placeholder="Or type a number"
                    className="mt-2 min-h-11 text-base"
                    disabled={!!editingBatch?.has_inventory_lines}
                  />
                </div>
                {!editingBatch && (
                  <div>
                    <Label className="text-base">Samples, waste, or gifts (optional)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      inputMode="decimal"
                      value={form.unitsGivenAway}
                      onChange={(e) => setForm({ ...form, unitsGivenAway: e.target.value })}
                      placeholder="0 — not sold, but still part of this run"
                      className="mt-2 min-h-11 text-base"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Profit only counts sales; cost still spreads across everything you made, including
                      these.
                    </p>
                  </div>
                )}
                <div>
                  <Label htmlFor="date" className="text-base">
                    Date
                  </Label>
                  <Input
                    id="date"
                    type="date"
                    value={form.producedAt}
                    onChange={(e) => setForm({ ...form, producedAt: e.target.value })}
                    className="mt-1 min-h-11"
                    required
                  />
                </div>
                <details className="text-sm border rounded-lg p-3 bg-gray-50">
                  <summary className="cursor-pointer font-medium">Note (optional)</summary>
                  <Input
                    id="notes"
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    placeholder="e.g. morning shift"
                    className="mt-2 min-h-11"
                  />
                </details>

                {!editingBatch && (
                  <div className="space-y-3 border rounded-lg p-3 bg-amber-50/40">
                    <div className="flex justify-between items-center gap-2">
                      <Label className="text-base font-medium">What did you use?</Label>
                      <Button type="button" size="sm" variant="outline" onClick={addLine}>
                        + Add row
                      </Button>
                    </div>
                    <p className="text-xs text-gray-600">
                      Amounts are in each item’s recipe unit (cups, grams, eggs…). Use the shortcuts when you
                      see them.
                    </p>
                    {lines.map((line, index) => {
                      const cupItem = lineUsageUnitName(line) === 'cup'
                      return (
                        <div key={index} className="space-y-2 border-b border-amber-100 pb-3 last:border-0">
                          <select
                            value={line.itemId}
                            onChange={(e) => {
                              const v = e.target.value
                              setLines((prev) =>
                                prev.map((row, i) =>
                                  i === index ? { ...row, itemId: v, purchaseLotId: '' } : row
                                )
                              )
                              if (v) void fetchLotsForItem(v)
                            }}
                            className="w-full px-3 py-2.5 border border-gray-200 rounded-md text-base min-h-11"
                          >
                            <option value="">Pick an item</option>
                            {stockItems.map((it) => (
                              <option key={it.id} value={it.id}>
                                {it.name} · {it.usage_unit_name}
                              </option>
                            ))}
                          </select>
                          <Input
                            type="number"
                            step="0.0001"
                            min="0"
                            inputMode="decimal"
                            value={line.quantity}
                            onChange={(e) => setLineQty(index, e.target.value)}
                            placeholder="Amount"
                            className="min-h-11 text-base"
                          />
                          {cupItem && (
                            <div>
                              <p className="text-xs text-gray-600 mb-1">Cup shortcuts</p>
                              <CupFractionRow onPick={(v) => setLineQty(index, String(v))} />
                            </div>
                          )}
                          {!cupItem && line.itemId && (
                            <WholeNumberChips
                              values={[1, 2, 5, 10, 100, 500]}
                              onPick={(n) => setLineQty(index, String(n))}
                            />
                          )}
                          {line.itemId ? (
                            <div>
                              <Label className="text-xs text-gray-600 font-normal">
                                Which delivery to use? (optional)
                              </Label>
                              <select
                                value={line.purchaseLotId}
                                onChange={(e) =>
                                  setLines((prev) =>
                                    prev.map((row, i) =>
                                      i === index
                                        ? { ...row, purchaseLotId: e.target.value }
                                        : row
                                    )
                                  )
                                }
                                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm min-h-10 mt-1"
                              >
                                <option value="">Oldest stock first (recommended)</option>
                                {(lotOptionsByItem[line.itemId] ?? []).map((lot) => {
                                  const u = stockItems.find((s) => s.id === line.itemId)
                                    ?.usage_unit_name
                                  return (
                                    <option key={lot.id} value={lot.id}>
                                      {new Date(lot.purchased_at).toLocaleDateString()} ·{' '}
                                      {Number(lot.quantity_remaining).toFixed(2)} {u ?? ''} left @{' '}
                                      {formatCurrency(
                                        Number(lot.cost_per_usage_unit),
                                        currency
                                      )}
                                      /{u ?? 'unit'}
                                    </option>
                                  )
                                })}
                              </select>
                            </div>
                          ) : null}
                          {lines.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-destructive"
                              onClick={() => removeLine(index)}
                            >
                              Remove row
                            </Button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                <Button
                  type="submit"
                  size="lg"
                  className="w-full bg-amber-600 hover:bg-amber-700 min-h-12 text-base"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <><Loader2 size={18} className="mr-2 animate-spin" />Saving…</>
                  ) : editingBatch ? 'Save' : 'Save production'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Batches</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{batches.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Units Produced</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalProduced.toFixed(0)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Units Remaining</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">{totalRemaining.toFixed(0)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Units Sold</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {totalSoldFromBatches.toFixed(0)}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Production batches</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-center text-gray-500 py-8">Loading...</p>
            ) : batches.length === 0 ? (
              <p className="text-center text-gray-500 py-8 max-w-lg mx-auto leading-relaxed">
                Nothing recorded yet. Tap Record production when you finish a run — we work out cost from
                what you used.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product / name</TableHead>
                      <TableHead>Made</TableHead>
                      <TableHead>Given / waste</TableHead>
                      <TableHead>Left to sell</TableHead>
                      <TableHead>Run cost</TableHead>
                      <TableHead>Cost / unit</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {batches.map((batch) => {
                      const cogs = batch.cost_of_goods ?? 0
                      const cpu = costPerOutputUnit(cogs, batch.units_produced)
                      return (
                        <TableRow key={batch.id}>
                          <TableCell className="font-medium">
                            {batch.product_name}
                            {batch.has_inventory_lines && (
                              <span className="ml-2 text-xs text-gray-500">(inventory)</span>
                            )}
                          </TableCell>
                          <TableCell>{batch.units_produced}</TableCell>
                          <TableCell>{batch.units_given_away > 0 ? batch.units_given_away : '—'}</TableCell>
                          <TableCell>{batch.units_remaining}</TableCell>
                          <TableCell>
                            {batch.cost_of_goods != null ? formatCurrency(cogs, currency) : '-'}
                          </TableCell>
                          <TableCell>
                            {batch.cost_of_goods != null ? formatCurrency(cpu, currency) : '-'}
                          </TableCell>
                          <TableCell>{new Date(batch.produced_at).toLocaleDateString()}</TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openEdit(batch)}
                                disabled={batch.has_inventory_lines}
                                title={
                                  batch.has_inventory_lines
                                    ? 'Delete and recreate to change ingredients'
                                    : undefined
                                }
                              >
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleDelete(batch.id)}
                              >
                                <Trash2 size={14} />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
  )
}
