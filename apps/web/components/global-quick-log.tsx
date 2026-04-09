'use client'

import { useState, useMemo, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useBusinessContext } from '@/providers/business-provider'
import { formatCalendarDateInTimeZone, businessCalendarDateToIsoUtc } from '@/lib/business-time'

// ── Types ──────────────────────────────────────────────────────────────────────

type Tab = 'made' | 'sold' | 'bought' | 'gave'

interface QuickLogEvent { tab?: Tab; productName?: string }
interface Product     { id: string; name: string }
interface Variant     { id: string; name: string }
interface StockItem   { id: string; name: string; purchaseUnitId: string | null; purchaseUnitName: string }
interface UnitOption  { id: string; name: string }
interface BatchOption { id: string; label: string; unitsRemaining: number }

const TABS: { id: Tab; label: string }[] = [
  { id: 'made',   label: 'I made'      },
  { id: 'sold',   label: 'I sold'      },
  { id: 'bought', label: 'I bought'    },
  { id: 'gave',   label: 'I gave away' },
]

// ── Default form states ────────────────────────────────────────────────────────

const D_MADE = {
  productName: '', productId: null as string | null, variantId: null as string | null,
  qty: '', date: '',
  soldSome: false, soldQty: '', soldPrice: '', soldDate: '',
}
const D_SOLD = {
  productName: '', productId: null as string | null, variantId: null as string | null,
  qty: '', price: '', date: '', batchId: null as string | null,
}
const D_BOUGHT = {
  itemName: '', itemId: null as string | null,
  purchaseUnitId: null as string | null, purchaseUnitName: '',
  isNew: false, qty: '', totalCost: '',
}
const D_GAVE = {
  productName: '', productId: null as string | null, variantId: null as string | null,
  qty: '', date: '',
}

// ── Component ──────────────────────────────────────────────────────────────────

