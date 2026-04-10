'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ShoppingCart, ChefHat, Banknote, Check } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useBusinessContext } from '@/providers/business-provider'
import { formatCurrency } from '@/lib/format-currency'
import {
  formatCalendarDateInTimeZone,
  businessCalendarDateToIsoUtc,
} from '@/lib/business-time'

type Flow = 'bought' | 'made' | 'sold'
type MadeScreen = 'what' | 'sold-check' | 'sold-detail'

interface StockItem {
  id: string
  name: string
  purchaseUnitId: string | null
  purchaseUnitName: string
  conversionRatio: number
}

interface Product {
  id: string
  name: string
}

interface Result {
  bigNumber?: string               // shown very large — profit or revenue
  bigLabel?: string                // "profit" | "revenue" | "loss" — small label
  bigSentiment?: 'good' | 'warn' | 'neutral'
  headline: string                 // "You made 8 Banana Bread."
  lines: string[]                  // emotional supporting lines
}

// ─────────────────────────────────────────────────────────────────────────────
// localStorage profit memory helpers
// ─────────────────────────────────────────────────────────────────────────────

function readProfitMemory(bId: string): { last: number; best: number } | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(`wh_profit_${bId}`)
    if (!raw) return null
    return JSON.parse(raw) as { last: number; best: number }
  } catch { return null }
}

function writeProfitMemory(bId: string, profit: number): void {
  if (typeof window === 'undefined') return
  try {
    const prev = readProfitMemory(bId)
    const best = prev ? Math.max(prev.best, profit) : profit
    localStorage.setItem(`wh_profit_${bId}`, JSON.stringify({ last: profit, best }))
  } catch { /* ignore */ }
}

function memoryLine(profit: number, mem: { last: number; best: number } | null): string | null {
  if (!mem) return null
  if (profit > mem.best) return '🔥 Your best sale yet!'
  if (profit > mem.last) return 'Better than your last sale. Keep it up! 🙌'
  return null
}

// ─────────────────────────────────────────────────────────────────────────────
// Public export: outer shell handles mode + pathname guard before hooks
// ─────────────────────────────────────────────────────────────────────────────

export function WhatHappened({
  onSaved,
  mode = 'cards',
}: {
  onSaved?: () => void
  mode?: 'cards' | 'bar'
}) {
  const pathname = usePathname()
  if (mode === 'bar' && pathname === '/dashboard') return null
  return <WhatHappenedInner onSaved={onSaved} mode={mode} />
}

// ─────────────────────────────────────────────────────────────────────────────
// Inner component
// ─────────────────────────────────────────────────────────────────────────────

