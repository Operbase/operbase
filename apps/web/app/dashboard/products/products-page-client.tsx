'use client'

import { useState } from 'react'
import { Plus, Trash2, Pencil, X, ChevronRight, TrendingUp, TrendingDown, Minus, Info } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useBusinessContext } from '@/providers/business-provider'
import { formatCurrency } from '@/lib/format-currency'
import { friendlyError } from '@/lib/errors'

function InfoTip({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center cursor-help ml-0.5 align-middle">
          <Info size={11} className="text-gray-400" />
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-[220px] text-center leading-snug">{text}</TooltipContent>
    </Tooltip>
  )
}
import type { ProductCatalogRow, ProductVariantRow } from '@/lib/dashboard/products-data'

type WizardStep = 1 | 2 | 3

type VariantDraft = { name: string }
type AddonDraft   = { name: string; extraCost: string }

function emptyVariants(): VariantDraft[] { return [{ name: '' }] }
function emptyAddons(): AddonDraft[]     { return [{ name: '', extraCost: '' }] }

const STEP_LABELS: Record<WizardStep, string> = {
  1: 'What do you sell?',
  2: 'Does it come in different types?',
  3: 'Any extras customers can add?',
}
const STEP_HINTS: Record<WizardStep, string> = {
  1: 'Name it and set the price you charge customers.',
  2: 'e.g. "Oat", "Double Chocolate", "Large". Skip if it only comes one way.',
  3: 'e.g. "Nuts", "Coconut", "Extra sauce". Skip if there are none.',
}

// ── Margin helpers ────────────────────────────────────────────────────────────

function marginPct(salePrice: number, cost: number): number | null {
  if (!salePrice || !cost) return null
  return ((salePrice - cost) / salePrice) * 100
}

