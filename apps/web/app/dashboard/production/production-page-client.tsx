'use client'

import { useState, useEffect, useCallback, useRef, useMemo, Fragment } from 'react'
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
import { Plus, Trash2, Loader2, ChevronDown, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useBusinessContext } from '@/providers/business-provider'
import { formatCurrency } from '@/lib/format-currency'
import { trackEvent } from '@/lib/services/events'
import { costPerOutputUnit, costPerUsageUnit } from '@/lib/bakery/cost'
import { COMMON_BAKES, COMMON_BATCH_SIZES } from '@/lib/bakery/simple-presets'
import { CupFractionRow, WholeNumberChips } from '@/components/bakery-quick-picks'
import { friendlyError } from '@/lib/errors'
import {
  businessCalendarDateToIsoUtc,
  formatCalendarDateInTimeZone,
  formatFriendlyDate,
} from '@/lib/business-time'
import { cn } from '@/lib/utils'
import type {
  ProductionBatchRow,
  ProductionStockItemRow,
} from '@/lib/dashboard/production-data'
import {
  fetchRecipesForProduct,
  scaleRecipeItems,
  type Recipe,
} from '@/lib/recipes'

type Batch = ProductionBatchRow
type StockItemOption = ProductionStockItemRow

type ProductVariantOption = { id: string; name: string; sort_order: number }
type ProductWithVariants = { id: string; name: string; variants: ProductVariantOption[] }