function WhatHappenedInner({
  onSaved,
  mode,
}: {
  onSaved?: () => void
  mode: 'cards' | 'bar'
}) {
  const router = useRouter()
  const [flow, setFlow] = useState<Flow | null>(null)
  const [screen, setScreen] = useState<'form' | 'done'>('form')
  const [result, setResult] = useState<Result | null>(null)
  const [saving, setSaving] = useState(false)

  const [stockItems, setStockItems] = useState<StockItem[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [pieceUnitId, setPieceUnitId] = useState<string | null>(null)

  // ── Form state ──
  const [bName, setBName] = useState('')
  const [bQty, setBQty] = useState('')
  const [bCost, setBCost] = useState('')
  const [mName, setMName] = useState('')
  const [mQty, setMQty] = useState('')
  const [madeScreen, setMadeScreen] = useState<MadeScreen>('what')
  const [mSoldQty, setMSoldQty] = useState('')
  const [mSoldPrice, setMSoldPrice] = useState('')
  const [sName, setSName] = useState('')
  const [sQty, setSQty] = useState('')
  const [sPrice, setSPrice] = useState('')

  const { businessId, currency, timezone } = useBusinessContext()
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    if (!businessId) return
    void Promise.all([
      supabase
        .from('items')
        .select('id, name, purchase_unit_id, conversion_ratio, purchase_unit:units!items_purchase_unit_id_fkey(id, name)')
        .eq('business_id', businessId)
        .order('name'),
      supabase
        .from('products')
        .select('id, name')
        .eq('business_id', businessId)
        .eq('is_active', true)
        .order('name'),
      supabase.from('units').select('id').ilike('name', 'piece').limit(1),
    ]).then(([itemsRes, prodRes, unitRes]) => {
      setStockItems(
        (itemsRes.data ?? []).map((i: Record<string, unknown>) => {
          const pu = i.purchase_unit as { id?: string; name?: string } | null
          return {
            id: i.id as string,
            name: i.name as string,
            purchaseUnitId: (i.purchase_unit_id as string | null) ?? null,
            purchaseUnitName: pu?.name ?? '',
            conversionRatio: Number(i.conversion_ratio ?? 1) || 1,
          }
        })
      )
      setProducts((prodRes.data ?? []) as Product[])
      const firstUnit = (unitRes.data ?? [])[0] as { id: string } | undefined
      if (firstUnit) setPieceUnitId(firstUnit.id)
    })
  }, [businessId, supabase])

  const today = useMemo(() => {
    if (!timezone) return ''
    return formatCalendarDateInTimeZone(new Date(), timezone)
  }, [timezone])

  function openFlow(f: Flow) {
    setFlow(f)
    setScreen('form')
    setResult(null)
    setMadeScreen('what')
    setBName(''); setBQty(''); setBCost('')
    setMName(''); setMQty(''); setMSoldQty(''); setMSoldPrice('')
    setSName(''); setSQty(''); setSPrice('')
  }

  function closeDialog() { setFlow(null) }

  function handleSaved() {
    router.refresh()
    onSaved?.()
  }

  // ── Autocomplete suggestions ──
  const boughtSugs = useMemo(
    () => bName.trim() ? stockItems.filter(i => i.name.toLowerCase().includes(bName.toLowerCase())).slice(0, 5) : [],
    [bName, stockItems]
  )
  const madeSugs = useMemo(
    () => mName.trim() ? products.filter(p => p.name.toLowerCase().includes(mName.toLowerCase())).slice(0, 5) : [],
    [mName, products]
  )
  const soldSugs = useMemo(
    () => sName.trim() ? products.filter(p => p.name.toLowerCase().includes(sName.toLowerCase())).slice(0, 5) : [],
    [sName, products]
  )

  // ── Save: I bought ────────────────────────────────────────────────────────
  async function saveBought() {
    if (!businessId) return
    const name = bName.trim()
    if (!name) { toast.error('What did you buy?'); return }
    const qty = parseFloat(bQty)
    if (!qty || qty <= 0) { toast.error('How many did you get?'); return }
    const totalCost = parseFloat(bCost) || 0

    setSaving(true)
    try {
      const existing = stockItems.find(i => i.name.toLowerCase() === name.toLowerCase())
      let itemId = existing?.id ?? null
      const unitName = existing?.purchaseUnitName || 'piece'
      const conversionRatio = existing?.conversionRatio ?? 1

      if (!itemId) {
        const { data: newItem, error: iErr } = await supabase
          .from('items')
          .insert({
            business_id: businessId,
            name,
            type: 'ingredient',
            purchase_unit_id: pieceUnitId,
            usage_unit_id: pieceUnitId,
            conversion_ratio: 1,
            cost_per_unit: qty > 0 && totalCost > 0 ? totalCost / qty : 0,
          })
          .select('id')
          .single()
        if (iErr) throw iErr
        itemId = (newItem as { id: string }).id
      }

      const { error } = await supabase.rpc('add_purchase_lot', {
        p_business_id: businessId,
        p_item_id: itemId,
        p_purchase_qty: qty,
        p_total_cost_paid: totalCost,
        p_note: 'Quick add',
      })
      if (error) throw error

      // Query total remaining stock for this item
      const { data: lots } = await supabase
        .from('purchase_lots')
        .select('quantity_remaining')
        .eq('business_id', businessId)
        .eq('item_id', itemId)
      // quantity_remaining is in usage units — convert back to purchase units for display
      const totalStockUsage = (lots ?? []).reduce(
        (sum: number, l: { quantity_remaining: number | string }) => sum + Number(l.quantity_remaining),
        0
      )
      const totalStockPurchase = Math.round((totalStockUsage / conversionRatio) * 1000) / 1000

      const boughtLines: string[] = []
      if (totalCost > 0) boughtLines.push(`You spent ${formatCurrency(totalCost, currency)}.`)
      boughtLines.push(
        totalStockPurchase > 0
          ? `You now have ${totalStockPurchase} ${unitName} of ${name} in stock.`
          : 'Stock updated. ✓'
      )
      boughtLines.push('Ready for your next production run.')

      setResult({
        headline: `${qty} ${unitName} of ${name} logged.`,
        lines: boughtLines,
      })
      setScreen('done')
      handleSaved()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  // ── Save: I made ──────────────────────────────────────────────────────────
  async function saveMade() {
    if (!businessId) return
    const name = mName.trim()
    if (!name) { toast.error('What did you make?'); return }
    const qty = parseFloat(mQty)
    if (!qty || qty <= 0) { toast.error('How many did you make?'); return }

    const willSell = madeScreen === 'sold-detail'
    let soldQty = 0, soldPrice = 0
    if (willSell) {
      soldQty = parseFloat(mSoldQty)
      soldPrice = parseFloat(mSoldPrice)
      if (!soldQty || soldQty <= 0) { toast.error('How many did you sell?'); return }
      if (soldQty > qty) { toast.error("Can't sell more than you made"); return }
      if (!soldPrice || soldPrice <= 0) { toast.error('How much did you sell each for?'); return }
    }
    if (!today) { toast.error('Still loading — try again in a moment'); return }

    setSaving(true)
    try {
      let productId = products.find(p => p.name.toLowerCase() === name.toLowerCase())?.id ?? null
      if (!productId) {
        const { data, error } = await supabase.rpc('ensure_product', { p_business_id: businessId, p_name: name })
        if (error) throw error
        productId = data as string
      }

      const { data: batchId, error: bErr } = await supabase.rpc('create_production_batch', {
        p_business_id: businessId,
        p_units_produced: qty,
        p_produced_at: businessCalendarDateToIsoUtc(today, timezone),
        p_display_name: name,
        p_extra_notes: null,
        p_lines: [],
        p_product_id: productId,
      })
      if (bErr) throw bErr

      if (!willSell) {
        setResult({
          headline: `You made ${qty} ${name}.`,
          lines: [
            "They're ready to sell. Go get that money! 💪",
            "Now try to sell these while they're fresh.",
          ],
        })
        setScreen('done')
        handleSaved()
        return
      }

      // Sold some right away
      const { error: sErr } = await supabase.rpc('record_sale_with_batch', {
        p_business_id: businessId,
        p_product_id: productId,
        p_product_name: name,
        p_units_sold: soldQty,
        p_unit_price: soldPrice,
        p_sold_at: businessCalendarDateToIsoUtc(today, timezone),
        p_customer_id: null,
        p_batch_id: batchId as string,
        p_cogs_if_no_batch: null,
      })
      if (sErr) throw sErr

      const revenue = soldQty * soldPrice
      const remaining = qty - soldQty

      // Try to surface profit
      const { data: saleData } = await supabase
        .from('sales')
        .select('gross_profit')
        .eq('business_id', businessId)
        .eq('product_id', productId)
        .eq('batch_id', batchId as string)
        .maybeSingle()
      const profit = saleData?.gross_profit != null ? Number(saleData.gross_profit) : null

      const madeLines: string[] = []
      madeLines.push(
        remaining > 0
          ? `Sold ${soldQty} for ${formatCurrency(revenue, currency)}. ${remaining} still to sell.`
          : `Sold all ${soldQty} for ${formatCurrency(revenue, currency)}. Nothing waiting. 🙌`
      )
      if (profit !== null && profit > 0) {
        madeLines.push(`Nice — you kept ${formatCurrency(profit, currency)} on this. 🔥`)
        const mem = readProfitMemory(businessId)
        writeProfitMemory(businessId, profit)
        const ml = memoryLine(profit, mem)
        madeLines.push(ml ?? 'This is working well — consider making more of this.')
      } else if (profit !== null && profit < 0) {
        madeLines.push(`You lost ${formatCurrency(Math.abs(profit), currency)} on this. Consider adjusting your price.`)
      } else {
        madeLines.push('Track your ingredients to see your real profit.')
      }

      const showProfit = profit !== null && profit !== 0
      setResult({
        bigNumber: showProfit ? formatCurrency(Math.abs(profit!), currency) : formatCurrency(revenue, currency),
        bigLabel: showProfit ? (profit! > 0 ? 'profit' : 'loss') : 'revenue',
        bigSentiment: profit !== null && profit > 0 ? 'good' : profit !== null && profit < 0 ? 'warn' : 'neutral',
        headline: `You made ${qty} ${name}.`,
        lines: madeLines,
      })
      setScreen('done')
      handleSaved()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  // ── Save: I sold ──────────────────────────────────────────────────────────
  async function saveSold() {
    if (!businessId) return
    const name = sName.trim()
    if (!name) { toast.error('What did you sell?'); return }
    const qty = parseFloat(sQty)
    if (!qty || qty <= 0) { toast.error('How many did you sell?'); return }
    const price = parseFloat(sPrice)
    if (!price || price <= 0) { toast.error('How much did you sell each for?'); return }
    if (!today) { toast.error('Still loading — try again in a moment'); return }

    setSaving(true)
    try {
      let productId = products.find(p => p.name.toLowerCase() === name.toLowerCase())?.id ?? null
      if (!productId) {
        const { data, error } = await supabase.rpc('ensure_product', { p_business_id: businessId, p_name: name })
        if (error) throw error
        productId = data as string
      }

      const { error } = await supabase.rpc('record_sale_with_batch', {
        p_business_id: businessId,
        p_product_id: productId,
        p_product_name: name,
        p_units_sold: qty,
        p_unit_price: price,
        p_sold_at: businessCalendarDateToIsoUtc(today, timezone),
        p_customer_id: null,
        p_batch_id: null,
        p_cogs_if_no_batch: null,
      })
      if (error) throw error

      const revenue = qty * price

      // Surface profit if the system has cost data
      const { data: lastSale } = await supabase
        .from('sales')
        .select('gross_profit')
        .eq('business_id', businessId)
        .eq('product_id', productId)
        .gte('sold_at', businessCalendarDateToIsoUtc(today, timezone))
        .order('sold_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      const profit = lastSale?.gross_profit != null ? Number(lastSale.gross_profit) : null

      const soldLines: string[] = []
      if (profit !== null && profit > 0) {
        soldLines.push(`Nice — you kept ${formatCurrency(profit, currency)} on this. 🔥`)
        const mem = readProfitMemory(businessId)
        writeProfitMemory(businessId, profit)
        const ml = memoryLine(profit, mem)
        soldLines.push(ml ?? 'This is working well — consider making more of this.')
      } else if (profit !== null && profit < 0) {
        soldLines.push(`You lost ${formatCurrency(Math.abs(profit), currency)} on this. You may want to adjust your price.`)
      } else if (profit === null) {
        soldLines.push('Add ingredient tracking to see your margin next time.')
      }

      const showProfit = profit !== null && profit !== 0
      setResult({
        bigNumber: showProfit ? formatCurrency(Math.abs(profit!), currency) : formatCurrency(revenue, currency),
        bigLabel: showProfit ? (profit! > 0 ? 'profit' : 'loss') : 'revenue',
        bigSentiment: profit !== null && profit > 0 ? 'good' : profit !== null && profit < 0 ? 'warn' : 'neutral',
        headline: `Sold ${qty} ${name}.`,
        lines: soldLines,
      })
      setScreen('done')
      handleSaved()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {mode === 'cards' ? (
        <section>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
            What happened?
          </p>
          <div className="grid grid-cols-3 gap-2">
            <ActionCard icon={<ShoppingCart size={18} />} label="I bought" onClick={() => openFlow('bought')} />
            <ActionCard icon={<ChefHat size={18} />} label="I made" onClick={() => openFlow('made')} />
            <ActionCard icon={<Banknote size={18} />} label="I sold" onClick={() => openFlow('sold')} />
          </div>
        </section>
      ) : (
        <div
          className="px-4 md:px-6 lg:px-8 py-2.5 border-b flex items-center gap-3 shrink-0"
          style={{ backgroundColor: 'var(--brand-light)' }}
        >
          <span
            className="text-xs font-semibold shrink-0 hidden sm:block"
            style={{ color: 'var(--brand-dark)', opacity: 0.65 }}
          >
            Log:
          </span>
          <div className="flex gap-1.5">
            <BarButton icon={<ShoppingCart size={13} />} label="I bought" onClick={() => openFlow('bought')} />
            <BarButton icon={<ChefHat size={13} />} label="I made" onClick={() => openFlow('made')} />
            <BarButton icon={<Banknote size={13} />} label="I sold" onClick={() => openFlow('sold')} />
          </div>
        </div>
      )}

      <Dialog open={flow !== null} onOpenChange={v => { if (!v) closeDialog() }}>
        <DialogContent
          className="sm:max-w-sm overflow-hidden border-0 shadow-2xl"
          style={{
            background: 'linear-gradient(160deg, #ffffff 55%, color-mix(in srgb, var(--brand) 7%, white) 100%)',
          }}
        >
          {/* Brand accent line */}
          <div
            className="absolute top-0 left-0 right-0 h-[3px] rounded-t-lg"
            style={{ backgroundColor: 'var(--brand)' }}
          />

          {/* ── Done screen ── */}
          {screen === 'done' && result ? (
            <div key="done" className="text-center py-2 space-y-4">
              {/* Animated check */}
              <div
                className="wh-pop mx-auto w-14 h-14 rounded-full flex items-center justify-center"
                style={{ backgroundColor: 'var(--brand-light)', border: '2px solid var(--brand-mid)' }}
              >
                <Check size={24} style={{ color: 'var(--brand-dark)' }} />
              </div>

              {/* Big number */}
              {result.bigNumber && (
                <div className="wh-fade-up" style={{ animationDelay: '110ms' }}>
                  <p
                    className="text-5xl font-black tabular-nums leading-none tracking-tight"
                    style={{
                      color: result.bigSentiment === 'good'
                        ? '#15803d'
                        : result.bigSentiment === 'warn'
                          ? '#ea580c'
                          : 'var(--brand-dark)',
                    }}
                  >
                    {result.bigNumber}
                  </p>
                  {result.bigLabel && (
                    <p
                      className="text-xs font-bold uppercase tracking-widest mt-1"
                      style={{
                        color: result.bigSentiment === 'good'
                          ? '#15803d'
                          : result.bigSentiment === 'warn'
                            ? '#ea580c'
                            : 'var(--brand)',
                      }}
                    >
                      {result.bigLabel}
                    </p>
                  )}
                </div>
              )}

              {/* Headline + lines */}
              <div
                className="wh-fade-up"
                style={{ animationDelay: result.bigNumber ? '210ms' : '110ms' }}
              >
                <p className="text-lg font-bold text-gray-900 leading-snug">{result.headline}</p>
                {result.lines.map((line, i) => (
                  <p key={i} className="text-sm text-gray-500 mt-1 leading-relaxed">{line}</p>
                ))}
              </div>

              {/* Buttons */}
              <div
                className="wh-fade-up flex gap-2 justify-center pt-1"
                style={{ animationDelay: result.bigNumber ? '300ms' : '190ms' }}
              >
                <Button
                  variant="outline"
                  size="sm"
                  className="border-gray-200 text-gray-600 min-h-9"
                  onClick={() => openFlow(flow!)}
                >
                  Log another
                </Button>
                <Button
                  size="sm"
                  className="min-h-9 font-semibold text-white hover:opacity-90"
                  style={{ backgroundColor: 'var(--brand)' }}
                  onClick={closeDialog}
                >
                  Done
                </Button>
              </div>
            </div>

          ) : flow === 'bought' ? (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl font-bold text-gray-900">What did you buy?</DialogTitle>
              </DialogHeader>
              <div className="space-y-5">
                <div className="relative">
                  <label className="text-sm font-medium text-gray-600 block mb-1.5">Item</label>
                  <Input
                    placeholder="Flour, Eggs, Butter…"
                    value={bName}
                    onChange={e => setBName(e.target.value)}
                    autoFocus
                    className="border-gray-200 wh-input"
                  />
                  <Suggestions
                    items={boughtSugs.map(i => ({ id: i.id, label: i.name, sub: i.purchaseUnitName || undefined }))}
                    onSelect={v => setBName(v)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    {(() => {
                      const unit = stockItems.find(i => i.name.toLowerCase() === bName.trim().toLowerCase())?.purchaseUnitName
                      return (
                        <label className="text-sm font-medium text-gray-600 block mb-1.5">
                          {unit ? `How many ${unit} did you buy?` : 'How many did you buy?'}
                        </label>
                      )
                    })()}
                    <Input type="number" min="0" step="any" placeholder="10" value={bQty} onChange={e => setBQty(e.target.value)} className="border-gray-200 wh-input" />
                  </div>
                  <div>
                    {(() => {
                      const unit = stockItems.find(i => i.name.toLowerCase() === bName.trim().toLowerCase())?.purchaseUnitName
                      const qty = parseFloat(bQty)
                      const qtyStr = qty > 0 ? `${qty} ${unit ?? ''}`.trim() : unit ?? ''
                      return (
                        <label className="text-sm font-medium text-gray-600 block mb-1.5">
                          {qtyStr ? `How much did you pay for ${qtyStr}?` : 'How much did you pay?'}
                        </label>
                      )
                    })()}
                    <Input type="number" min="0" step="any" placeholder={`${currency} 0`} value={bCost} onChange={e => setBCost(e.target.value)} className="border-gray-200 wh-input" />
                  </div>
                </div>
                <Button onClick={() => void saveBought()} disabled={saving} className="w-full min-h-12 text-base font-semibold text-white hover:opacity-90" style={{ backgroundColor: 'var(--brand)' }}>
                  {saving ? 'Saving…' : 'Save'}
                </Button>
              </div>
            </>

          ) : flow === 'made' ? (
            <>
              {/* Step 1: What did you make + how many */}
              {madeScreen === 'what' && (
                <>
                  <DialogHeader>
                    <DialogTitle className="text-xl font-bold text-gray-900">What did you make?</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-5">
                    <div className="relative">
                      <label className="text-sm font-medium text-gray-600 block mb-1.5">Product</label>
                      <Input
                        placeholder="Banana Bread, Croissant…"
                        value={mName}
                        onChange={e => setMName(e.target.value)}
                        autoFocus
                        className="border-gray-200 wh-input"
                      />
                      <Suggestions items={madeSugs.map(p => ({ id: p.id, label: p.name }))} onSelect={v => setMName(v)} />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600 block mb-1.5">How many did you make?</label>
                      <Input type="number" min="0" step="any" placeholder="12" value={mQty} onChange={e => setMQty(e.target.value)} className="border-gray-200 wh-input" />
                    </div>
                    <Button
                      onClick={() => {
                        if (!mName.trim()) { toast.error('What did you make?'); return }
                        const q = parseFloat(mQty)
                        if (!q || q <= 0) { toast.error('How many did you make?'); return }
                        setMadeScreen('sold-check')
                      }}
                      className="w-full min-h-12 text-base font-semibold text-white hover:opacity-90"
                      style={{ backgroundColor: 'var(--brand)' }}
                    >
                      Next →
                    </Button>
                  </div>
                </>
              )}

              {/* Step 2: Did you sell any right away? */}
              {madeScreen === 'sold-check' && (
                <div className="space-y-5">
                  <DialogHeader>
                    <DialogTitle className="text-xl font-bold text-gray-900">
                      {parseFloat(mQty)} {mName} made!
                    </DialogTitle>
                  </DialogHeader>
                  <p className="text-sm text-gray-500 -mt-2">Did you sell any right away?</p>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => setMadeScreen('sold-detail')}
                      className="wh-action-card flex flex-col items-center gap-2 py-5 rounded-2xl text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 border border-transparent"
                      style={{ backgroundColor: 'var(--brand-light)' }}
                    >
                      <span className="text-2xl">💰</span>
                      <span className="text-sm font-semibold leading-tight" style={{ color: 'var(--brand-dark)' }}>
                        Yes, I sold some
                      </span>
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void saveMade()}
                      className="wh-action-card flex flex-col items-center gap-2 py-5 rounded-2xl text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 border border-gray-100 bg-gray-50"
                    >
                      <span className="text-2xl">⏰</span>
                      <span className="text-sm font-semibold leading-tight text-gray-600">
                        {saving ? 'Saving…' : 'No, not yet'}
                      </span>
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMadeScreen('what')}
                    className="text-xs text-gray-400 hover:text-gray-600 w-full text-center transition-colors pt-1"
                  >
                    ← Go back
                  </button>
                </div>
              )}

              {/* Step 3: Sold some — how many and at what price */}
              {madeScreen === 'sold-detail' && (
                <>
                  <DialogHeader>
                    <DialogTitle className="text-xl font-bold text-gray-900">How many did you sell?</DialogTitle>
                  </DialogHeader>
                  <p className="text-sm text-gray-500 -mt-2">{parseFloat(mQty)} {mName} made.</p>
                  <div className="space-y-5">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-sm font-medium text-gray-600 block mb-1.5">How many?</label>
                        <Input type="number" min="0" step="any" placeholder="5" value={mSoldQty} onChange={e => setMSoldQty(e.target.value)} className="border-gray-200 wh-input" autoFocus />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-600 block mb-1.5">Price each?</label>
                        <Input type="number" min="0" step="any" placeholder={`${currency}…`} value={mSoldPrice} onChange={e => setMSoldPrice(e.target.value)} className="border-gray-200 wh-input" />
                      </div>
                    </div>
                    <Button onClick={() => void saveMade()} disabled={saving} className="w-full min-h-12 text-base font-semibold text-white hover:opacity-90" style={{ backgroundColor: 'var(--brand)' }}>
                      {saving ? 'Saving…' : 'Save'}
                    </Button>
                    <button
                      type="button"
                      onClick={() => setMadeScreen('sold-check')}
                      className="text-xs text-gray-400 hover:text-gray-600 w-full text-center transition-colors"
                    >
                      ← Go back
                    </button>
                  </div>
                </>
              )}
            </>

          ) : flow === 'sold' ? (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl font-bold text-gray-900">What did you sell?</DialogTitle>
              </DialogHeader>
              <div className="space-y-5">
                <div className="relative">
                  <label className="text-sm font-medium text-gray-600 block mb-1.5">Product</label>
                  <Input
                    placeholder="Banana Bread, Croissant…"
                    value={sName}
                    onChange={e => setSName(e.target.value)}
                    autoFocus
                    className="border-gray-200 wh-input"
                  />
                  <Suggestions items={soldSugs.map(p => ({ id: p.id, label: p.name }))} onSelect={v => setSName(v)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium text-gray-600 block mb-1.5">How many did you sell?</label>
                    <Input type="number" min="0" step="any" placeholder="5" value={sQty} onChange={e => setSQty(e.target.value)} className="border-gray-200 wh-input" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600 block mb-1.5">How much did you sell each for?</label>
                    <Input type="number" min="0" step="any" placeholder={`${currency}…`} value={sPrice} onChange={e => setSPrice(e.target.value)} className="border-gray-200 wh-input" />
                  </div>
                </div>
                <Button onClick={() => void saveSold()} disabled={saving} className="w-full min-h-12 text-base font-semibold text-white hover:opacity-90" style={{ backgroundColor: 'var(--brand)' }}>
                  {saving ? 'Saving…' : 'Save'}
                </Button>
              </div>
            </>

          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function ActionCard({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="wh-action-card flex flex-col items-center gap-2 py-5 rounded-2xl text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
      style={{ backgroundColor: 'var(--brand-light)' }}
    >
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center"
        style={{ backgroundColor: 'var(--brand-mid)' }}
      >
        <span style={{ color: 'var(--brand-dark)' }}>{icon}</span>
      </div>
      <span className="text-xs font-semibold leading-tight" style={{ color: 'var(--brand-dark)' }}>
        {label}
      </span>
    </button>
  )
}

function BarButton({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:brightness-95 active:scale-[0.97] focus:outline-none"
      style={{ backgroundColor: 'var(--brand-mid)', color: 'var(--brand-dark)' }}
    >
      {icon}
      <span>{label}</span>
    </button>
  )
}

function Suggestions({
  items,
  onSelect,
}: {
  items: { id: string; label: string; sub?: string }[]
  onSelect: (label: string) => void
}) {
  if (items.length === 0) return null
  return (
    <div className="mt-1.5 rounded-xl border border-gray-100 bg-white shadow-lg overflow-hidden relative z-10">
      {items.map(item => (
        <button
          key={item.id}
          type="button"
          className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 border-b border-gray-50 last:border-0 flex items-center justify-between gap-3 transition-colors"
          onClick={() => onSelect(item.label)}
        >
          <span className="font-medium text-gray-800">{item.label}</span>
          {item.sub && <span className="text-xs text-gray-400 shrink-0">{item.sub}</span>}
        </button>
      ))}
    </div>
  )
}