function MarginPill({ salePrice, cost }: { salePrice: number; cost: number | null }) {
  if (!cost) return null
  const pct = marginPct(salePrice, cost)
  if (pct === null) return null
  const isGood = pct >= 50
  const isOk   = pct >= 25
  const color  = isGood ? 'text-green-700 bg-green-50 border-green-200'
               : isOk   ? 'text-amber-700 bg-amber-50 border-amber-200'
               :           'text-red-700 bg-red-50 border-red-200'
  const Icon   = isGood ? TrendingUp : isOk ? Minus : TrendingDown
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${color}`}>
      <Icon size={11} />
      {pct.toFixed(0)}% margin
    </span>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ProductsPageClient({
  initialProducts,
}: {
  initialProducts: ProductCatalogRow[]
}) {
  const { businessId, currency } = useBusinessContext()
  const [products, setProducts] = useState<ProductCatalogRow[]>(initialProducts)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [step, setStep]             = useState<WizardStep>(1)
  const [editingId, setEditingId]   = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [productName, setProductName]   = useState('')
  const [salePrice,   setSalePrice]     = useState('')
  const [variants,    setVariants]      = useState<VariantDraft[]>(emptyVariants())
  const [addons,      setAddons]        = useState<AddonDraft[]>(emptyAddons())

  // ── open / close ─────────────────────────────────────────────────────────

  function openCreate() {
    setEditingId(null); setStep(1)
    setProductName(''); setSalePrice('')
    setVariants(emptyVariants()); setAddons(emptyAddons())
    setDialogOpen(true)
  }

  function openEdit(product: ProductCatalogRow) {
    setEditingId(product.id); setStep(1)
    setProductName(product.name)
    setSalePrice(product.sale_price > 0 ? String(product.sale_price) : '')
    setVariants(product.variants.length > 0 ? product.variants.map((v) => ({ name: v.name })) : emptyVariants())
    setAddons(product.addons.length > 0 ? product.addons.map((a) => ({ name: a.name, extraCost: a.extra_cost != null ? String(a.extra_cost) : '' })) : emptyAddons())
    setDialogOpen(true)
  }

  function closeDialog() { setDialogOpen(false) }

  // ── step navigation ───────────────────────────────────────────────────────

  function goNext() {
    if (step === 1) {
      if (!productName.trim()) { toast.error('Enter the product name.'); return }
      if (productName.trim().length > 200) { toast.error('Name must be 200 characters or less.'); return }
      setStep(2)
    } else if (step === 2) {
      setStep(3)
    }
  }

  function goBack() {
    if (step === 2) setStep(1)
    if (step === 3) setStep(2)
  }

  // ── helpers ───────────────────────────────────────────────────────────────

  function addVariantRow() { setVariants((v) => [...v, { name: '' }]) }
  function removeVariantRow(i: number) { setVariants((v) => v.filter((_, idx) => idx !== i)) }
  function setVariantName(i: number, val: string) { setVariants((v) => v.map((x, idx) => idx === i ? { name: val } : x)) }

  function addAddonRow() { setAddons((a) => [...a, { name: '', extraCost: '' }]) }
  function removeAddonRow(i: number) { setAddons((a) => a.filter((_, idx) => idx !== i)) }
  function setAddonField(i: number, field: keyof AddonDraft, val: string) {
    setAddons((a) => a.map((x, idx) => idx === i ? { ...x, [field]: val } : x))
  }

  // ── save ──────────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!businessId || isSubmitting) return
    setIsSubmitting(true)

    const supabase     = createClient()
    const nameTrim     = productName.trim()
    const salePriceNum = parseFloat(salePrice) || 0

    const validVariants = variants
      .filter((v) => v.name.trim().length > 0)
      .map((v, i) => ({ name: v.name.trim(), sort_order: i, cost_per_unit: null }))

    const validAddons = addons
      .filter((a) => a.name.trim().length > 0)
      .map((a, i) => ({
        name: a.name.trim(),
        extra_cost: a.extraCost.trim() !== '' ? parseFloat(a.extraCost) || null : null,
        sort_order: i,
      }))

    try {
      let productId: string

      if (editingId) {
        const { error: updErr } = await supabase
          .from('products')
          .update({ name: nameTrim, sale_price: salePriceNum })
          .eq('id', editingId)
          .eq('business_id', businessId)
        if (updErr) throw updErr
        productId = editingId

        await Promise.all([
          supabase.from('product_variants').delete().eq('product_id', productId),
          supabase.from('product_addons').delete().eq('product_id', productId),
        ])
      } else {
        const { data: newProd, error: insErr } = await supabase
          .from('products')
          .insert({ business_id: businessId, name: nameTrim, sale_price: salePriceNum })
          .select('id')
          .single()
        if (insErr) throw insErr
        productId = newProd.id as string
      }

      if (validVariants.length > 0) {
        const { error: vErr } = await supabase.from('product_variants').insert(
          validVariants.map((v) => ({ product_id: productId, business_id: businessId, name: v.name, cost_per_unit: v.cost_per_unit, sort_order: v.sort_order }))
        )
        if (vErr) throw vErr
      }

      if (validAddons.length > 0) {
        const { error: aErr } = await supabase.from('product_addons').insert(
          validAddons.map((a) => ({ product_id: productId, business_id: businessId, name: a.name, extra_cost: a.extra_cost, sort_order: a.sort_order }))
        )
        if (aErr) throw aErr
      }

      toast.success(editingId ? 'Product saved!' : 'Product added!')
      closeDialog()
      await refreshProducts()
    } catch (err) {
      toast.error(friendlyError(err, 'Could not save product. Try again.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this product? All its types and extras will also be removed.')) return
    if (!businessId) return
    const supabase = createClient()
    const { error } = await supabase.from('products').delete().eq('id', id).eq('business_id', businessId)
    if (error) { toast.error(friendlyError(error)); return }
    toast.success('Product removed.')
    setProducts((p) => p.filter((x) => x.id !== id))
  }

  async function refreshProducts() {
    if (!businessId) return
    const supabase = createClient()
    // Re-fetch catalog + batch costs
    const [catRes, batchRes] = await Promise.all([
      supabase
        .from('products')
        .select(`id, name, sale_price, is_active, created_at, product_variants(id, name, sort_order, cost_per_unit), product_addons(id, name, extra_cost, sort_order)`)
        .eq('business_id', businessId).eq('is_active', true).order('name'),
      supabase
        .from('batches')
        .select('product_id, variant_id, cost_of_goods, units_produced')
        .eq('business_id', businessId)
        .not('cost_of_goods', 'is', null)
        .gt('units_produced', 0),
    ])

    // Group batch costs
    type B = { product_id: string; variant_id: string | null; cost_of_goods: number; units_produced: number }
    const costMap = new Map<string, { totalCost: number; totalUnits: number; runs: number }>()
    for (const b of ((batchRes.data ?? []) as B[])) {
      const key = `${b.product_id}::${b.variant_id ?? ''}`
      const e = costMap.get(key)
      const cost = Number(b.cost_of_goods); const units = Number(b.units_produced)
      if (e) { e.totalCost += cost; e.totalUnits += units; e.runs++ }
      else costMap.set(key, { totalCost: cost, totalUnits: units, runs: 1 })
    }

    const productCosts = new Map<string, { avg: number; runs: number }>()
    const variantCosts = new Map<string, { avg: number; runs: number }>()
    for (const [key, val] of costMap.entries()) {
      const [pid, vid] = key.split('::')
      const avg = val.totalUnits > 0 ? val.totalCost / val.totalUnits : 0
      if (vid) variantCosts.set(vid, { avg, runs: val.runs })
      else productCosts.set(pid, { avg, runs: val.runs })
    }

    setProducts(
      ((catRes.data ?? []) as Record<string, unknown>[]).map((p) => {
        const productId = p.id as string
        const variants = ((p.product_variants as (ProductVariantRow & { sort_order: number })[] | null) ?? [])
          .slice().sort((a, b) => a.sort_order - b.sort_order)
          .map((v) => {
            const vc = variantCosts.get(v.id)
            return { ...v, cost_per_unit: v.cost_per_unit ?? null, avgCostPerUnit: vc ? vc.avg : null, runCount: vc ? vc.runs : 0 }
          })

        let productAvg: number | null = null; let productRuns = 0
        if (variants.length > 0) {
          const withData = variants.filter((v) => v.avgCostPerUnit != null)
          if (withData.length > 0) { productAvg = withData.reduce((s, v) => s + (v.avgCostPerUnit ?? 0), 0) / withData.length; productRuns = withData.reduce((s, v) => s + v.runCount, 0) }
        } else {
          const pc = productCosts.get(productId)
          if (pc) { productAvg = pc.avg; productRuns = pc.runs }
        }

        return {
          id: productId, name: p.name as string, sale_price: Number(p.sale_price ?? 0),
          is_active: p.is_active as boolean, created_at: p.created_at as string,
          variants, addons: ((p.product_addons as { id: string; name: string; extra_cost: number | null; sort_order: number }[] | null) ?? []).slice().sort((a, b) => a.sort_order - b.sort_order),
          avgCostPerUnit: productAvg, runCount: productRuns,
        }
      })
    )
  }

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Products</h1>
          <p className="text-gray-600 mt-1">
            What you make and sell.{' '}
            <Link href="/dashboard/stock" className="underline font-medium" style={{ color: 'var(--brand)' }}>
              Stock
            </Link>{' '}
            is where you track ingredients.
          </p>
        </div>
        <Button onClick={openCreate} size="lg" className="shrink-0" style={{ backgroundColor: 'var(--brand)' }}>
          <Plus size={18} className="mr-2" />
          Add product
        </Button>
      </div>

      {/* ── Product list ─────────────────────────────────────────────── */}
      {products.length === 0 ? (
        <div className="text-center py-16 text-gray-500 border border-dashed rounded-xl">
          <p className="text-lg font-medium text-gray-700">No products yet</p>
          <p className="text-sm mt-1 max-w-xs mx-auto">Add your first product and set a sale price to see your margins here.</p>
          <Button onClick={openCreate} className="mt-5" style={{ backgroundColor: 'var(--brand)' }}>
            <Plus size={16} className="mr-2" />
            Add your first product
          </Button>
        </div>
      ) : (
        <div className="grid gap-3">
          {products.map((product) => (
            <div key={product.id} className="rounded-xl border border-gray-200 bg-white shadow-sm hover:border-gray-300 transition-colors overflow-hidden">

              {/* ── Header row ── */}
              <div className="flex items-start justify-between gap-3 p-4 pb-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-gray-900 text-base">{product.name}</p>
                    {product.sale_price > 0 && (
                      <span className="text-sm font-medium text-gray-500">
                        {formatCurrency(product.sale_price, currency)}
                      </span>
                    )}
                    {product.variants.length === 0 && (
                      <MarginPill salePrice={product.sale_price} cost={product.avgCostPerUnit} />
                    )}
                  </div>

                  {/* ── Margin row (no variants) ── */}
                  {product.variants.length === 0 && product.avgCostPerUnit != null && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                      <span>
                        Avg production cost
                        <InfoTip text="Total ingredient cost across all runs ÷ total units produced" />
                        : <span className="font-semibold text-gray-700">{formatCurrency(product.avgCostPerUnit, currency)}</span>
                      </span>
                      {product.sale_price > 0 && (
                        <span>
                          Profit per unit
                          <InfoTip text="Sale price − average production cost per unit" />
                          : <span className="font-semibold text-gray-700">{formatCurrency(product.sale_price - product.avgCostPerUnit, currency)}</span>
                        </span>
                      )}
                      <span className="text-gray-400">from {product.runCount} run{product.runCount !== 1 ? 's' : ''}</span>
                    </div>
                  )}

                  {/* ── No cost data yet (no variants) ── */}
                  {product.variants.length === 0 && product.avgCostPerUnit == null && (
                    <p className="text-xs text-gray-400 mt-1">
                      Log a production run to see your cost and margin.
                    </p>
                  )}

                  {/* ── Variants with per-variant margin ── */}
                  {product.variants.length > 0 && (
                    <div className="mt-2 space-y-1.5">
                      {product.variants.map((v) => (
                        <div key={v.id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                          <span className="text-sm font-medium text-gray-700 min-w-[80px]">{v.name}</span>
                          {v.avgCostPerUnit != null ? (
                            <>
                              <span className="text-xs text-gray-500">
                                Avg cost<InfoTip text="Total ingredient cost for this variant ÷ units produced across all its runs" />
                                : <span className="font-semibold text-gray-700">{formatCurrency(v.avgCostPerUnit, currency)}</span>
                              </span>
                              {product.sale_price > 0 && (
                                <span className="text-xs text-gray-500">
                                  Profit<InfoTip text="Sale price − average production cost for this variant" />
                                  : <span className="font-semibold text-gray-700">{formatCurrency(product.sale_price - v.avgCostPerUnit, currency)}</span>
                                </span>
                              )}
                              <MarginPill salePrice={product.sale_price} cost={v.avgCostPerUnit} />
                              <span className="text-xs text-gray-400">{v.runCount} run{v.runCount !== 1 ? 's' : ''}</span>
                            </>
                          ) : (
                            <span className="text-xs text-gray-400">No runs yet</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* ── Addons ── */}
                  {product.addons.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {product.addons.map((a) => (
                        <Badge key={a.id} variant="outline" className="text-xs"
                          style={{ borderColor: 'var(--brand-mid)', color: 'var(--brand-dark)', backgroundColor: 'var(--brand-light)' }}>
                          + {a.name}
                          {a.extra_cost != null && a.extra_cost > 0 ? ` (${formatCurrency(a.extra_cost, currency)})` : ''}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex gap-1 shrink-0">
                  <Button size="sm" variant="ghost" aria-label={`Edit ${product.name}`} onClick={() => openEdit(product)}>
                    <Pencil size={14} />
                  </Button>
                  <Button size="sm" variant="ghost" className="text-gray-400 hover:text-red-600" aria-label={`Delete ${product.name}`} onClick={() => handleDelete(product.id)}>
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>

              {/* ── Quick actions ── */}
              <div className="flex gap-4 px-4 py-2.5 border-t border-gray-100 bg-gray-50/60">
                {(['made', 'sold', 'gave'] as const).map((action) => (
                  <button key={action} type="button"
                    className="text-xs font-medium text-gray-500 hover:text-gray-900 transition-colors"
                    onClick={() => window.dispatchEvent(new CustomEvent('operbase:quick-log', { detail: { tab: action, productName: product.name } }))}>
                    {action === 'made' ? '+ I made some' : action === 'sold' ? '+ I sold some' : '+ I gave some away'}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Wizard dialog ─────────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto p-0">
          <div className="px-6 pt-5 pb-4 sticky top-0 z-10" style={{ backgroundColor: 'var(--brand-light)', borderBottom: '1px solid var(--brand-mid)' }}>
            <DialogHeader>
              <DialogTitle className="text-xl" style={{ color: 'var(--brand-dark)' }}>
                {editingId ? 'Edit product' : 'Add product'}
              </DialogTitle>
            </DialogHeader>

            <div className="flex items-center gap-2 text-sm mt-3">
              {([1, 2, 3] as WizardStep[]).map((s, i) => (
                <div key={s} className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium"
                    style={s === step ? { backgroundColor: 'var(--brand)', color: 'white' } : s < step ? { backgroundColor: 'var(--brand-mid)', color: 'var(--brand-dark)' } : { backgroundColor: '#f3f4f6', color: '#9ca3af' }}>
                    {s}
                  </span>
                  {i < 2 && <ChevronRight size={12} className="text-gray-300" />}
                </div>
              ))}
              <span className="ml-1 font-medium text-gray-700">{STEP_LABELS[step]}</span>
            </div>
            <p className="text-sm text-gray-600 mt-1">{STEP_HINTS[step]}</p>
          </div>

          <div className="px-6 py-4 space-y-4">

            {/* ── Step 1: Name + price ─────────────────────────────── */}
            {step === 1 && (
              <div className="space-y-3">
                <div>
                  <Label htmlFor="productName" className="text-base">Product name</Label>
                  <Input
                    id="productName"
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    placeholder="e.g. Banana Bread"
                    className="mt-1 min-h-11 text-base"
                    autoFocus
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); goNext() } }}
                  />
                </div>
                <div>
                  <Label htmlFor="salePrice" className="text-base">Sale price <span className="text-sm font-normal text-gray-400">(what you charge customers)</span></Label>
                  <div className="relative mt-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm select-none">{currency}</span>
                    <Input
                      id="salePrice"
                      type="number"
                      step="0.01"
                      min="0"
                      value={salePrice}
                      onChange={(e) => setSalePrice(e.target.value)}
                      placeholder="0.00"
                      className="min-h-11 text-base pl-10"
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">You can update this any time. It&apos;s used to calculate your margin.</p>
                </div>
                <div className="flex justify-end pt-2">
                  <Button onClick={goNext} style={{ backgroundColor: 'var(--brand)' }}>
                    Next <ChevronRight size={16} className="ml-1" />
                  </Button>
                </div>
              </div>
            )}

            {/* ── Step 2: Variants ─────────────────────────────────── */}
            {step === 2 && (
              <div className="space-y-3">
                <div className="space-y-2">
                  {variants.map((v, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input
                        value={v.name}
                        onChange={(e) => setVariantName(i, e.target.value)}
                        placeholder={i === 0 ? 'e.g. Oat' : i === 1 ? 'e.g. Double Choc' : `Type ${i + 1}`}
                        className="min-h-10 text-base"
                        autoFocus={i === variants.length - 1 && i > 0}
                      />
                      {variants.length > 1 && (
                        <button type="button" onClick={() => removeVariantRow(i)} className="text-gray-300 hover:text-red-500 transition-colors" aria-label={`Remove type ${i + 1}`}>
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <Button type="button" variant="outline" size="sm" onClick={addVariantRow}>
                  <Plus size={14} className="mr-1" /> Add another type
                </Button>
                <div className="flex justify-between pt-2">
                  <Button variant="outline" onClick={goBack}>Back</Button>
                  <div className="flex gap-2">
                    <Button variant="ghost" onClick={() => { setVariants(emptyVariants()); setStep(3) }} className="text-gray-500">Skip</Button>
                    <Button onClick={goNext} style={{ backgroundColor: 'var(--brand)' }}>Next <ChevronRight size={16} className="ml-1" /></Button>
                  </div>
                </div>
              </div>
            )}

            {/* ── Step 3: Add-ons ──────────────────────────────────── */}
            {step === 3 && (
              <div className="space-y-3">
                <div className="grid grid-cols-[1fr_auto_auto] gap-x-2 gap-y-2 items-center">
                  <span className="text-xs font-medium text-gray-500">Extra name</span>
                  <span className="text-xs font-medium text-gray-500 w-28 text-center">Extra charge</span>
                  <span className="w-7" />
                  {addons.map((a, i) => (
                    <>
                      <Input key={`aname-${i}`} value={a.name} onChange={(e) => setAddonField(i, 'name', e.target.value)} placeholder={i === 0 ? 'e.g. Nuts' : i === 1 ? 'e.g. Coconut' : `Extra ${i + 1}`} className="min-h-10 text-base" autoFocus={i === addons.length - 1 && i > 0} />
                      <Input key={`acost-${i}`} type="number" step="0.01" min="0" value={a.extraCost} onChange={(e) => setAddonField(i, 'extraCost', e.target.value)} placeholder="0.00" className="min-h-10 text-sm w-28 shrink-0" />
                      <div key={`adel-${i}`} className="w-7 flex justify-center">
                        {addons.length > 1 && (
                          <button type="button" onClick={() => removeAddonRow(i)} className="text-gray-300 hover:text-red-500 transition-colors" aria-label={`Remove extra ${i + 1}`}>
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    </>
                  ))}
                </div>
                <Button type="button" variant="outline" size="sm" onClick={addAddonRow}>
                  <Plus size={14} className="mr-1" /> Add another extra
                </Button>
                <div className="flex justify-between pt-2">
                  <Button variant="outline" onClick={goBack}>Back</Button>
                  <div className="flex gap-2">
                    <Button variant="ghost" onClick={() => { setAddons(emptyAddons()); void handleSave() }} className="text-gray-500" disabled={isSubmitting}>
                      Skip and save
                    </Button>
                    <Button onClick={() => void handleSave()} style={{ backgroundColor: 'var(--brand)' }} disabled={isSubmitting}>
                      {isSubmitting ? 'Saving…' : 'Save product'}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