interface LineRow {
  itemId: string
  quantity: string
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
  const { businessId, currency, timezone } = useBusinessContext()
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
    unitsSold: '',
    salePrice: '',
    unitsGivenAway: '',
    notes: '',
    producedAt: formatCalendarDateInTimeZone(new Date(), timezone),
  })
  const [lines, setLines] = useState<LineRow[]>([
    { itemId: '', quantity: '', purchaseLotId: '' },
  ])
  const [lotOptionsByItem, setLotOptionsByItem] = useState<Record<string, PurchaseLotOption[]>>({})
  const [expandedBatchId, setExpandedBatchId] = useState<string | null>(null)
  const [disposeTarget, setDisposeTarget] = useState<Batch | null>(null)
  const [disposeQty, setDisposeQty] = useState('')
  const [disposeSubmitting, setDisposeSubmitting] = useState(false)
  const [productCatalog, setProductCatalog] = useState<ProductWithVariants[]>([])
  const [variantsForProduct, setVariantsForProduct] = useState<ProductVariantOption[]>([])
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null)
  const [recipesForProduct, setRecipesForProduct] = useState<Recipe[]>([])
  const [recipePickerOpen, setRecipePickerOpen] = useState(false)
  const [appliedRecipeId, setAppliedRecipeId] = useState<string | null>(null)

  const supabase = useMemo(() => createClient(), [])

  const fetchStockItems = useCallback(async () => {
    if (!businessId) return
    const client = createClient()
    const { data, error } = await client
      .from('items')
      .select(`id, name, type, cost_per_unit, conversion_ratio, avg_cost_per_usage_unit, usage_unit:units!items_usage_unit_id_fkey (name)`)
      .eq('business_id', businessId)
      .order('name')

    if (error) { toast.error(friendlyError(error)); return }

    setStockItems(
      (data ?? []).map((row: Record<string, unknown>) => {
        const uu = row.usage_unit as { name?: string } | null
        return {
          id: row.id as string,
          name: row.name as string,
          type: row.type as string,
          usage_unit_name: uu?.name ?? '',
          avg_cost_per_usage_unit: Number(row.avg_cost_per_usage_unit ?? 0),
          cost_per_unit: Number(row.cost_per_unit ?? 0),
          conversion_ratio: Number(row.conversion_ratio ?? 1),
        }
      })
    )
  }, [businessId])

  const fetchLotsForItem = useCallback(async (itemId: string) => {
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
      if (error.code === '42P01' || error.message?.includes('purchase_lots')) return
      toast.error(friendlyError(error, 'Could not load your production runs'))
      return
    }
    setLotOptionsByItem((prev) => ({ ...prev, [itemId]: (data ?? []) as PurchaseLotOption[] }))
  }, [businessId])

  const fetchBatches = useCallback(async () => {
    if (!businessId) return
    setIsLoading(true)
    const client = createClient()

    const [{ data, error }, salesRes] = await Promise.all([
      client.from('batches').select('*, products(name), batch_items(id)').eq('business_id', businessId).order('produced_at', { ascending: false }),
      client.from('sales').select('batch_id, revenue').eq('business_id', businessId).not('batch_id', 'is', null),
    ])

    if (error) { toast.error(friendlyError(error)); setIsLoading(false); return }

    const revenueByBatch = new Map<string, number>()
    for (const row of salesRes.data ?? []) {
      const r = row as { batch_id: string | null; revenue: number | string | null }
      if (!r.batch_id || r.revenue == null) continue
      revenueByBatch.set(r.batch_id, (revenueByBatch.get(r.batch_id) ?? 0) + Number(r.revenue))
    }

    setBatches(
      (data ?? []).map((b: Record<string, unknown>) => {
        const products = b.products as { name?: string } | null
        const bi = b.batch_items as { id: string }[] | null
        const notes = b.notes as string | null
        const id = b.id as string
        return {
          id,
          product_id: (b.product_id as string | null) ?? null,
          product_name: products?.name ?? notes ?? 'Unnamed run',
          units_produced: Number(b.units_produced),
          units_remaining: Number(b.units_remaining),
          units_given_away: b.units_given_away != null ? Number(b.units_given_away) : 0,
          units_sold_from_batch: b.units_sold_from_batch != null ? Number(b.units_sold_from_batch) : 0,
          units_spoiled: b.units_spoiled != null ? Number(b.units_spoiled) : 0,
          units_given_out_extra: b.units_given_out_extra != null ? Number(b.units_given_out_extra) : 0,
          units_not_sold_loss: b.units_not_sold_loss != null ? Number(b.units_not_sold_loss) : 0,
          cost_of_goods: b.cost_of_goods != null ? Number(b.cost_of_goods) : null,
          notes,
          produced_at: b.produced_at as string,
          has_inventory_lines: Array.isArray(bi) && bi.length > 0,
          revenue_from_batch: revenueByBatch.get(id) ?? 0,
        }
      })
    )
    setIsLoading(false)
  }, [businessId])

  useEffect(() => { setBatches(initialBatches) }, [initialBatches])
  useEffect(() => { setStockItems(initialStockItems) }, [initialStockItems])

  useEffect(() => {
    if (!businessId) return
    if (skipInitialFetch.current) { skipInitialFetch.current = false; return }
    void fetchBatches()
    void fetchStockItems()
  }, [businessId, fetchBatches, fetchStockItems])

  // Load product catalog when dialog opens
  useEffect(() => {
    if (!dialogOpen || !businessId) return
    void supabase
      .from('products')
      .select('id, name, product_variants(id, name, sort_order)')
      .eq('business_id', businessId)
      .order('name')
      .then(({ data, error }) => {
        if (error || !data) return
        setProductCatalog(
          (data as Record<string, unknown>[]).map((p) => ({
            id: p.id as string,
            name: p.name as string,
            variants: ((p.product_variants as ProductVariantOption[] | null) ?? [])
              .slice()
              .sort((a, b) => a.sort_order - b.sort_order),
          }))
        )
      })
  }, [dialogOpen, businessId, supabase])

  // When product name changes, load its variants and available recipes
  useEffect(() => {
    const nameTrim = form.productName.trim().toLowerCase()
    const found = productCatalog.find((p) => p.name.toLowerCase() === nameTrim)
    setVariantsForProduct(found?.variants ?? [])
    setSelectedVariantId(null)
    setAppliedRecipeId(null)
    setRecipesForProduct([])
    if (found && businessId) {
      fetchRecipesForProduct(createClient(), businessId, found.id)
        .then(setRecipesForProduct)
        .catch(() => {/* silently skip — recipes are optional */})
    }
  }, [form.productName, productCatalog, businessId])

  function applyRecipe(recipe: Recipe) {
    const targetUnits = parseFloat(form.unitsProduced) || recipe.yield_quantity
    const scaled = scaleRecipeItems(recipe, targetUnits)

    // Check which items are missing from stock entirely (not loaded = not in items table)
    const missingFromStock = scaled.filter(
      (l) => !stockItems.find((s) => s.id === l.item_id)
    )
    // Check which items exist in stock but have zero cost (will skew costing)
    const zeroCostItems = scaled.filter((l) => {
      const si = stockItems.find((s) => s.id === l.item_id)
      return si && estimatedCostPerUsageUnit(si) === 0
    })

    if (missingFromStock.length > 0) {
      toast.warning(
        `${missingFromStock.map((l) => l.item_name).join(', ')} ${missingFromStock.length === 1 ? 'is' : 'are'} not in your stock list — their cost will show as zero and your total production cost will be understated. Add them to stock first for accurate costing.`,
        { duration: 8000 }
      )
    } else if (zeroCostItems.length > 0) {
      toast.warning(
        `${zeroCostItems.map((l) => l.item_name).join(', ')} ${zeroCostItems.length === 1 ? 'has' : 'have'} no price set — their cost will show as zero. Update the stock price to get an accurate production cost.`,
        { duration: 8000 }
      )
    }

    // Pre-fill lines — include all recipe items so user can see and tweak
    const newLines = scaled.map((l) => ({
      itemId: l.item_id,
      quantity: String(l.quantity),
      purchaseLotId: '',
    }))
    setLines(newLines.length > 0 ? newLines : [{ itemId: '', quantity: '', purchaseLotId: '' }])
    setAppliedRecipeId(recipe.id)
    setRecipePickerOpen(false)
    // Open the ingredient tracking section automatically
    const details = document.getElementById('ingredient-tracking-details')
    if (details) (details as HTMLDetailsElement).open = true
  }

  function openAdd() {
    setEditingBatch(null)
    setLotOptionsByItem({})
    setVariantsForProduct([])
    setSelectedVariantId(null)
    setRecipesForProduct([])
    setAppliedRecipeId(null)
    setRecipePickerOpen(false)
    setForm({
      productName: '',
      unitsProduced: '',
      unitsSold: '',
      salePrice: '',
      unitsGivenAway: '',
      notes: '',
      producedAt: formatCalendarDateInTimeZone(new Date(), timezone),
    })
    setLines([{ itemId: '', quantity: '', purchaseLotId: '' }])
    setDialogOpen(true)
  }

  function requestEditBatch(batch: Batch) {
    if (batch.has_inventory_lines) {
      toast.message(
        'This run already moved ingredients out of your stock. To fix a mistake, delete the run (we put stock back) and record it again.',
        { duration: 9000 }
      )
      return
    }
    openEdit(batch)
  }

  function openEdit(batch: Batch) {
    setEditingBatch(batch)
    setVariantsForProduct([])
    setSelectedVariantId(null)
    setForm({
      productName: batch.product_name,
      unitsProduced: batch.units_produced.toString(),
      unitsSold: '',
      salePrice: '',
      unitsGivenAway: '',
      notes: '',
      producedAt: formatCalendarDateInTimeZone(new Date(batch.produced_at), timezone),
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
    if (!nameTrim) { toast.error('Pick or type a product name.'); return }
    if (!parseFloat(form.unitsProduced) || parseFloat(form.unitsProduced) <= 0) {
      toast.error('Enter how many you made.')
      return
    }
    if (nameTrim.length > 200) { toast.error('Product name is too long.'); return }

    const units = parseFloat(form.unitsProduced)
    const givenAway = !editingBatch ? Math.max(0, parseFloat(form.unitsGivenAway) || 0) : 0
    if (!editingBatch && givenAway > units) {
      toast.error('Samples can\'t be more than how many you made.')
      return
    }

    const soldQty = parseFloat(form.unitsSold) || 0
    const soldPrice = parseFloat(form.salePrice) || 0
    if (soldQty > 0 && soldPrice <= 0) {
      toast.error('Enter the price per item to log the sale.')
      return
    }
    const availableForSale = units - givenAway
    if (soldQty > availableForSale) {
      toast.error(`You can only sell up to ${availableForSale} (what's left after samples).`)
      return
    }

    const resolvedLines = lines
      .filter((l) => l.itemId && parseFloat(l.quantity) > 0)
      .map((l) => {
        const row: { item_id: string; quantity: number; purchase_lot_id?: string } = {
          item_id: l.itemId,
          quantity: parseFloat(l.quantity),
        }
        if (l.purchaseLotId.trim()) row.purchase_lot_id = l.purchaseLotId.trim()
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
        toast.error('Could not save the product for this run. Try again.')
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
            produced_at: businessCalendarDateToIsoUtc(form.producedAt, timezone),
          })
          .eq('id', editingBatch.id)
        if (error) throw error
        toast.success('Run updated!')
      } else {
        const { data: batchId, error } = await client.rpc('create_production_batch', {
          p_business_id: businessId,
          p_units_produced: units,
          p_produced_at: businessCalendarDateToIsoUtc(form.producedAt, timezone),
          p_display_name: nameTrim,
          p_extra_notes: form.notes.trim() || null,
          p_lines: resolvedLines,
          p_product_id: productId,
          p_units_not_for_sale: givenAway,
        })
        if (error) throw error
        if (!batchId) throw new Error('No batch id returned')

        if (selectedVariantId || appliedRecipeId) {
          await client.from('batches').update({
            ...(selectedVariantId ? { variant_id: selectedVariantId } : {}),
            ...(appliedRecipeId  ? { recipe_id: appliedRecipeId }  : {}),
          }).eq('id', batchId as string)
        }

        // Quick sale — log it right now if the user filled in sold qty + price
        if (soldQty > 0 && soldPrice > 0) {
          const { error: saleErr } = await client.rpc('record_sale_with_batch', {
            p_business_id: businessId,
            p_product_id: productId,
            p_product_name: nameTrim,
            p_units_sold: soldQty,
            p_unit_price: soldPrice,
            p_sold_at: businessCalendarDateToIsoUtc(form.producedAt, timezone),
            p_customer_id: null,
            p_batch_id: batchId,
            p_cogs_if_no_batch: null,
          })
          if (saleErr) {
            toast.warning(`Run saved, but sale log failed: ${saleErr.message}`)
          } else {
            const remaining = units - givenAway - soldQty
            toast.success(
              remaining > 0
                ? `Saved. ${soldQty} sold, ${remaining} left.`
                : `Saved. All ${soldQty} sold!`
            )
          }
        } else {
          toast.success('Saved. Stock updated from what you used.')
        }

        trackEvent('batch_created', businessId, { batch_id: batchId, units_produced: units })
      }

      setDialogOpen(false)
      fetchBatches()
      fetchStockItems()
    } catch (error: unknown) {
      toast.error(friendlyError(error, 'Failed to save your run'))
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this run? Stock from ingredients will be restored.')) return
    const batch = batches.find((b) => b.id === id)
    const client = createClient()
    const { error } = batch?.has_inventory_lines
      ? await client.rpc('delete_production_batch', { p_batch_id: id })
      : await client.from('batches').delete().eq('id', id)
    if (error) { toast.error(friendlyError(error)); return }
    toast.success('Run deleted')
    fetchBatches()
    fetchStockItems()
  }

  async function submitDispose(kind: 'given_out' | 'not_sold') {
    if (!disposeTarget || !businessId || disposeSubmitting) return
    const qty = parseFloat(disposeQty)
    if (!qty || qty <= 0) { toast.error('Enter how many items this applies to.'); return }
    if (qty > disposeTarget.units_remaining) {
      toast.error(`You only have ${disposeTarget.units_remaining} left in this run.`)
      return
    }
    setDisposeSubmitting(true)
    try {
      const client = createClient()
      const { error } = await client.rpc('dispose_batch_units', {
        p_batch_id: disposeTarget.id,
        p_quantity: qty,
        p_kind: kind,
      })
      if (error) throw error
      toast.success(kind === 'given_out' ? 'Saved. Marked as given away.' : 'Saved. Written off as unsold.')
      setDisposeTarget(null)
      setDisposeQty('')
      setExpandedBatchId(null)
      fetchBatches()
    } catch (err: unknown) {
      toast.error(friendlyError(err, 'Could not update this run'))
    } finally {
      setDisposeSubmitting(false)
    }
  }

  const totalProduced = batches.reduce((sum, b) => sum + b.units_produced, 0)
  const totalRemaining = batches.reduce((sum, b) => sum + b.units_remaining, 0)
  const totalSoldFromBatches = batches.reduce((sum, b) => sum + b.units_sold_from_batch, 0)
  const totalGivenAtStart = batches.reduce((sum, b) => sum + b.units_given_away, 0)
  const totalGivenLater = batches.reduce((sum, b) => sum + b.units_given_out_extra, 0)

  function lineUsageUnitName(line: LineRow): string | null {
    return stockItems.find((s) => s.id === line.itemId)?.usage_unit_name?.toLowerCase() ?? null
  }

  function setLineQty(index: number, value: string) {
    setLines((prev) => prev.map((row, i) => (i === index ? { ...row, quantity: value } : row)))
  }

  function estimatedCostPerUsageUnit(it: StockItemOption): number {
    if (it.avg_cost_per_usage_unit > 0) return it.avg_cost_per_usage_unit
    return costPerUsageUnit(it.cost_per_unit, it.conversion_ratio)
  }

  const totalMoneyTiedUp = useMemo(() => {
    let sum = 0
    for (const b of batches) {
      if (b.units_remaining <= 0 || b.cost_of_goods == null || b.units_produced <= 0) continue
      sum += b.units_remaining * costPerOutputUnit(b.cost_of_goods, b.units_produced)
    }
    return sum
  }, [batches])

  const firstSellBatchId = useMemo(() => {
    return batches.find((x) => x.units_remaining > 0 && x.product_id)?.id ?? null
  }, [batches])

  const liveProductionCost = useMemo(() => {
    let ingredients = 0
    const lineDetails: { name: string; qty: number; unit: string; est: number }[] = []
    for (const line of lines) {
      const qty = parseFloat(line.quantity)
      if (!line.itemId || !qty || qty <= 0) continue
      const it = stockItems.find((s) => s.id === line.itemId)
      if (!it) continue
      const cpu = estimatedCostPerUsageUnit(it)
      const sub = qty * cpu
      ingredients += sub
      lineDetails.push({ name: it.name, qty, unit: it.usage_unit_name, est: sub })
    }
    const made = parseFloat(form.unitsProduced) || 0
    return { ingredients, perPiece: made > 0 ? ingredients / made : 0, made, lineDetails }
  }, [lines, stockItems, form.unitsProduced])

  // Product chips: use catalog if available, fall back to common presets
  const productChips = productCatalog.length > 0
    ? productCatalog.map((p) => p.name)
    : COMMON_BAKES

  const soldQtyParsed = parseFloat(form.unitsSold) || 0
  const producedQtyParsed = parseFloat(form.unitsProduced) || 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Production</h1>
        <p className="text-gray-600 mt-1">
          Record what you made and what you sold.{' '}
          <Link href="/dashboard/stock" className="underline font-medium" style={{ color: 'var(--brand)' }}>
            Add stock
          </Link>{' '}
          if something is missing.
        </p>
      </div>

      {batches.length > 0 && totalMoneyTiedUp > 0 && (
        <Card className="border-2 shadow-md" style={{ borderColor: 'var(--brand-mid)', backgroundColor: 'var(--brand-light)' }}>
          <CardContent className="pt-5 pb-5">
            <p className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--brand-dark)' }}>
              Still unsold
            </p>
            <p className="text-3xl sm:text-4xl font-extrabold tabular-nums text-gray-900 mt-1">
              {formatCurrency(totalMoneyTiedUp, currency)}
            </p>
            <p className="text-sm text-gray-700 mt-1">
              That is what it cost you to make the items still on your shelf. Sell them to get your money back.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 mt-4">
              <Button
                asChild
                size="lg"
                className="min-h-12 text-base flex-1"
                style={{ backgroundColor: 'var(--brand)' }}
              >
                <Link href={firstSellBatchId ? `/dashboard/sales?batch=${firstSellBatchId}` : '/dashboard/sales'}>
                  Sell now
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="min-h-12 text-base flex-1 bg-white">
                <Link href="#production-batches">What happened?</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button
              size="lg"
              className="min-h-12 text-base shrink-0"
              style={{ backgroundColor: 'var(--brand)' }}
              onClick={openAdd}
            >
              <Plus size={20} className="mr-2" />
              Record production
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto max-w-lg p-0">
            {/* Branded header */}
            <div className="px-6 pt-5 pb-4 sticky top-0 z-10" style={{ backgroundColor: 'var(--brand-light)', borderBottom: '1px solid var(--brand-mid)' }}>
              <DialogHeader>
                <DialogTitle className="text-xl" style={{ color: 'var(--brand-dark)' }}>
                  {editingBatch ? 'Edit run' : 'Record production'}
                </DialogTitle>
              </DialogHeader>
            </div>

            <form noValidate onSubmit={handleSave} className="space-y-5 px-6 py-5">

              {/* ── What did you make? ── */}
              <div>
                <Label className="text-base">What did you make?</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {productChips.map((name) => (
                    <button
                      key={name}
                      type="button"
                      className={cn(
                        'px-3 py-2 rounded-lg text-sm border transition-colors min-h-10',
                        form.productName === name
                          ? 'text-white border-transparent'
                          : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
                      )}
                      style={form.productName === name ? { backgroundColor: 'var(--brand)', borderColor: 'var(--brand)' } : undefined}
                      disabled={!!editingBatch?.has_inventory_lines}
                      onClick={() => setForm((f) => ({ ...f, productName: name }))}
                    >
                      {name}
                    </button>
                  ))}
                </div>
                <Input
                  value={form.productName}
                  onChange={(e) => setForm({ ...form, productName: e.target.value })}
                  placeholder={productCatalog.length > 0 ? 'Or type a new product name' : 'Or type any name, e.g. Banana bread'}
                  className="mt-2 min-h-11 text-base"
                  disabled={!!editingBatch?.has_inventory_lines}
                />
                {productCatalog.length === 0 && (
                  <p className="text-xs text-gray-500 mt-1">
                    Add products in the{' '}
                    <Link href="/dashboard/products" className="underline" style={{ color: 'var(--brand)' }}>Products</Link>
                    {' '}tab first to see them here.
                  </p>
                )}
              </div>

              {/* Variant picker */}
              {variantsForProduct.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-sm text-gray-700">Which type did you make?</Label>
                  <div className="flex flex-wrap gap-2">
                    {variantsForProduct.map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => setSelectedVariantId(selectedVariantId === v.id ? null : v.id)}
                        className={cn(
                          'px-3 py-1.5 rounded-full text-sm border transition-colors',
                          selectedVariantId === v.id
                            ? 'text-white border-transparent'
                            : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                        )}
                        style={selectedVariantId === v.id ? { backgroundColor: 'var(--brand)', borderColor: 'var(--brand)' } : undefined}
                      >
                        {v.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* ── How many did you make? ── */}
              <div>
                <Label className="text-base">How many did you make?</Label>
                <WholeNumberChips
                  values={[...COMMON_BATCH_SIZES]}
                  onPick={(n) => setForm((f) => ({ ...f, unitsProduced: String(n) }))}
                  className="mt-2"
                />
                <Input
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

              {/* ── How many did you sell? (quick log) ── */}
              {!editingBatch && (
                <div className="rounded-lg border p-4 space-y-3" style={{ borderColor: 'var(--brand-mid)', backgroundColor: 'var(--brand-light)' }}>
                  <div>
                    <Label className="text-base" style={{ color: 'var(--brand-dark)' }}>How many did you sell?</Label>
                    <p className="text-xs text-gray-600 mt-0.5">Optional. Log it now to save time later.</p>
                    <WholeNumberChips
                      values={producedQtyParsed > 0
                        ? [1, Math.floor(producedQtyParsed / 2), producedQtyParsed].filter((v, i, a) => v > 0 && a.indexOf(v) === i)
                        : [1, 2, 5, 10]}
                      onPick={(n) => setForm((f) => ({ ...f, unitsSold: String(n) }))}
                      className="mt-2"
                    />
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      inputMode="decimal"
                      value={form.unitsSold}
                      onChange={(e) => setForm({ ...form, unitsSold: e.target.value })}
                      placeholder="0 (skip if not selling yet)"
                      className="mt-2 min-h-11 text-base"
                    />
                  </div>
                  {soldQtyParsed > 0 && (
                    <div>
                      <Label className="text-base">Price per item</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0.01"
                        inputMode="decimal"
                        value={form.salePrice}
                        onChange={(e) => setForm({ ...form, salePrice: e.target.value })}
                        placeholder="How much did you charge?"
                        className="mt-1 min-h-11 text-base"
                        autoFocus
                      />
                    </div>
                  )}
                </div>
              )}

              {/* ── Not for sale (samples) ── */}
              {!editingBatch && (
                <div>
                  <Label className="text-base">How many are NOT for sale?</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    inputMode="decimal"
                    value={form.unitsGivenAway}
                    onChange={(e) => setForm({ ...form, unitsGivenAway: e.target.value })}
                    placeholder="0 (leave blank if everything goes to customers)"
                    className="mt-2 min-h-11 text-base"
                  />
                  <p className="text-xs text-gray-600 mt-1">
                    Samples, gifts, tasting pieces. Anything you made but will not sell.
                  </p>
                </div>
              )}

              {/* ── Date ── */}
              <div>
                <Label htmlFor="date" className="text-base">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={form.producedAt}
                  onChange={(e) => setForm({ ...form, producedAt: e.target.value })}
                  className="mt-1 min-h-11"
                  required
                />
              </div>

              {/* ── Note ── */}
              <details className="text-sm border rounded-lg p-3 bg-gray-50">
                <summary className="cursor-pointer font-medium">Note (optional)</summary>
                <Input
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="e.g. morning shift"
                  className="mt-2 min-h-11"
                />
              </details>

              {/* ── Ingredient tracking ── */}
              {!editingBatch && (
                <details id="ingredient-tracking-details" className="border rounded-lg" style={{ borderColor: 'var(--brand-mid)' }}>
                  <summary className="cursor-pointer px-3 py-3 flex items-center justify-between rounded-lg" style={{ backgroundColor: 'var(--brand-light)' }}>
                    <span className="text-base font-medium" style={{ color: 'var(--brand-dark)' }}>Track what you used (optional)</span>
                    <span className="text-xs text-gray-500 ml-2">
                      {appliedRecipeId
                        ? `Recipe applied · ${lines.filter((l) => l.itemId).length} ingredients`
                        : 'Add ingredients to see cost'}
                    </span>
                  </summary>
                  <div className="space-y-3 px-3 pb-3 pt-2">
                    {/* ── Recipe picker ── */}
                    {recipesForProduct.length > 0 && (
                      <div
                        className="rounded-lg border p-3 space-y-2"
                        style={{ borderColor: 'var(--brand-mid)', backgroundColor: 'var(--brand-light)' }}
                      >
                        <p className="text-xs font-medium" style={{ color: 'var(--brand-dark)' }}>
                          Use a saved recipe to pre-fill ingredients
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {recipesForProduct.map((recipe) => (
                            <button
                              key={recipe.id}
                              type="button"
                              onClick={() => applyRecipe(recipe)}
                              className={cn(
                                'text-xs px-3 py-1.5 rounded-full border transition-colors',
                                appliedRecipeId === recipe.id
                                  ? 'text-white border-transparent'
                                  : 'bg-white border-gray-200 text-gray-700 hover:border-gray-400'
                              )}
                              style={appliedRecipeId === recipe.id ? { backgroundColor: 'var(--brand)', borderColor: 'var(--brand)' } : {}}
                            >
                              {recipe.name}
                              {recipe.variant_id && (
                                <span className="ml-1 opacity-70">
                                  ({variantsForProduct.find((v) => v.id === recipe.variant_id)?.name ?? 'variant'})
                                </span>
                              )}
                            </button>
                          ))}
                        </div>
                        {appliedRecipeId && (
                          <p className="text-xs text-gray-500">
                            Ingredients scaled to {form.unitsProduced || '?'} units. Edit any line below if needed.
                          </p>
                        )}
                      </div>
                    )}

                    <div className="flex justify-between items-center gap-2">
                      <p className="text-xs text-gray-600">
                        Amounts are in each item&apos;s recipe unit (cups, grams, eggs…).
                      </p>
                      <Button type="button" size="sm" variant="outline" onClick={addLine}>
                        + Add row
                      </Button>
                    </div>
                    {stockItems.length === 0 && (
                      <p className="text-sm bg-white border rounded-lg px-3 py-2" style={{ borderColor: 'var(--brand-mid)', color: 'var(--brand-dark)' }}>
                        No stock items yet.{' '}
                        <Link href="/dashboard/stock" className="underline font-medium">Add your ingredients</Link>
                        {' '}first to track costs here.
                      </p>
                    )}
                    {lines.map((line, index) => {
                      const cupItem = lineUsageUnitName(line) === 'cup'
                      const lineItem = line.itemId ? stockItems.find((s) => s.id === line.itemId) : null
                      const lineQty = parseFloat(line.quantity)
                      const lineEstSubtotal = lineItem && lineQty > 0 ? lineQty * estimatedCostPerUsageUnit(lineItem) : null
                      return (
                        <div key={index} className="space-y-2 border-b pb-3 last:border-0" style={{ borderColor: 'var(--brand-light)' }}>
                          <select
                            value={line.itemId}
                            onChange={(e) => {
                              const v = e.target.value
                              setLines((prev) => prev.map((row, i) => i === index ? { ...row, itemId: v, purchaseLotId: '' } : row))
                            }}
                            className="w-full px-3 py-2.5 border border-gray-200 rounded-md text-base min-h-11"
                          >
                            <option value="">Pick an item</option>
                            {stockItems.map((it) => (
                              <option key={it.id} value={it.id}>{it.name} · {it.usage_unit_name}</option>
                            ))}
                          </select>
                          <Input
                            type="number"
                            step="0.0001"
                            min="0"
                            inputMode="decimal"
                            value={line.quantity}
                            onChange={(e) => setLineQty(index, e.target.value)}
                            placeholder="How much did you use?"
                            className="min-h-11 text-base"
                          />
                          {lineEstSubtotal != null && lineQty > 0 ? (
                            <p className="text-xs text-gray-600">
                              This line:{' '}
                              <strong className="text-gray-900">{formatCurrency(lineEstSubtotal / lineQty, currency)}</strong>
                              {' '}per {lineItem?.usage_unit_name ?? 'unit'} ·{' '}
                              <strong className="text-gray-900">{formatCurrency(lineEstSubtotal, currency)}</strong> total
                            </p>
                          ) : null}
                          {cupItem && (
                            <div>
                              <p className="text-xs text-gray-600 mb-1">Cup shortcuts</p>
                              <CupFractionRow onPick={(v) => setLineQty(index, String(v))} />
                            </div>
                          )}
                          {!cupItem && line.itemId && (
                            <WholeNumberChips values={[1, 2, 5, 10, 100, 500]} onPick={(n) => setLineQty(index, String(n))} />
                          )}
                          {line.itemId ? (
                            <details
                              className="text-xs border border-dashed border-gray-200 rounded-md px-2 py-1"
                              onToggle={(e) => {
                                if (e.currentTarget.open && line.itemId) void fetchLotsForItem(line.itemId)
                              }}
                            >
                              <summary className="cursor-pointer text-gray-600 py-1">
                                Something wrong with stock? Pick a specific purchase (optional)
                              </summary>
                              <div className="pt-2 pb-1">
                                <select
                                  value={line.purchaseLotId}
                                  onChange={(ev) =>
                                    setLines((prev) => prev.map((row, i) => i === index ? { ...row, purchaseLotId: ev.target.value } : row))
                                  }
                                  className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm min-h-10"
                                >
                                  <option value="">Let Operbase choose (normal)</option>
                                  {(lotOptionsByItem[line.itemId] ?? []).map((lot) => {
                                    const u = stockItems.find((s) => s.id === line.itemId)?.usage_unit_name
                                    return (
                                      <option key={lot.id} value={lot.id}>
                                        {new Date(lot.purchased_at).toLocaleDateString()} · {Number(lot.quantity_remaining).toFixed(2)} {u ?? ''} @ {formatCurrency(Number(lot.cost_per_usage_unit), currency)}/{u ?? 'unit'}
                                      </option>
                                    )
                                  })}
                                </select>
                              </div>
                            </details>
                          ) : null}
                          {lines.length > 1 && (
                            <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => removeLine(index)}>
                              Remove row
                            </Button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </details>
              )}

              {/* ── Cost preview ── */}
              {!editingBatch && liveProductionCost.lineDetails.length > 0 && (
                <div className="rounded-lg border p-4 space-y-3" style={{ borderColor: 'var(--brand-mid)', backgroundColor: 'var(--brand-light)' }}>
                  <p className="text-sm font-semibold text-gray-900">Cost preview</p>
                  <ul className="text-sm text-gray-700 space-y-1.5">
                    {liveProductionCost.lineDetails.map((d, i) => (
                      <li key={`${d.name}-${i}`} className="flex justify-between gap-3">
                        <span className="min-w-0 truncate">{d.name} × {d.qty} {d.unit}</span>
                        <span className="tabular-nums shrink-0">{formatCurrency(d.est, currency)}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="border-t pt-2 space-y-1 text-sm" style={{ borderColor: 'var(--brand-mid)' }}>
                    <div className="flex justify-between font-medium text-gray-900">
                      <span>Ingredients total</span>
                      <span>{formatCurrency(liveProductionCost.ingredients, currency)}</span>
                    </div>
                    {liveProductionCost.made > 0 ? (
                      <div className="flex justify-between text-gray-700">
                        <span>Per finished item</span>
                        <span className="font-semibold tabular-nums">{formatCurrency(liveProductionCost.perPiece, currency)}</span>
                      </div>
                    ) : (
                      <p className="text-xs" style={{ color: 'var(--brand-dark)' }}>
                        Enter how many you made above to see cost per item.
                      </p>
                    )}
                  </div>
                </div>
              )}

              <Button
                type="submit"
                size="lg"
                className="w-full min-h-12 text-base text-white"
                style={{ backgroundColor: 'var(--brand)' }}
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

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Made', value: totalProduced.toFixed(0), color: 'text-gray-900' },
          { label: 'Sold', value: totalSoldFromBatches.toFixed(0), color: 'text-green-600' },
          { label: 'Left', value: totalRemaining.toFixed(0), color: 'text-amber-700' },
          { label: 'Lost', value: (totalGivenAtStart + totalGivenLater + batches.reduce((s, b) => s + b.units_spoiled + b.units_not_sold_loss, 0)).toFixed(0), color: 'text-gray-500' },
        ].map(({ label, value, color }) => (
          <Card key={label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">{label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${color}`}>{value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Batch table ── */}
      <Card id="production-batches">
        <CardHeader>
          <CardTitle>Your runs</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center text-gray-500 py-8">Loading...</p>
          ) : batches.length === 0 ? (
            <p className="text-center text-gray-500 py-8 max-w-lg mx-auto leading-relaxed">
              Nothing recorded yet. Tap Record production when you finish a run.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10 p-2" />
                    <TableHead>Product</TableHead>
                    <TableHead>Sold</TableHead>
                    <TableHead>Left</TableHead>
                    <TableHead>Lost</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batches.map((batch) => {
                    const cogs = batch.cost_of_goods ?? 0
                    const cpu = costPerOutputUnit(cogs, batch.units_produced)
                    const tiedUp = batch.units_remaining > 0 && batch.cost_of_goods != null && batch.units_produced > 0
                      ? batch.units_remaining * cpu : 0
                    const runResult = batch.revenue_from_batch - (batch.cost_of_goods ?? 0)
                    const expanded = expandedBatchId === batch.id
                    const totalLost = batch.units_given_away + batch.units_given_out_extra + batch.units_spoiled + batch.units_not_sold_loss
                    return (
                      <Fragment key={batch.id}>
                        <TableRow>
                          <TableCell className="p-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0"
                              aria-expanded={expanded}
                              onClick={() => setExpandedBatchId(expanded ? null : batch.id)}
                            >
                              {expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                            </Button>
                          </TableCell>
                          <TableCell className="font-medium">
                            <div>{batch.product_name}</div>
                            <div className="text-sm font-normal text-gray-500">
                              {formatFriendlyDate(batch.produced_at, timezone)}
                            </div>
                          </TableCell>
                          <TableCell className="tabular-nums text-green-700">{batch.units_sold_from_batch}</TableCell>
                          <TableCell className="tabular-nums font-medium text-amber-700">{batch.units_remaining}</TableCell>
                          <TableCell className="tabular-nums text-gray-500">{totalLost > 0 ? totalLost : '-'}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex flex-wrap gap-1 justify-end">
                              {batch.units_remaining > 0 && batch.product_id ? (
                                <Button size="sm" className="text-white" style={{ backgroundColor: 'var(--brand)' }} asChild>
                                  <Link href={`/dashboard/sales?batch=${batch.id}`}>Sell</Link>
                                </Button>
                              ) : null}
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={batch.units_remaining <= 0}
                                onClick={() => { setDisposeTarget(batch); setDisposeQty('') }}
                              >
                                Gave away / lost
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => requestEditBatch(batch)}>Edit</Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-gray-400 hover:text-red-600"
                                aria-label={`Delete ${batch.product_name}`}
                                onClick={() => handleDelete(batch.id)}
                              >
                                <Trash2 size={14} />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                        {expanded ? (
                          <TableRow className="bg-gray-50/80">
                            <TableCell colSpan={6} className="p-4 text-sm text-gray-800">
                              <div className="space-y-4 max-w-3xl">
                                <div className="rounded-lg border-2 p-4" style={{ borderColor: 'var(--brand-mid)', backgroundColor: 'var(--brand-light)' }}>
                                  <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--brand-dark)' }}>
                                    Cost in what is left
                                  </p>
                                  {tiedUp > 0 ? (
                                    <>
                                      <p className="text-2xl font-bold tabular-nums text-gray-900 mt-1">
                                        {formatCurrency(tiedUp, currency)}
                                      </p>
                                      <p className="text-sm text-gray-700 mt-2">
                                        Your ingredient cost for the{' '}
                                        <strong className="tabular-nums">{batch.units_remaining}</strong> you have not sold yet.{' '}
                                        {batch.product_id ? (
                                          <>
                                            <Link href={`/dashboard/sales?batch=${batch.id}`} className="font-semibold underline" style={{ color: 'var(--brand-dark)' }}>
                                              Log a sale
                                            </Link>{' '}
                                            to turn this into cash, or use{' '}
                                          </>
                                        ) : (
                                          <>Use </>
                                        )}
                                        <span className="font-medium">What happened?</span> above if those pieces will not sell.
                                      </p>
                                    </>
                                  ) : (
                                    <p className="text-sm text-gray-700 mt-1">
                                      Nothing left unsold from this run.
                                    </p>
                                  )}
                                </div>

                                {batch.cost_of_goods != null ? (
                                  <div className={`rounded-xl border-2 p-5 sm:p-6 ${runResult >= 0 ? 'border-green-400 bg-green-50/90' : 'border-red-400 bg-red-50/90'}`}>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                                      {runResult >= 0 ? 'Ahead on this run' : 'Behind on this run'}
                                    </p>
                                    <p className={`text-3xl sm:text-4xl font-extrabold tabular-nums mt-1 ${runResult >= 0 ? 'text-green-800' : 'text-red-800'}`}>
                                      {runResult >= 0 ? '+' : '-'}{formatCurrency(Math.abs(runResult), currency)}
                                    </p>
                                    <p className="text-sm font-medium text-gray-800 mt-3">
                                      {runResult < 0 ? 'You may need to increase your price.'
                                        : batch.revenue_from_batch > 0 ? 'Nice — this run did well.'
                                          : batch.units_remaining > 0 ? 'Still waiting for sales — make sure the price works.'
                                            : 'Costs are covered for this run.'}
                                    </p>
                                  </div>
                                ) : (
                                  <p className="text-sm text-gray-600">
                                    Cost for this run was not recorded. Add what you used next time for clearer numbers.
                                  </p>
                                )}

                                <details className="rounded-lg border border-gray-200 bg-white p-3">
                                  <summary className="cursor-pointer font-medium text-gray-900">See full breakdown</summary>
                                  <ul className="mt-3 grid sm:grid-cols-2 gap-2 text-gray-700 text-sm">
                                    <li>You made <strong className="tabular-nums">{batch.units_produced}</strong> in this run.</li>
                                    <li>
                                      <strong className="tabular-nums text-green-700">{batch.units_sold_from_batch}</strong> sold ·{' '}
                                      <strong className="tabular-nums text-amber-700">{batch.units_remaining}</strong> left ·{' '}
                                      <strong className="tabular-nums text-gray-600">{totalLost > 0 ? totalLost : 0}</strong> lost
                                    </li>
                                    <li>Sales money: <strong className="tabular-nums text-green-700">{formatCurrency(batch.revenue_from_batch, currency)}</strong></li>
                                    <li>Cost to make: <strong className="tabular-nums">{batch.cost_of_goods != null ? formatCurrency(batch.cost_of_goods, currency) : '—'}</strong></li>
                                  </ul>
                                  {totalLost > 0 ? (
                                    <p className="mt-3 text-xs text-gray-600 border-t pt-3">
                                      Lost: <span className="tabular-nums">{batch.units_given_away + batch.units_given_out_extra}</span> given away · <span className="tabular-nums">{batch.units_spoiled + batch.units_not_sold_loss}</span> did not become sales.
                                    </p>
                                  ) : null}
                                  {batch.cost_of_goods != null && batch.units_produced > 0 ? (
                                    <p className="mt-2 text-xs text-gray-600">
                                      About <strong className="tabular-nums">{formatCurrency(cpu, currency)}</strong> ingredient cost per piece.
                                    </p>
                                  ) : null}
                                </details>
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : null}
                      </Fragment>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── What happened? dialog ── */}
      <Dialog
        open={!!disposeTarget}
        onOpenChange={(open) => { if (!open) { setDisposeTarget(null); setDisposeQty('') } }}
      >
        <DialogContent className="sm:max-w-md overflow-hidden p-0">
          <div className="px-6 pt-5 pb-4" style={{ backgroundColor: 'var(--brand-light)', borderBottom: '1px solid var(--brand-mid)' }}>
            <DialogHeader>
              <DialogTitle className="text-xl" style={{ color: 'var(--brand-dark)' }}>What happened to the rest?</DialogTitle>
            </DialogHeader>
          </div>
          {disposeTarget ? (
            <div className="space-y-4 px-6 py-5">
              <div className="rounded-lg p-3 text-sm" style={{ backgroundColor: 'var(--brand-light)' }}>
                <p className="font-medium text-gray-900">{disposeTarget.product_name}</p>
                <p className="text-gray-600">{disposeTarget.units_remaining} items not yet sold</p>
              </div>
              <div>
                <Label htmlFor="disposeQty" className="text-base">How many?</Label>
                <WholeNumberChips values={[1, 2, 5, 10]} onPick={(n) => setDisposeQty(String(n))} className="mt-2" />
                <Input
                  id="disposeQty"
                  type="number"
                  step="0.01"
                  min="0.01"
                  inputMode="decimal"
                  value={disposeQty}
                  onChange={(e) => setDisposeQty(e.target.value)}
                  className="mt-2 min-h-11 text-base"
                  placeholder={`Max ${disposeTarget.units_remaining}`}
                />
              </div>
              <p className="text-sm text-gray-600">What happened to them?</p>
              <div className="grid grid-cols-1 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-12 justify-start text-base bg-white hover:bg-purple-50 hover:text-purple-700 hover:border-purple-200"
                  disabled={disposeSubmitting || !disposeQty}
                  onClick={() => void submitDispose('given_out')}
                >
                  <span className="mr-2">🎁</span>
                  Gave them away (samples, gifts, staff)
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-12 justify-start text-base bg-white hover:bg-red-50 hover:text-red-700 hover:border-red-200"
                  disabled={disposeSubmitting || !disposeQty}
                  onClick={() => void submitDispose('not_sold')}
                >
                  <span className="mr-2">🗑️</span>
                  Did not sell (went bad / expired)
                </Button>
              </div>
              {disposeSubmitting ? (
                <p className="text-sm text-gray-500 flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Saving…
                </p>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
