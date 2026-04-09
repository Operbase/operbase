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
import { COMMON_BAKES } from '@/lib/bakery/simple-presets'
import { formatCalendarDateInTimeZone, businessCalendarDateToIsoUtc } from '@/lib/business-time'

type Tab = 'made' | 'sold' | 'bought' | 'gave'

interface QuickLogEvent {
  tab?: Tab
  productName?: string
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'made', label: 'I made' },
  { id: 'sold', label: 'I sold' },
  { id: 'bought', label: 'I bought' },
  { id: 'gave', label: 'I gave away' },
]

export function GlobalQuickLog() {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<Tab>('made')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { businessId, currency, timezone } = useBusinessContext()
  const supabase = useMemo(() => createClient(), [])

  // Real products loaded from DB; fall back to preset bake names if none yet
  const [productChips, setProductChips] = useState<string[]>([])

  // "I made" form — optionally log a same-session sale
  const [prodForm, setProdForm] = useState({
    productName: '',
    qty: '',
    soldSome: false,
    soldQty: '',
    soldPrice: '',
  })

  // "I sold" form
  const [saleForm, setSaleForm] = useState({ productName: '', qty: '', price: '' })

  // "I bought" form
  const [stockForm, setStockForm] = useState({ itemName: '', qty: '', cost: '' })

  // "I gave away" form
  const [gaveForm, setGaveForm] = useState({ productName: '', qty: '' })

  // ── Load product names ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!businessId) return
    supabase
      .from('products')
      .select('name')
      .eq('business_id', businessId)
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => {
        const names = (data ?? []).map((p: { name: string }) => p.name)
        setProductChips(names.length > 0 ? names.slice(0, 8) : (COMMON_BAKES.slice(0, 6) as unknown as string[]))
      })
  }, [businessId, supabase])

  // ── Context-aware trigger ──────────────────────────────────────────────────
  // Any page can call:
  //   window.dispatchEvent(new CustomEvent('operbase:quick-log', { detail: { tab: 'made', productName: 'Sourdough' } }))
  useEffect(() => {
    function handler(e: Event) {
      const detail = ((e as CustomEvent<QuickLogEvent>).detail) ?? {}
      if (detail.tab) setTab(detail.tab)
      if (detail.productName) {
        const name = detail.productName
        setProdForm((f) => ({ ...f, productName: name }))
        setSaleForm((f) => ({ ...f, productName: name }))
        setGaveForm((f) => ({ ...f, productName: name }))
      }
      setOpen(true)
    }
    window.addEventListener('operbase:quick-log', handler)
    return () => window.removeEventListener('operbase:quick-log', handler)
  }, [])

  function resetForms() {
    setProdForm({ productName: '', qty: '', soldSome: false, soldQty: '', soldPrice: '' })
    setSaleForm({ productName: '', qty: '', price: '' })
    setStockForm({ itemName: '', qty: '', cost: '' })
    setGaveForm({ productName: '', qty: '' })
  }

  // ── "I made" ───────────────────────────────────────────────────────────────
  async function handleMadeSave() {
    if (!businessId) return
    const name = prodForm.productName.trim()
    if (!name) { toast.error('Enter what you made'); return }
    const qty = parseFloat(prodForm.qty)
    if (!qty || qty <= 0) { toast.error('Enter how many you made'); return }

    let soldQty = 0
    let soldPrice = 0
    if (prodForm.soldSome) {
      soldQty = parseFloat(prodForm.soldQty)
      soldPrice = parseFloat(prodForm.soldPrice)
      if (!soldQty || soldQty <= 0) { toast.error('Enter how many you sold'); return }
      if (soldQty > qty) { toast.error('Cannot sell more than you made'); return }
      if (!soldPrice || soldPrice <= 0) { toast.error('Enter the sale price'); return }
    }

    setIsSubmitting(true)
    try {
      const { data: productId, error: pErr } = await supabase.rpc('ensure_product', {
        p_business_id: businessId,
        p_name: name,
      })
      if (pErr) throw pErr

      const { data: batchId, error: bErr } = await supabase.rpc('create_production_batch', {
        p_business_id: businessId,
        p_product_id: productId as string,
        p_display_name: name,
        p_units_produced: qty,
        p_produced_at: new Date().toISOString(),
        p_extra_notes: null,
        p_lines: [],
        p_units_not_for_sale: 0,
      })
      if (bErr) throw bErr

      if (soldQty > 0) {
        const { error: sErr } = await supabase.rpc('record_sale_with_batch', {
          p_business_id: businessId,
          p_product_id: productId as string,
          p_product_name: name,
          p_units_sold: soldQty,
          p_unit_price: soldPrice,
          p_sold_at: businessCalendarDateToIsoUtc(
            formatCalendarDateInTimeZone(new Date(), timezone),
            timezone
          ),
          p_customer_id: null,
          p_batch_id: batchId as string,
          p_cogs_if_no_batch: null,
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

  // ── "I sold" ───────────────────────────────────────────────────────────────
  async function handleSoldSave() {
    if (!businessId) return
    const name = saleForm.productName.trim()
    if (!name) { toast.error('Enter what you sold'); return }
    const qty = parseFloat(saleForm.qty)
    if (!qty || qty <= 0) { toast.error('Enter how many'); return }
    const price = parseFloat(saleForm.price)
    if (!price || price <= 0) { toast.error('Enter the price'); return }

    setIsSubmitting(true)
    try {
      const { data: productId, error: pErr } = await supabase.rpc('ensure_product', {
        p_business_id: businessId,
        p_name: name,
      })
      if (pErr) throw pErr
      const { error } = await supabase.rpc('record_sale_with_batch', {
        p_business_id: businessId,
        p_product_id: productId as string,
        p_product_name: name,
        p_units_sold: qty,
        p_unit_price: price,
        p_sold_at: businessCalendarDateToIsoUtc(
          formatCalendarDateInTimeZone(new Date(), timezone),
          timezone
        ),
        p_customer_id: null,
        p_batch_id: null,
        p_cogs_if_no_batch: null,
      })
      if (error) throw error
      toast.success(`Saved. ${qty} x ${name} at ${currency}${price}.`)
      resetForms()
      setOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── "I bought" ─────────────────────────────────────────────────────────────
  async function handleBoughtSave() {
    if (!businessId) return
    const name = stockForm.itemName.trim()
    if (!name) { toast.error('Enter what you bought'); return }
    const qty = parseFloat(stockForm.qty)
    if (!qty || qty <= 0) { toast.error('Enter how much'); return }
    const cost = parseFloat(stockForm.cost) || 0

    setIsSubmitting(true)
    try {
      const { data: existingItems } = await supabase
        .from('items')
        .select('id')
        .eq('business_id', businessId)
        .ilike('name', name)
        .limit(1)

      let itemId: string
      if (existingItems && existingItems.length > 0) {
        itemId = (existingItems[0] as { id: string }).id
      } else {
        const { data: newItem, error: insertErr } = await supabase
          .from('items')
          .insert({
            business_id: businessId,
            name,
            type: 'ingredient',
            unit_id: null,
            purchase_unit_id: null,
            usage_unit_id: null,
            conversion_ratio: 1,
            cost_per_unit: cost,
          })
          .select('id')
          .single()
        if (insertErr) throw insertErr
        itemId = (newItem as { id: string }).id
      }

      const { error } = await supabase.rpc('add_purchase_lot', {
        p_business_id: businessId,
        p_item_id: itemId,
        p_purchase_qty: qty,
        p_total_cost_paid: cost * qty,
        p_note: 'Quick add',
      })
      if (error) throw error
      toast.success(`Added ${qty} ${name} to stock.`)
      resetForms()
      setOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── "I gave away" ──────────────────────────────────────────────────────────
  // Creates a production batch and immediately disposes all units as given_out.
  async function handleGaveSave() {
    if (!businessId) return
    const name = gaveForm.productName.trim()
    if (!name) { toast.error('Enter what you gave away'); return }
    const qty = parseFloat(gaveForm.qty)
    if (!qty || qty <= 0) { toast.error('Enter how many'); return }

    setIsSubmitting(true)
    try {
      const { data: productId, error: pErr } = await supabase.rpc('ensure_product', {
        p_business_id: businessId,
        p_name: name,
      })
      if (pErr) throw pErr

      const { data: batchId, error: bErr } = await supabase.rpc('create_production_batch', {
        p_business_id: businessId,
        p_product_id: productId as string,
        p_display_name: name,
        p_units_produced: qty,
        p_produced_at: new Date().toISOString(),
        p_extra_notes: 'Given away',
        p_lines: [],
        p_units_not_for_sale: 0,
      })
      if (bErr) throw bErr

      const { error: dErr } = await supabase.rpc('dispose_batch_units', {
        p_batch_id: batchId as string,
        p_quantity: qty,
        p_kind: 'given_out',
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

  // ── Helpers ────────────────────────────────────────────────────────────────
  function chipStyle(active: boolean) {
    return active
      ? { backgroundColor: 'var(--brand)', color: 'white', borderColor: 'var(--brand)' }
      : { borderColor: '#e5e7eb', color: '#374151', backgroundColor: 'white' }
  }

  function Chips({ active, onSelect }: { active: string; onSelect: (name: string) => void }) {
    return (
      <div className="flex flex-wrap gap-1.5">
        {productChips.map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => onSelect(name)}
            className="px-2.5 py-1 rounded-lg text-sm border transition-colors"
            style={chipStyle(active === name)}
          >
            {name}
          </button>
        ))}
      </div>
    )
  }

  function SaveButton({ onClick }: { onClick: () => void }) {
    return (
      <Button
        onClick={onClick}
        disabled={isSubmitting}
        className="w-full min-h-11 text-white hover:opacity-90"
        style={{ backgroundColor: 'var(--brand)' }}
      >
        {isSubmitting && <Loader2 size={16} className="animate-spin mr-2" />}
        Save
      </Button>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="fixed bottom-6 right-6 z-50">
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForms() }}>
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
          <div
            className="px-5 pt-5 pb-4 sticky top-0 z-10"
            style={{ backgroundColor: 'var(--brand-light)', borderBottom: '1px solid var(--brand-mid)' }}
          >
            <DialogHeader>
              <DialogTitle className="text-base font-semibold" style={{ color: 'var(--brand-dark)' }}>
                What do you want to log?
              </DialogTitle>
            </DialogHeader>
            <div className="flex flex-wrap gap-1.5 mt-3">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className="px-3 py-1.5 rounded-full text-sm font-medium border transition-colors"
                  style={
                    tab === t.id
                      ? { backgroundColor: 'var(--brand)', color: 'white', borderColor: 'var(--brand)' }
                      : { backgroundColor: 'white', borderColor: 'var(--brand-mid)', color: 'var(--brand-dark)' }
                  }
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tab body */}
          <div className="px-5 py-4 space-y-3">

            {/* ── I made ─────────────────────────────────────────────────── */}
            {tab === 'made' && (
              <>
                <Chips
                  active={prodForm.productName}
                  onSelect={(name) => setProdForm((f) => ({ ...f, productName: name }))}
                />
                <Input
                  placeholder="Product name"
                  value={prodForm.productName}
                  onChange={(e) => setProdForm((f) => ({ ...f, productName: e.target.value }))}
                  className="min-h-11"
                />
                <Input
                  type="number"
                  inputMode="decimal"
                  placeholder="How many did you make?"
                  value={prodForm.qty}
                  onChange={(e) => setProdForm((f) => ({ ...f, qty: e.target.value }))}
                  className="min-h-11"
                />

                {/* Optional: sold some right away */}
                <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-gray-700 py-0.5">
                  <input
                    type="checkbox"
                    checked={prodForm.soldSome}
                    onChange={(e) => setProdForm((f) => ({ ...f, soldSome: e.target.checked }))}
                    className="rounded border-gray-300 accent-[var(--brand)]"
                  />
                  Some were sold right away
                </label>

                {prodForm.soldSome && (
                  <>
                    <Input
                      type="number"
                      inputMode="decimal"
                      placeholder="How many did you sell?"
                      value={prodForm.soldQty}
                      onChange={(e) => setProdForm((f) => ({ ...f, soldQty: e.target.value }))}
                      className="min-h-11"
                    />
                    <Input
                      type="number"
                      inputMode="decimal"
                      placeholder={`Price each (${currency})`}
                      value={prodForm.soldPrice}
                      onChange={(e) => setProdForm((f) => ({ ...f, soldPrice: e.target.value }))}
                      className="min-h-11"
                    />
                  </>
                )}

                <SaveButton onClick={handleMadeSave} />
              </>
            )}

            {/* ── I sold ─────────────────────────────────────────────────── */}
            {tab === 'sold' && (
              <>
                <Chips
                  active={saleForm.productName}
                  onSelect={(name) => setSaleForm((f) => ({ ...f, productName: name }))}
                />
                <Input
                  placeholder="Product name"
                  value={saleForm.productName}
                  onChange={(e) => setSaleForm((f) => ({ ...f, productName: e.target.value }))}
                  className="min-h-11"
                />
                <Input
                  type="number"
                  inputMode="decimal"
                  placeholder="How many?"
                  value={saleForm.qty}
                  onChange={(e) => setSaleForm((f) => ({ ...f, qty: e.target.value }))}
                  className="min-h-11"
                />
                <Input
                  type="number"
                  inputMode="decimal"
                  placeholder={`Price each (${currency})`}
                  value={saleForm.price}
                  onChange={(e) => setSaleForm((f) => ({ ...f, price: e.target.value }))}
                  className="min-h-11"
                />
                <SaveButton onClick={handleSoldSave} />
              </>
            )}

            {/* ── I bought ───────────────────────────────────────────────── */}
            {tab === 'bought' && (
              <>
                <Input
                  placeholder="What did you buy? (e.g. Flour)"
                  value={stockForm.itemName}
                  onChange={(e) => setStockForm((f) => ({ ...f, itemName: e.target.value }))}
                  className="min-h-11"
                />
                <Input
                  type="number"
                  inputMode="decimal"
                  placeholder="How much?"
                  value={stockForm.qty}
                  onChange={(e) => setStockForm((f) => ({ ...f, qty: e.target.value }))}
                  className="min-h-11"
                />
                <Input
                  type="number"
                  inputMode="decimal"
                  placeholder={`Cost for all of it (${currency})`}
                  value={stockForm.cost}
                  onChange={(e) => setStockForm((f) => ({ ...f, cost: e.target.value }))}
                  className="min-h-11"
                />
                <p className="text-xs text-gray-500">
                  Existing ingredients will have stock added. New ones are created automatically.
                </p>
                <SaveButton onClick={handleBoughtSave} />
              </>
            )}

            {/* ── I gave away ────────────────────────────────────────────── */}
            {tab === 'gave' && (
              <>
                <Chips
                  active={gaveForm.productName}
                  onSelect={(name) => setGaveForm((f) => ({ ...f, productName: name }))}
                />
                <Input
                  placeholder="Product name"
                  value={gaveForm.productName}
                  onChange={(e) => setGaveForm((f) => ({ ...f, productName: e.target.value }))}
                  className="min-h-11"
                />
                <Input
                  type="number"
                  inputMode="decimal"
                  placeholder="How many?"
                  value={gaveForm.qty}
                  onChange={(e) => setGaveForm((f) => ({ ...f, qty: e.target.value }))}
                  className="min-h-11"
                />
                <p className="text-xs text-gray-500">
                  Samples, gifts, or tasting pieces. These will not count as sold.
                </p>
                <SaveButton onClick={handleGaveSave} />
              </>
            )}

          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
