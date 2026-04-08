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
import { friendlyError } from '@/lib/errors'
import type { ProductCatalogRow } from '@/lib/dashboard/products-data'

type WizardStep = 1 | 2 | 3

type AddonDraft = { name: string; extraCost: string }

function emptyVariants(): string[] {
  return ['']
}

function emptyAddons(): AddonDraft[] {
  return [{ name: '', extraCost: '' }]
}

export function ProductsPageClient({
  initialProducts,
}: {
  initialProducts: ProductCatalogRow[]
}) {
  const { businessId } = useBusinessContext()
  const [products, setProducts] = useState<ProductCatalogRow[]>(initialProducts)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [step, setStep] = useState<WizardStep>(1)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Step-1 state
  const [productName, setProductName] = useState('')

  // Step-2 state: variant name strings
  const [variants, setVariants] = useState<string[]>(emptyVariants())

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
        ? product.variants.map((v) => v.name)
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
    setVariants((v) => [...v, ''])
  }

  function removeVariantRow(i: number) {
    setVariants((v) => v.filter((_, idx) => idx !== i))
  }

  function setVariantName(i: number, val: string) {
    setVariants((v) => v.map((x, idx) => (idx === i ? val : x)))
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
      .map((v) => v.trim())
      .filter((v) => v.length > 0)

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
        // Update name if changed
        const { error: updErr } = await supabase
          .from('products')
          .update({ name: nameTrim })
          .eq('id', editingId)
          .eq('business_id', businessId)
        if (updErr) throw updErr
        productId = editingId

        // Replace variants and addons entirely
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

      // Insert variants
      if (validVariants.length > 0) {
        const { error: vErr } = await supabase.from('product_variants').insert(
          validVariants.map((name, i) => ({
            product_id: productId,
            business_id: businessId,
            name,
            sort_order: i,
          }))
        )
        if (vErr) throw vErr
      }

      // Insert addons
      if (validAddons.length > 0) {
        const { error: aErr } = await supabase.from('product_addons').insert(
          validAddons.map((a, i) => ({
            product_id: productId,
            business_id: businessId,
            name: a.name,
            extra_cost: a.extra_cost,
            sort_order: i,
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
    if (!confirm('Delete this product? All its variants and add-ons will also be removed.')) return
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
        product_variants(id, name, sort_order),
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
        variants: ((p.product_variants as { id: string; name: string; sort_order: number }[] | null) ?? [])
          .slice()
          .sort((a, b) => a.sort_order - b.sort_order),
        addons: ((p.product_addons as { id: string; name: string; extra_cost: number | null; sort_order: number }[] | null) ?? [])
          .slice()
          .sort((a, b) => a.sort_order - b.sort_order),
      }))
    )
  }

  // ─── render ────────────────────────────────────────────────────────────────

  const stepLabel = step === 1 ? 'What do you sell?' : step === 2 ? 'Any types or variants?' : 'Any extras customers can add?'
  const stepHint =
    step === 1
      ? 'Give it a name your whole team will recognise.'
      : step === 2
        ? 'E.g. "Oat", "Double Chocolate", "Large". Skip if it only comes one way.'
        : 'E.g. "Nuts", "Coconut", "Extra sauce". Skip if there are none.'

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Products</h1>
          <p className="text-sm text-gray-500 mt-1">Your catalog — variants and extras included.</p>
        </div>
        <Button
          onClick={openCreate}
          className="bg-amber-600 hover:bg-amber-700 shrink-0"
        >
          <Plus size={16} className="mr-2" />
          Add product
        </Button>
      </div>

      {/* ── Product list ─────────────────────────────────────────────── */}
      {products.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p className="text-lg font-medium">No products yet.</p>
          <p className="text-sm mt-1">Add your first product to get started.</p>
          <Button onClick={openCreate} className="mt-4 bg-amber-600 hover:bg-amber-700">
            <Plus size={16} className="mr-2" />
            Add product
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
                      <span className="text-xs text-gray-500 self-center">Types:</span>
                      {product.variants.map((v) => (
                        <Badge key={v.id} variant="secondary" className="text-xs">
                          {v.name}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {product.addons.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      <span className="text-xs text-gray-500 self-center">Extras:</span>
                      {product.addons.map((a) => (
                        <Badge
                          key={a.id}
                          variant="outline"
                          className="text-xs border-amber-300 text-amber-800 bg-amber-50"
                        >
                          {a.name}
                          {a.extra_cost != null && a.extra_cost > 0
                            ? ` +${a.extra_cost}`
                            : ''}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {product.variants.length === 0 && product.addons.length === 0 && (
                    <p className="text-xs text-gray-400 mt-1">No variants or extras</p>
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
          <div className="flex items-center gap-2 text-sm text-gray-500">
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
            <span className="ml-1 font-medium text-gray-700">{stepLabel}</span>
          </div>

          <p className="text-sm text-gray-500 -mt-1">{stepHint}</p>

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

          {/* ── Step 2: Variants ─────────────────────────────────────── */}
          {step === 2 && (
            <div className="space-y-3">
              <div className="space-y-2">
                {variants.map((v, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <Input
                      value={v}
                      onChange={(e) => setVariantName(i, e.target.value)}
                      placeholder={`Variant ${i + 1} — e.g. "Oat"`}
                      className="min-h-10 text-base flex-1"
                      autoFocus={i === variants.length - 1 && i > 0}
                    />
                    {variants.length > 1 && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="text-gray-400 hover:text-red-600 shrink-0"
                        onClick={() => removeVariantRow(i)}
                      >
                        <X size={14} />
                      </Button>
                    )}
                  </div>
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
              <div className="space-y-2">
                {addons.map((a, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <Input
                      value={a.name}
                      onChange={(e) => setAddonField(i, 'name', e.target.value)}
                      placeholder={`Extra ${i + 1} — e.g. "Nuts"`}
                      className="min-h-10 text-base flex-1"
                      autoFocus={i === addons.length - 1 && i > 0}
                    />
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={a.extraCost}
                      onChange={(e) => setAddonField(i, 'extraCost', e.target.value)}
                      placeholder="Extra cost?"
                      className="min-h-10 text-sm w-28 shrink-0"
                    />
                    {addons.length > 1 && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="text-gray-400 hover:text-red-600 shrink-0"
                        onClick={() => removeAddonRow(i)}
                      >
                        <X size={14} />
                      </Button>
                    )}
                  </div>
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
                    onClick={() => { setAddons(emptyAddons()); handleSave() }}
                    className="text-gray-500"
                    disabled={isSubmitting}
                  >
                    Skip & save
                  </Button>
                  <Button
                    onClick={handleSave}
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
