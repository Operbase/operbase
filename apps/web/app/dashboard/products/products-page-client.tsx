'use client'

import { useState } from 'react'
import { Plus, Trash2, Pencil, X, ChevronRight } from 'lucide-react'
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
import { createClient } from '@/lib/supabase/client'
import { useBusinessContext } from '@/providers/business-provider'
import { formatCurrency } from '@/lib/format-currency'
import { friendlyError } from '@/lib/errors'
import type { ProductCatalogRow } from '@/lib/dashboard/products-data'

type WizardStep = 1 | 2 | 3

/** A variant row in the Step-2 form */
type VariantDraft = {
  name: string
  /** What it costs to make one of this type */
  cost: string
}

type AddonDraft = { name: string; extraCost: string }

function emptyVariants(): VariantDraft[] {
  return [{ name: '', cost: '' }]
}

function emptyAddons(): AddonDraft[] {
  return [{ name: '', extraCost: '' }]
}

const STEP_LABELS: Record<WizardStep, string> = {
  1: 'What do you sell?',
  2: 'Does it come in different types?',
  3: 'Any extras customers can add?',
}

const STEP_HINTS: Record<WizardStep, string> = {
  1: 'Give it a name your whole team will recognise.',
  2: 'E.g. "Oat", "Double Chocolate", "Large". Skip if it only comes one way.\nAdd what it costs you to make each type — we use this to work out profit.',
  3: 'E.g. "Nuts", "Coconut", "Extra sauce". Skip if there are none.',
}