export function GlobalQuickLog() {
  const [open, setOpen]           = useState(false)
  const [tab,  setTab]            = useState<Tab>('made')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { businessId, currency, timezone } = useBusinessContext()
  const supabase = useMemo(() => createClient(), [])

  // Loaded data
  const [products,  setProducts]  = useState<Product[]>([])
  const [stockItems, setStockItems] = useState<StockItem[]>([])
  const [allUnits,  setAllUnits]  = useState<UnitOption[]>([])
  const [variants,  setVariants]  = useState<Variant[]>([])
  const [batches,   setBatches]   = useState<BatchOption[]>([])

  // Forms
  const [madeForm,   setMadeForm]   = useState(D_MADE)
  const [soldForm,   setSoldForm]   = useState(D_SOLD)
  const [boughtForm, setBoughtForm] = useState(D_BOUGHT)
  const [gaveForm,   setGaveForm]   = useState(D_GAVE)

  // ── Load shared data when businessId is known ────────────────────────────────
  useEffect(() => {
    if (!businessId) return
    void Promise.all([
      supabase.from('products').select('id, name').eq('business_id', businessId).eq('is_active', true).order('name'),
      supabase.from('items').select('id, name, purchase_unit_id, purchase_unit:units!items_purchase_unit_id_fkey(id, name)').eq('business_id', businessId).order('name'),
      supabase.from('units').select('id, name').order('name'),
    ]).then(([prodRes, itemRes, unitRes]) => {
      setProducts((prodRes.data ?? []) as Product[])
      setStockItems(
        (itemRes.data ?? []).map((i: Record<string, unknown>) => {
          const pu = i.purchase_unit as { id?: string; name?: string } | null
          return {
            id: i.id as string,
            name: i.name as string,
            purchaseUnitId: (i.purchase_unit_id as string | null) ?? null,
            purchaseUnitName: pu?.name ?? '',
          }
        })
      )
      setAllUnits((unitRes.data ?? []) as UnitOption[])
    })
  }, [businessId, supabase])

  // ── Seed default dates when dialog opens ────────────────────────────────────
  useEffect(() => {
    if (!open || !timezone) return
    const today = formatCalendarDateInTimeZone(new Date(), timezone)
    setMadeForm(f => ({ ...f, date: f.date || today, soldDate: f.soldDate || today }))
    setSoldForm(f => ({ ...f, date: f.date || today }))
    setGaveForm(f => ({ ...f, date: f.date || today }))
  }, [open, timezone])

  // ── Clear variant / batch lists when tab changes ─────────────────────────────
  useEffect(() => {
    setVariants([])
    setBatches([])
  }, [tab])

  // ── Context events from product pages ────────────────────────────────────────
  useEffect(() => {
    function handler(e: Event) {
      const detail = ((e as CustomEvent<QuickLogEvent>).detail) ?? {}
      if (detail.tab) setTab(detail.tab)
      if (detail.productName) {
        const name = detail.productName
        setMadeForm(f => ({ ...f, productName: name }))
        setSoldForm(f => ({ ...f, productName: name }))
        setGaveForm(f => ({ ...f, productName: name }))
      }
      setOpen(true)
    }
    window.addEventListener('operbase:quick-log', handler)
    return () => window.removeEventListener('operbase:quick-log', handler)
  }, [])

  function resetForms() {
    setMadeForm(D_MADE)
    setSoldForm(D_SOLD)
    setBoughtForm(D_BOUGHT)
    setGaveForm(D_GAVE)
    setVariants([])
    setBatches([])
  }

  // ── Variant loading ──────────────────────────────────────────────────────────
  async function loadVariants(productId: string) {
    if (!businessId) return
    const { data } = await supabase
      .from('product_variants')
      .select('id, name')
      .eq('product_id', productId)
      .eq('business_id', businessId)
      .order('sort_order')
    setVariants((data ?? []) as Variant[])
  }

  // ── Batch loading (for "I sold") ─────────────────────────────────────────────
  async function loadBatches(productId: string, variantId: string | null) {
    if (!businessId) return
    let q = supabase
      .from('batches')
      .select('id, notes, units_remaining, produced_at')
      .eq('business_id', businessId)
      .eq('product_id', productId)
      .gt('units_remaining', 0)
      .order('produced_at', { ascending: false })
    if (variantId) q = q.eq('variant_id', variantId)
    const { data } = await q
    setBatches(
      (data ?? []).map((b: Record<string, unknown>) => {
        const d = new Date(b.produced_at as string)
        const dateStr = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
        return {
          id: b.id as string,
          label: `${b.notes} · ${b.units_remaining} left (${dateStr})`,
          unitsRemaining: Number(b.units_remaining),
        }
      })
    )
  }

  // ── Product selection (shared across made / sold / gave) ─────────────────────
  async function selectProduct(
    name: string,
    id: string | undefined,
    formType: 'made' | 'sold' | 'gave'
  ) {
    const productId = id ?? products.find(p => p.name.toLowerCase() === name.toLowerCase())?.id ?? null
    if (formType === 'made') setMadeForm(f => ({ ...f, productName: name, productId, variantId: null }))
    else if (formType === 'sold') setSoldForm(f => ({ ...f, productName: name, productId, variantId: null, batchId: null }))
    else setGaveForm(f => ({ ...f, productName: name, productId, variantId: null }))
    setVariants([])
    setBatches([])
    if (productId) {
      await loadVariants(productId)
      if (formType === 'sold') await loadBatches(productId, null)
    }
  }

  // ── Variant selection ─────────────────────────────────────────────────────────
  async function selectVariant(variantId: string, formType: 'made' | 'sold' | 'gave') {
    if (formType === 'made') setMadeForm(f => ({ ...f, variantId }))
    else if (formType === 'sold') {
      setSoldForm(f => ({ ...f, variantId, batchId: null }))
      if (soldForm.productId) await loadBatches(soldForm.productId, variantId)
    }
    else setGaveForm(f => ({ ...f, variantId }))
  }

  // ── Stock item selection ("I bought") ────────────────────────────────────────
  function selectStockItem(item: StockItem) {
    setBoughtForm(f => ({
      ...f,
      itemName: item.name,
      itemId: item.id,
      purchaseUnitId: item.purchaseUnitId,
      purchaseUnitName: item.purchaseUnitName,
      isNew: false,
    }))
  }

  function handleItemNameChange(name: string) {
    const match = stockItems.find(i => i.name.toLowerCase() === name.toLowerCase())
    if (match) {
      setBoughtForm(f => ({
        ...f, itemName: name, itemId: match.id,
        purchaseUnitId: match.purchaseUnitId, purchaseUnitName: match.purchaseUnitName, isNew: false,
      }))
    } else {
      setBoughtForm(f => ({
        ...f, itemName: name, itemId: null,
        purchaseUnitId: null, purchaseUnitName: '', isNew: name.trim().length > 0,
      }))
    }
  }

  // ── Save: I made ──────────────────────────────────────────────────────────────
  async function handleMadeSave() {
    if (!businessId) return
    const name = madeForm.productName.trim()
    if (!name)       { toast.error('Enter what you made'); return }
    const qty = parseFloat(madeForm.qty)
    if (!qty || qty <= 0) { toast.error('Enter how many you made'); return }
    if (!madeForm.date)   { toast.error('Select a date'); return }

    let soldQty = 0, soldPrice = 0
    if (madeForm.soldSome) {
      soldQty   = parseFloat(madeForm.soldQty)
      soldPrice = parseFloat(madeForm.soldPrice)
      if (!soldQty || soldQty <= 0)   { toast.error('Enter how many you sold'); return }
      if (soldQty > qty)               { toast.error('Cannot sell more than you made'); return }
      if (!soldPrice || soldPrice <= 0) { toast.error('Enter the sale price'); return }
      if (!madeForm.soldDate)           { toast.error('Select a sale date'); return }
    }

    setIsSubmitting(true)
    try {
      let productId = madeForm.productId
      if (!productId) {
        const { data, error } = await supabase.rpc('ensure_product', { p_business_id: businessId, p_name: name })
        if (error) throw error
        productId = data as string
      }

      const { data: batchId, error: bErr } = await supabase.rpc('create_production_batch', {
        p_business_id:        businessId,
        p_product_id:         productId,
        p_display_name:       name,
        p_units_produced:     qty,
        p_produced_at:        businessCalendarDateToIsoUtc(madeForm.date, timezone),
        p_extra_notes:        null,
        p_lines:              [],
        p_units_not_for_sale: 0,
        p_variant_id:         madeForm.variantId ?? null,
      })
      if (bErr) throw bErr

      if (soldQty > 0) {
        const { error: sErr } = await supabase.rpc('record_sale_with_batch', {
          p_business_id:       businessId,
          p_product_id:        productId,
          p_product_name:      name,
          p_units_sold:        soldQty,
          p_unit_price:        soldPrice,
          p_sold_at:           businessCalendarDateToIsoUtc(madeForm.soldDate, timezone),
          p_customer_id:       null,
          p_batch_id:          batchId as string,
          p_cogs_if_no_batch:  null,
          p_variant_id:        madeForm.variantId ?? null,
        })
        if (sErr) throw sErr
        const remaining = qty - soldQty
        toast.success(
          remaining > 0
            ? `Saved. Made ${qty}, sold ${soldQty}. ${remaining} still to sell.`
            : `Saved. Made ${qty} and sold all of them.`
        )
      } else {
        toast.success(`Saved. ${qty} ${name} recorded.`)
      }

      resetForms()
      setOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── Save: I sold ──────────────────────────────────────────────────────────────
  async function handleSoldSave() {
    if (!businessId) return
    const name = soldForm.productName.trim()
    if (!name)         { toast.error('Enter what you sold'); return }
    const qty = parseFloat(soldForm.qty)
    if (!qty || qty <= 0)    { toast.error('Enter how many'); return }
    const price = parseFloat(soldForm.price)
    if (!price || price <= 0) { toast.error('Enter the price'); return }
    if (!soldForm.date)        { toast.error('Select a date'); return }

    setIsSubmitting(true)
    try {
      let productId = soldForm.productId
      if (!productId) {
        const { data, error } = await supabase.rpc('ensure_product', { p_business_id: businessId, p_name: name })
        if (error) throw error
        productId = data as string
      }

      const { error } = await supabase.rpc('record_sale_with_batch', {
        p_business_id:      businessId,
        p_product_id:       productId,
        p_product_name:     name,
        p_units_sold:       qty,
        p_unit_price:       price,
        p_sold_at:          businessCalendarDateToIsoUtc(soldForm.date, timezone),
        p_customer_id:      null,
        p_batch_id:         soldForm.batchId ?? null,
        p_cogs_if_no_batch: null,
        p_variant_id:       soldForm.variantId ?? null,
      })
      if (error) throw error
      toast.success(`Saved. ${qty} \u00d7 ${name} at ${currency}${price}.`)
      resetForms()
      setOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── Save: I bought ────────────────────────────────────────────────────────────
  async function handleBoughtSave() {
    if (!businessId) return
    const name = boughtForm.itemName.trim()
    if (!name) { toast.error('Enter what you bought'); return }
    const qty = parseFloat(boughtForm.qty)
    if (!qty || qty <= 0) { toast.error('Enter how much you bought'); return }
    if (boughtForm.isNew && !boughtForm.purchaseUnitId) { toast.error('Select a unit'); return }
    const totalCost = parseFloat(boughtForm.totalCost) || 0

    setIsSubmitting(true)
    try {
      let itemId = boughtForm.itemId

      if (!itemId) {
        // New ingredient: create the item first
        const { data: newItem, error: insertErr } = await supabase
          .from('items')
          .insert({
            business_id:       businessId,
            name,
            type:              'ingredient',
            purchase_unit_id:  boughtForm.purchaseUnitId,
            usage_unit_id:     boughtForm.purchaseUnitId,
            conversion_ratio:  1,
            cost_per_unit:     qty > 0 && totalCost > 0 ? totalCost / qty : 0,
          })
          .select('id')
          .single()
        if (insertErr) throw insertErr
        itemId = (newItem as { id: string }).id
      }

      const { error } = await supabase.rpc('add_purchase_lot', {
        p_business_id:      businessId,
        p_item_id:          itemId,
        p_purchase_qty:     qty,
        p_total_cost_paid:  totalCost,
        p_note:             'Quick add',
      })
      if (error) throw error

      const unitLabel = boughtForm.purchaseUnitName ? ` ${boughtForm.purchaseUnitName}` : ''
      toast.success(`Added ${qty}${unitLabel} of ${name} to stock.`)
      resetForms()
      setOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── Save: I gave away ─────────────────────────────────────────────────────────
  async function handleGaveSave() {
    if (!businessId) return
    const name = gaveForm.productName.trim()
    if (!name)       { toast.error('Enter what you gave away'); return }
    const qty = parseFloat(gaveForm.qty)
    if (!qty || qty <= 0) { toast.error('Enter how many'); return }
    if (!gaveForm.date)   { toast.error('Select a date'); return }

    setIsSubmitting(true)
    try {
      let productId = gaveForm.productId
      if (!productId) {
        const { data, error } = await supabase.rpc('ensure_product', { p_business_id: businessId, p_name: name })
        if (error) throw error
        productId = data as string
      }

      const { data: batchId, error: bErr } = await supabase.rpc('create_production_batch', {
        p_business_id:        businessId,
        p_product_id:         productId,
        p_display_name:       name,
        p_units_produced:     qty,
        p_produced_at:        businessCalendarDateToIsoUtc(gaveForm.date, timezone),
        p_extra_notes:        'Given away',
        p_lines:              [],
        p_units_not_for_sale: 0,
        p_variant_id:         gaveForm.variantId ?? null,
      })
      if (bErr) throw bErr

      const { error: dErr } = await supabase.rpc('dispose_batch_units', {
        p_batch_id: batchId as string,
        p_quantity: qty,
        p_kind:     'given_out',
      })
      if (dErr) throw dErr

      toast.success(`Saved. ${qty} ${name} marked as given away.`)
      resetForms()
      setOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── Shared UI helpers ─────────────────────────────────────────────────────────

  function activeChipStyle(active: boolean): React.CSSProperties {
    return active
      ? { backgroundColor: 'var(--brand)', color: 'white', borderColor: 'var(--brand)' }
      : { borderColor: '#e5e7eb', color: '#374151', backgroundColor: 'white' }
  }

  function tabStyle(active: boolean): React.CSSProperties {
    return active
      ? { backgroundColor: 'var(--brand)', color: 'white', borderColor: 'var(--brand)' }
      : { backgroundColor: 'white', borderColor: 'var(--brand-mid)', color: 'var(--brand-dark)' }
  }

  function ProductChips({ active, onSelect }: { active: string; onSelect: (p: Product) => void }) {
    if (products.length === 0) return null
    return (
      <div className="flex flex-wrap gap-1.5">
        {products.slice(0, 8).map(p => (
          <button key={p.id} type="button" onClick={() => onSelect(p)}
            className="px-2.5 py-1 rounded-lg text-sm border transition-colors"
            style={activeChipStyle(active === p.name)}>
            {p.name}
          </button>
        ))}
      </div>
    )
  }

  function VariantRow({ activeId, onSelect }: { activeId: string | null; onSelect: (id: string) => void }) {
    if (variants.length === 0) return null
    return (
      <div>
        <p className="text-xs font-medium text-gray-500 mb-1.5">Variant</p>
        <div className="flex flex-wrap gap-1.5">
          {variants.map(v => (
            <button key={v.id} type="button" onClick={() => onSelect(v.id)}
              className="px-2.5 py-1 rounded-lg text-sm border transition-colors"
              style={activeChipStyle(activeId === v.id)}>
              {v.name}
            </button>
          ))}
        </div>
      </div>
    )
  }

  function DateField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
    return (
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
        <Input type="date" value={value} onChange={e => onChange(e.target.value)} className="min-h-11" />
      </div>
    )
  }

  function SaveButton({ onClick }: { onClick: () => void }) {
    return (
      <Button onClick={onClick} disabled={isSubmitting}
        className="w-full min-h-11 text-white hover:opacity-90"
        style={{ backgroundColor: 'var(--brand)' }}>
        {isSubmitting && <Loader2 size={16} className="animate-spin mr-2" />}
        Save
      </Button>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="fixed bottom-6 right-6 z-50">
      <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) resetForms() }}>
        <DialogTrigger asChild>
          <button
            type="button"
            className="h-14 w-14 rounded-full shadow-xl flex items-center justify-center text-white transition-transform hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            style={{ backgroundColor: 'var(--brand)' }}
            aria-label="Log activity"
          >
            <Plus size={26} />
          </button>
        </DialogTrigger>

        <DialogContent className="sm:max-w-sm p-0 max-h-[90vh] overflow-y-auto">
          {/* Branded header */}
          <div className="px-5 pt-5 pb-4 sticky top-0 z-10"
            style={{ backgroundColor: 'var(--brand-light)', borderBottom: '1px solid var(--brand-mid)' }}>
            <DialogHeader>
              <DialogTitle className="text-base font-semibold" style={{ color: 'var(--brand-dark)' }}>
                What do you want to log?
              </DialogTitle>
            </DialogHeader>
            <div className="flex flex-wrap gap-1.5 mt-3">
              {TABS.map(t => (
                <button key={t.id} type="button" onClick={() => setTab(t.id)}
                  className="px-3 py-1.5 rounded-full text-sm font-medium border transition-colors"
                  style={tabStyle(tab === t.id)}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="px-5 py-4 space-y-3">

            {/* ── I made ──────────────────────────────────────────────────────── */}
            {tab === 'made' && (
              <>
                <ProductChips
                  active={madeForm.productName}
                  onSelect={p => void selectProduct(p.name, p.id, 'made')}
                />
                <Input
                  placeholder="Product name"
                  value={madeForm.productName}
                  onChange={e => {
                    const name = e.target.value
                    const match = products.find(p => p.name.toLowerCase() === name.toLowerCase())
                    if (match && madeForm.productId !== match.id) {
                      void selectProduct(match.name, match.id, 'made')
                    } else if (!match) {
                      setMadeForm(f => ({ ...f, productName: name, productId: null, variantId: null }))
                      setVariants([])
                    } else {
                      setMadeForm(f => ({ ...f, productName: name }))
                    }
                  }}
                  className="min-h-11"
                />
                <VariantRow
                  activeId={madeForm.variantId}
                  onSelect={id => void selectVariant(id, 'made')}
                />
                <Input
                  type="number" inputMode="decimal"
                  placeholder="How many did you make?"
                  value={madeForm.qty}
                  onChange={e => setMadeForm(f => ({ ...f, qty: e.target.value }))}
                  className="min-h-11"
                />
                <DateField
                  label="When did you make this?"
                  value={madeForm.date}
                  onChange={v => setMadeForm(f => ({ ...f, date: v }))}
                />

                <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-gray-700 py-0.5">
                  <input type="checkbox" checked={madeForm.soldSome}
                    onChange={e => setMadeForm(f => ({ ...f, soldSome: e.target.checked }))}
                    className="rounded border-gray-300 accent-[var(--brand)]"
                  />
                  Some were sold right away
                </label>

                {madeForm.soldSome && (
                  <>
                    <Input
                      type="number" inputMode="decimal"
                      placeholder="How many did you sell?"
                      value={madeForm.soldQty}
                      onChange={e => setMadeForm(f => ({ ...f, soldQty: e.target.value }))}
                      className="min-h-11"
                    />
                    <Input
                      type="number" inputMode="decimal"
                      placeholder={`Price each (${currency})`}
                      value={madeForm.soldPrice}
                      onChange={e => setMadeForm(f => ({ ...f, soldPrice: e.target.value }))}
                      className="min-h-11"
                    />
                    <DateField
                      label="When were they sold?"
                      value={madeForm.soldDate}
                      onChange={v => setMadeForm(f => ({ ...f, soldDate: v }))}
                    />
                  </>
                )}

                <SaveButton onClick={() => void handleMadeSave()} />
              </>
            )}

            {/* ── I sold ──────────────────────────────────────────────────────── */}
            {tab === 'sold' && (
              <>
                <ProductChips
                  active={soldForm.productName}
                  onSelect={p => void selectProduct(p.name, p.id, 'sold')}
                />
                <Input
                  placeholder="Product name"
                  value={soldForm.productName}
                  onChange={e => {
                    const name = e.target.value
                    const match = products.find(p => p.name.toLowerCase() === name.toLowerCase())
                    if (match && soldForm.productId !== match.id) {
                      void selectProduct(match.name, match.id, 'sold')
                    } else if (!match) {
                      setSoldForm(f => ({ ...f, productName: name, productId: null, variantId: null, batchId: null }))
                      setVariants([])
                      setBatches([])
                    } else {
                      setSoldForm(f => ({ ...f, productName: name }))
                    }
                  }}
                  className="min-h-11"
                />
                <VariantRow
                  activeId={soldForm.variantId}
                  onSelect={id => void selectVariant(id, 'sold')}
                />
                <Input
                  type="number" inputMode="decimal"
                  placeholder="How many?"
                  value={soldForm.qty}
                  onChange={e => setSoldForm(f => ({ ...f, qty: e.target.value }))}
                  className="min-h-11"
                />
                <Input
                  type="number" inputMode="decimal"
                  placeholder={`Price each (${currency})`}
                  value={soldForm.price}
                  onChange={e => setSoldForm(f => ({ ...f, price: e.target.value }))}
                  className="min-h-11"
                />
                <DateField
                  label="When was this sold?"
                  value={soldForm.date}
                  onChange={v => setSoldForm(f => ({ ...f, date: v }))}
                />

                {batches.length > 0 && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      From which batch? <span className="font-normal text-gray-400">(optional)</span>
                    </label>
                    <select
                      value={soldForm.batchId ?? ''}
                      onChange={e => setSoldForm(f => ({ ...f, batchId: e.target.value || null }))}
                      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm min-h-11 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                    >
                      <option value="">No specific batch (auto-assign)</option>
                      {batches.map(b => (
                        <option key={b.id} value={b.id}>{b.label}</option>
                      ))}
                    </select>
                  </div>
                )}

                <SaveButton onClick={() => void handleSoldSave()} />
              </>
            )}

            {/* ── I bought ────────────────────────────────────────────────────── */}
            {tab === 'bought' && (
              <>
                {stockItems.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {stockItems.slice(0, 6).map(item => (
                      <button key={item.id} type="button" onClick={() => selectStockItem(item)}
                        className="px-2.5 py-1 rounded-lg text-sm border transition-colors"
                        style={activeChipStyle(boughtForm.itemId === item.id)}>
                        {item.name}
                      </button>
                    ))}
                  </div>
                )}

                <Input
                  placeholder="What did you buy? (e.g. Flour)"
                  value={boughtForm.itemName}
                  onChange={e => handleItemNameChange(e.target.value)}
                  className="min-h-11"
                />

                {/* Existing item: show resolved unit (read-only) */}
                {!boughtForm.isNew && boughtForm.purchaseUnitName && (
                  <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
                    Buying in: <span className="font-semibold text-gray-700">{boughtForm.purchaseUnitName}</span>
                  </p>
                )}

                {/* New item: unit picker */}
                {boughtForm.isNew && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      What unit are you buying in?
                    </label>
                    <select
                      value={boughtForm.purchaseUnitId ?? ''}
                      onChange={e => {
                        const unit = allUnits.find(u => u.id === e.target.value)
                        setBoughtForm(f => ({
                          ...f,
                          purchaseUnitId: e.target.value || null,
                          purchaseUnitName: unit?.name ?? '',
                        }))
                      }}
                      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm min-h-11 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                    >
                      <option value="">Select unit…</option>
                      {allUnits.map(u => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <Input
                  type="number" inputMode="decimal"
                  placeholder={boughtForm.purchaseUnitName
                    ? `Quantity (${boughtForm.purchaseUnitName})`
                    : 'Quantity bought'}
                  value={boughtForm.qty}
                  onChange={e => setBoughtForm(f => ({ ...f, qty: e.target.value }))}
                  className="min-h-11"
                />
                <Input
                  type="number" inputMode="decimal"
                  placeholder={`What did you pay in total? (${currency})`}
                  value={boughtForm.totalCost}
                  onChange={e => setBoughtForm(f => ({ ...f, totalCost: e.target.value }))}
                  className="min-h-11"
                />

                {boughtForm.isNew && (
                  <p className="text-xs text-gray-500">
                    New ingredient — you can set up conversion ratios on the Stock page later.
                  </p>
                )}

                <SaveButton onClick={() => void handleBoughtSave()} />
              </>
            )}

            {/* ── I gave away ──────────────────────────────────────────────────── */}
            {tab === 'gave' && (
              <>
                <ProductChips
                  active={gaveForm.productName}
                  onSelect={p => void selectProduct(p.name, p.id, 'gave')}
                />
                <Input
                  placeholder="Product name"
                  value={gaveForm.productName}
                  onChange={e => {
                    const name = e.target.value
                    const match = products.find(p => p.name.toLowerCase() === name.toLowerCase())
                    if (match && gaveForm.productId !== match.id) {
                      void selectProduct(match.name, match.id, 'gave')
                    } else if (!match) {
                      setGaveForm(f => ({ ...f, productName: name, productId: null, variantId: null }))
                      setVariants([])
                    } else {
                      setGaveForm(f => ({ ...f, productName: name }))
                    }
                  }}
                  className="min-h-11"
                />
                <VariantRow
                  activeId={gaveForm.variantId}
                  onSelect={id => void selectVariant(id, 'gave')}
                />
                <Input
                  type="number" inputMode="decimal"
                  placeholder="How many?"
                  value={gaveForm.qty}
                  onChange={e => setGaveForm(f => ({ ...f, qty: e.target.value }))}
                  className="min-h-11"
                />
                <DateField
                  label="When was this?"
                  value={gaveForm.date}
                  onChange={v => setGaveForm(f => ({ ...f, date: v }))}
                />
                <p className="text-xs text-gray-500">
                  Samples, gifts, or tasting pieces. These will not count as sold.
                </p>
                <SaveButton onClick={() => void handleGaveSave()} />
              </>
            )}

          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