export function ProductsPageClient({
  initialProducts,
}: {
  initialProducts: ProductCatalogRow[]
}) {
  const { businessId, currency } = useBusinessContext()
  const [products, setProducts] = useState<ProductCatalogRow[]>(initialProducts)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [step, setStep] = useState<WizardStep>(1)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Step-1 state
  const [productName, setProductName] = useState('')

  // Step-2 state: type name + cost
  const [variants, setVariants] = useState<VariantDraft[]>(emptyVariants())

  // Step-3 state: addon name + optional price
  const [addons, setAddons] = useState<AddonDraft[]>(emptyAddons())

  // ─── open / close ──────────────────────────────────────────────────────────

  function openCreate() {
    setEditingId(null)
    setStep(1)
    setProductName('')
    setVariants(emptyVariants())
    setAddons(emptyAddons())
    setDialogOpen(true)
  }

  function openEdit(product: ProductCatalogRow) {
    setEditingId(product.id)
    setStep(1)
    setProductName(product.name)
    setVariants(
      product.variants.length > 0
        ? product.variants.map((v) => ({
            name: v.name,
            cost: v.cost_per_unit != null ? String(v.cost_per_unit) : '',
          }))
        : emptyVariants()
    )
    setAddons(
      product.addons.length > 0
        ? product.addons.map((a) => ({
            name: a.name,
            extraCost: a.extra_cost != null ? String(a.extra_cost) : '',
          }))
        : emptyAddons()
    )
    setDialogOpen(true)
  }

  function closeDialog() {
    setDialogOpen(false)
  }

  // ─── step navigation ───────────────────────────────────────────────────────

  function goNext() {
    if (step === 1) {
      const name = productName.trim()
      if (!name) {
        toast.error('Enter the product name.')
        return
      }
      if (name.length > 200) {
        toast.error('Product name must be 200 characters or less.')
        return
      }
      setStep(2)
    } else if (step === 2) {
      setStep(3)
    }
  }

  function goBack() {
    if (step === 2) setStep(1)
    if (step === 3) setStep(2)
  }

  // ─── variant helpers ───────────────────────────────────────────────────────

  function addVariantRow() {
    setVariants((v) => [...v, { name: '', cost: '' }])
  }

  function removeVariantRow(i: number) {
    setVariants((v) => v.filter((_, idx) => idx !== i))
  }

  function setVariantField(i: number, field: keyof VariantDraft, val: string) {
    setVariants((v) => v.map((x, idx) => (idx === i ? { ...x, [field]: val } : x)))
  }

  // ─── addon helpers ─────────────────────────────────────────────────────────

  function addAddonRow() {
    setAddons((a) => [...a, { name: '', extraCost: '' }])
  }

  function removeAddonRow(i: number) {
    setAddons((a) => a.filter((_, idx) => idx !== i))
  }

  function setAddonField(i: number, field: keyof AddonDraft, val: string) {
    setAddons((a) =>
      a.map((x, idx) => (idx === i ? { ...x, [field]: val } : x))
    )
  }

  // ─── save ──────────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!businessId || isSubmitting) return
    setIsSubmitting(true)

    const supabase = createClient()
    const nameTrim = productName.trim()

    const validVariants = variants
      .filter((v) => v.name.trim().length > 0)
      .map((v, i) => ({
        name: v.name.trim(),
        cost_per_unit: v.cost.trim() !== '' ? parseFloat(v.cost) || null : null,
        sort_order: i,
      }))

    const validAddons = addons
      .filter((a) => a.name.trim().length > 0)
      .map((a, i) => ({
        name: a.name.trim(),
        extra_cost:
          a.extraCost.trim() !== '' ? parseFloat(a.extraCost) || null : null,
        sort_order: i,
      }))

    try {
      let productId: string

      if (editingId) {
        const { error: updErr } = await supabase
          .from('products')
          .update({ name: nameTrim })
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
          .insert({ business_id: businessId, name: nameTrim })
          .select('id')
          .single()
        if (insErr) throw insErr
        productId = newProd.id as string
      }

      if (validVariants.length > 0) {
        const { error: vErr } = await supabase.from('product_variants').insert(
          validVariants.map((v) => ({
            product_id: productId,
            business_id: businessId,
            name: v.name,
            cost_per_unit: v.cost_per_unit,
            sort_order: v.sort_order,
          }))
        )
        if (vErr) throw vErr
      }

      if (validAddons.length > 0) {
        const { error: aErr } = await supabase.from('product_addons').insert(
          validAddons.map((a) => ({
            product_id: productId,
            business_id: businessId,
            name: a.name,
            extra_cost: a.extra_cost,
            sort_order: a.sort_order,
          }))
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
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id)
      .eq('business_id', businessId)
    if (error) {
      toast.error(friendlyError(error))
      return
    }
    toast.success('Product removed.')
    setProducts((p) => p.filter((x) => x.id !== id))
  }

  async function refreshProducts() {
    if (!businessId) return
    const supabase = createClient()
    const { data } = await supabase
      .from('products')
      .select(`
        id, name, sale_price, is_active, created_at,
        product_variants(id, name, sort_order, cost_per_unit),
        product_addons(id, name, extra_cost, sort_order)
      `)
      .eq('business_id', businessId)
      .eq('is_active', true)
      .order('name')

    setProducts(
      (data ?? []).map((p: Record<string, unknown>) => ({
        id: p.id as string,
        name: p.name as string,
        sale_price: Number(p.sale_price ?? 0),
        is_active: p.is_active as boolean,
        created_at: p.created_at as string,
        variants: ((p.product_variants as { id: string; name: string; sort_order: number; cost_per_unit: number | null }[] | null) ?? [])
          .slice()
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((v) => ({ ...v, cost_per_unit: v.cost_per_unit ?? null })),
        addons: ((p.product_addons as { id: string; name: string; extra_cost: number | null; sort_order: number }[] | null) ?? [])
          .slice()
          .sort((a, b) => a.sort_order - b.sort_order),
      }))
    )
  }

  // ─── render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Products</h1>
          <p className="text-gray-600 mt-1">
            What you sell — with types and extras. Set the cost per type so profit is always accurate.
          </p>
        </div>
        <Button
          onClick={openCreate}
          size="lg"
          className="bg-amber-600 hover:bg-amber-700 shrink-0"
        >
          <Plus size={18} className="mr-2" />
          Add product
        </Button>
      </div>

      {/* ── Product list ─────────────────────────────────────────────── */}
      {products.length === 0 ? (
        <div className="text-center py-16 text-gray-500 border border-dashed rounded-xl">
          <p className="text-lg font-medium text-gray-700">No products yet</p>
          <p className="text-sm mt-1 max-w-xs mx-auto">
            Add your products here. Types (e.g. Oat, Large) and extras (e.g. Nuts) can be added
            to each one.
          </p>
          <Button onClick={openCreate} className="mt-5 bg-amber-600 hover:bg-amber-700">
            <Plus size={16} className="mr-2" />
            Add your first product
          </Button>
        </div>
      ) : (
        <div className="grid gap-3">
          {products.map((product) => (
            <div
              key={product.id}
              className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:border-gray-300 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-gray-900 text-base">{product.name}</p>

                  {product.variants.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {product.variants.map((v) => (
                        <Badge key={v.id} variant="secondary" className="text-xs gap-1">
                          {v.name}
                          {v.cost_per_unit != null && (
                            <span className="text-gray-500 font-normal">
                              · {formatCurrency(v.cost_per_unit, currency)} cost
                            </span>
                          )}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {product.addons.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {product.addons.map((a) => (
                        <Badge
                          key={a.id}
                          variant="outline"
                          className="text-xs border-amber-300 text-amber-800 bg-amber-50"
                        >
                          + {a.name}
                          {a.extra_cost != null && a.extra_cost > 0
                            ? ` (${formatCurrency(a.extra_cost, currency)})`
                            : ''}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {product.variants.length === 0 && product.addons.length === 0 && (
                    <p className="text-xs text-gray-400 mt-1">One type, no extras</p>
                  )}
                </div>

                <div className="flex gap-1 shrink-0">
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Edit ${product.name}`}
                    onClick={() => openEdit(product)}
                  >
                    <Pencil size={14} />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-gray-400 hover:text-red-600"
                    aria-label={`Delete ${product.name}`}
                    onClick={() => handleDelete(product.id)}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Wizard dialog ─────────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">
              {editingId ? 'Edit product' : 'Add product'}
            </DialogTitle>
          </DialogHeader>

          {/* Step indicator */}
          <div className="flex items-center gap-2 text-sm">
            {([1, 2, 3] as WizardStep[]).map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                    s === step
                      ? 'bg-amber-600 text-white'
                      : s < step
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  {s}
                </span>
                {i < 2 && <ChevronRight size={12} className="text-gray-300" />}
              </div>
            ))}
            <span className="ml-1 font-medium text-gray-700">{STEP_LABELS[step]}</span>
          </div>

          <p className="text-sm text-gray-500 -mt-1 whitespace-pre-line">{STEP_HINTS[step]}</p>

          {/* ── Step 1: Product name ─────────────────────────────────── */}
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
              <div className="flex justify-end pt-2">
                <Button onClick={goNext} className="bg-amber-600 hover:bg-amber-700">
                  Next
                  <ChevronRight size={16} className="ml-1" />
                </Button>
              </div>
            </div>
          )}

          {/* ── Step 2: Variants (types) ─────────────────────────────── */}
          {step === 2 && (
            <div className="space-y-3">
              <div className="grid grid-cols-[1fr_auto_auto] gap-x-2 gap-y-2 items-center">
                <span className="text-xs font-medium text-gray-500">Type name</span>
                <span className="text-xs font-medium text-gray-500 w-28 text-center">Cost to make</span>
                <span className="w-7" />

                {variants.map((v, i) => (
                  <>
                    <Input
                      key={`name-${i}`}
                      value={v.name}
                      onChange={(e) => setVariantField(i, 'name', e.target.value)}
                      placeholder={i === 0 ? 'e.g. Oat' : i === 1 ? 'e.g. Double Choc' : `Type ${i + 1}`}
                      className="min-h-10 text-base"
                      autoFocus={i === variants.length - 1 && i > 0}
                    />
                    <Input
                      key={`cost-${i}`}
                      type="number"
                      step="0.01"
                      min="0"
                      value={v.cost}
                      onChange={(e) => setVariantField(i, 'cost', e.target.value)}
                      placeholder="0.00"
                      className="min-h-10 text-sm w-28 shrink-0"
                    />
                    <div key={`del-${i}`} className="w-7 flex justify-center">
                      {variants.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeVariantRow(i)}
                          className="text-gray-300 hover:text-red-500 transition-colors"
                          aria-label={`Remove type ${i + 1}`}
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  </>
                ))}
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addVariantRow}
              >
                <Plus size={14} className="mr-1" />
                Add another type
              </Button>

              <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={goBack}>Back</Button>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    onClick={() => { setVariants(emptyVariants()); setStep(3) }}
                    className="text-gray-500"
                  >
                    Skip
                  </Button>
                  <Button onClick={goNext} className="bg-amber-600 hover:bg-amber-700">
                    Next
                    <ChevronRight size={16} className="ml-1" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* ── Step 3: Add-ons ──────────────────────────────────────── */}
          {step === 3 && (
            <div className="space-y-3">
              <div className="grid grid-cols-[1fr_auto_auto] gap-x-2 gap-y-2 items-center">
                <span className="text-xs font-medium text-gray-500">Extra name</span>
                <span className="text-xs font-medium text-gray-500 w-28 text-center">Extra charge</span>
                <span className="w-7" />

                {addons.map((a, i) => (
                  <>
                    <Input
                      key={`aname-${i}`}
                      value={a.name}
                      onChange={(e) => setAddonField(i, 'name', e.target.value)}
                      placeholder={i === 0 ? 'e.g. Nuts' : i === 1 ? 'e.g. Coconut' : `Extra ${i + 1}`}
                      className="min-h-10 text-base"
                      autoFocus={i === addons.length - 1 && i > 0}
                    />
                    <Input
                      key={`acost-${i}`}
                      type="number"
                      step="0.01"
                      min="0"
                      value={a.extraCost}
                      onChange={(e) => setAddonField(i, 'extraCost', e.target.value)}
                      placeholder="0.00"
                      className="min-h-10 text-sm w-28 shrink-0"
                    />
                    <div key={`adel-${i}`} className="w-7 flex justify-center">
                      {addons.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeAddonRow(i)}
                          className="text-gray-300 hover:text-red-500 transition-colors"
                          aria-label={`Remove extra ${i + 1}`}
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  </>
                ))}
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addAddonRow}
              >
                <Plus size={14} className="mr-1" />
                Add another extra
              </Button>

              <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={goBack}>Back</Button>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    onClick={() => { setAddons(emptyAddons()); void handleSave() }}
                    className="text-gray-500"
                    disabled={isSubmitting}
                  >
                    Skip & save
                  </Button>
                  <Button
                    onClick={() => void handleSave()}
                    className="bg-amber-600 hover:bg-amber-700"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Saving…' : 'Save product'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
