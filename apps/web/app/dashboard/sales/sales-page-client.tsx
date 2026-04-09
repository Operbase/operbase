'use client'

import { useState, useEffect, useCallback, useMemo, useRef, Fragment } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Plus, Trash2, Loader2, ChevronsUpDown, ChevronDown, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useBusinessContext } from '@/providers/business-provider'
import { formatCurrency } from '@/lib/format-currency'
import { trackEvent } from '@/lib/services/events'
import { COMMON_SALE_AMOUNTS, COMMON_SALE_PRICES } from '@/lib/bakery/simple-presets'
import { PriceChips, WholeNumberChips } from '@/components/bakery-quick-picks'
import { friendlyError } from '@/lib/errors'
import {
  businessCalendarDateToIsoUtc,
  formatCalendarDateInTimeZone,
  formatFriendlyDate,
  salesSinceForDashboardPeriod,
  utcInstantFromBusinessCalendarDate,
} from '@/lib/business-time'
import { profitTextClass, profitCardClass, profitRowClass } from '@/lib/dashboard/profit-tone'
import {
  saleCogsFromProductAvg,
  weightedAverageOutputUnitCost,
} from '@/lib/bakery/per-product-cogs'
import { saleCogsFromBatch } from '@/lib/bakery/cost'
import { cn } from '@/lib/utils'
import type { SalesRow } from '@/lib/dashboard/sales-data'

type Sale = SalesRow

type SaleSource =
  | {
      kind: 'batch'
      batchId: string
      productId: string
      productName: string
      unitsRemaining: number
      unitsProduced: number
      costOfGoods: number | null
      producedAt: string
      variantId: string | null
    }
  | { kind: 'quick'; productId: string; productName: string; variantId: string | null }

type ProductVariantOption = { id: string; name: string; cost_per_unit: number | null }
type ProductAddonOption = { id: string; name: string; extra_cost: number | null }
type ProductWithMeta = { id: string; name: string; variants: ProductVariantOption[]; addons: ProductAddonOption[] }

type BatchItemLine = { itemName: string; lineCost: number }

type ProductRow = { id: string; name: string }

type BatchOptionRow = {
  id: string
  product_id: string | null
  units_remaining: number
  units_produced: number
  cost_of_goods: number | null
  produced_at: string
  products: { name: string | null } | null
}

export function SalesPageClient({
  initialSales,
}: {
  initialSales: SalesRow[]
}) {
  const { businessId, currency, timezone } = useBusinessContext()
  const searchParams = useSearchParams()
  const router = useRouter()
  const [sales, setSales] = useState<Sale[]>(initialSales)
  const [isLoading, setIsLoading] = useState(false)
  const skipSsrListFetch = useRef(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingSale, setEditingSale] = useState<Sale | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 50
  const [search, setSearch] = useState('')
  const [dateRange, setDateRange] = useState<'all' | 'week' | 'month'>('month')
  const [form, setForm] = useState({
    customerName: '',
    unitsSold: '',
    unitPrice: '',
    soldAt: formatCalendarDateInTimeZone(new Date(), timezone),
  })
  const [saleSource, setSaleSource] = useState<SaleSource | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [productsForPicker, setProductsForPicker] = useState<ProductRow[]>([])
  const [batchesForPicker, setBatchesForPicker] = useState<BatchOptionRow[]>([])
  const [batchItemLines, setBatchItemLines] = useState<BatchItemLine[]>([])
  const [productCatalog, setProductCatalog] = useState<ProductWithMeta[]>([])
  const [variantsForProduct, setVariantsForProduct] = useState<ProductVariantOption[]>([])
  const [addonsForProduct, setAddonsForProduct] = useState<ProductAddonOption[]>([])
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null)
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>([])
  const [expandedSaleId, setExpandedSaleId] = useState<string | null>(null)
  const [salesDetailsOpen, setSalesDetailsOpen] = useState(false)
  const [salePreview, setSalePreview] = useState<{
    revenue: number
    cost: number | null
    profit: number | null
    costPerUnit: number | null
    profitPerUnit: number | null
    ingredientLines: { name: string; cost: number }[]
  } | null>(null)

  const supabase = useMemo(() => createClient(), [])

  const fetchSales = useCallback(async () => {
    if (!businessId) return
    setIsLoading(true)
    const client = createClient()

    const from = page * PAGE_SIZE
    const to = from + PAGE_SIZE - 1

    let query = client
      .from('sales')
      .select(
        'id, batch_id, units_sold, unit_price, revenue, cogs, gross_profit, sold_at, product_id, product_name, customers(name)'
      )
      .eq('business_id', businessId)

    // Date range filter
    if (dateRange !== 'all') {
      const period = dateRange === 'week' ? 'week' : 'month'
      const start = salesSinceForDashboardPeriod(period, timezone)
      if (start) {
        query = query.gte('sold_at', start.toISOString())
      }
    }

    const { data, error } = await query
      .range(from, to)
      .order('sold_at', { ascending: false })

    if (error) {
      toast.error(friendlyError(error))
      setIsLoading(false)
      return
    }

    setSales(
      (data ?? []).map((s: Record<string, unknown>) => {
        const c = s.customers as { name?: string } | null
        return {
          id: s.id as string,
          customer_name: c?.name ?? 'Walk-in',
          product_id: (s.product_id as string | null) ?? null,
          product_name: (s.product_name as string | null) ?? null,
          batch_id: (s.batch_id as string | null) ?? null,
          units_sold: Number(s.units_sold),
          unit_price: Number(s.unit_price),
          revenue: Number(s.revenue),
          cogs: s.cogs != null ? Number(s.cogs) : null,
          gross_profit: s.gross_profit != null ? Number(s.gross_profit) : null,
          sold_at: s.sold_at as string,
        }
      })
    )
    setIsLoading(false)
  }, [businessId, page, dateRange, timezone])

  useEffect(() => {
    setSales(initialSales)
  }, [initialSales])

  useEffect(() => {
    if (!businessId) return
    const isDefaultList = page === 0 && dateRange === 'month'
    if (skipSsrListFetch.current && isDefaultList) {
      skipSsrListFetch.current = false
      return
    }
    void fetchSales()
  }, [businessId, fetchSales, page, dateRange])

  const computeAutoCogs = useCallback(
    async (productId: string, unitsSold: number): Promise<number | null> => {
      if (!businessId) return null
      const { data, error } = await supabase
        .from('batches')
        .select('cost_of_goods, units_produced')
        .eq('business_id', businessId)
        .eq('product_id', productId)
        .gt('units_produced', 0)
        .not('cost_of_goods', 'is', null)

      if (error) {
        console.error('[sales] batches for cost:', error.message)
        return null
      }

      const avg = weightedAverageOutputUnitCost(data ?? [])
      return saleCogsFromProductAvg(unitsSold, avg)
    },
    [businessId, supabase]
  )

  const loadVariantsAddons = useCallback(
    (productId: string) => {
      const found = productCatalog.find((p) => p.id === productId)
      setVariantsForProduct(found?.variants ?? [])
      setAddonsForProduct(found?.addons ?? [])
      setSelectedVariantId(null)
      setSelectedAddonIds([])
    },
    [productCatalog]
  )

  const loadSalePickerData = useCallback(async () => {
    if (!businessId) return
    const [prodRes, batchRes] = await Promise.all([
      supabase
        .from('products')
        .select('id, name, product_variants(id, name, sort_order, cost_per_unit), product_addons(id, name, extra_cost, sort_order)')
        .eq('business_id', businessId)
        .order('name'),
      supabase
        .from('batches')
        .select(
          'id, product_id, units_remaining, units_produced, cost_of_goods, produced_at, products(name)'
        )
        .eq('business_id', businessId)
        .gt('units_remaining', 0)
        .order('produced_at', { ascending: true }),
    ])
    if (!prodRes.error && prodRes.data) {
      const catalog = (prodRes.data as Record<string, unknown>[]).map((p) => ({
        id: p.id as string,
        name: p.name as string,
        variants: ((p.product_variants as (ProductVariantOption & { sort_order: number })[] | null) ?? [])
          .slice()
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((v) => ({ id: v.id, name: v.name, cost_per_unit: v.cost_per_unit ?? null })),
        addons: ((p.product_addons as (ProductAddonOption & { sort_order: number })[] | null) ?? [])
          .slice()
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((a) => ({ id: a.id, name: a.name, extra_cost: a.extra_cost ?? null })),
      }))
      setProductCatalog(catalog)
      setProductsForPicker(catalog.map((p) => ({ id: p.id, name: p.name })))
    }
    if (!batchRes.error && batchRes.data) {
      setBatchesForPicker(batchRes.data as BatchOptionRow[])
    }
  }, [businessId, supabase])

  useEffect(() => {
    if (!dialogOpen || !businessId) {
      setSalePreview(null)
      return
    }
    const u = parseFloat(form.unitsSold)
    const price = parseFloat(form.unitPrice)
    if (!saleSource || !u || u <= 0 || !price || price <= 0) {
      setSalePreview(null)
      return
    }
    let cancelled = false
    const timer = window.setTimeout(async () => {
      try {
        const revenue = u * price
        let cost: number | null = null
        let ingredientLines: { name: string; cost: number }[] = []

        // Check if a variant with a manual cost is selected — use that first
        const variantCost = selectedVariantId
          ? (productCatalog
              .find((p) => p.id === saleSource.productId)
              ?.variants.find((v) => v.id === selectedVariantId)
              ?.cost_per_unit ?? null)
          : null

        if (variantCost != null) {
          cost = variantCost * u
        } else if (saleSource.kind === 'batch') {
          const c = saleSource.costOfGoods
          const prod = saleSource.unitsProduced
          if (c != null && prod > 0) {
            cost = saleCogsFromBatch(u, c, prod)
            for (const line of batchItemLines) {
              const share = u / prod
              ingredientLines.push({
                name: line.itemName,
                cost: line.lineCost * share,
              })
            }
          }
        } else {
          cost = await computeAutoCogs(saleSource.productId, u)
        }

        if (cancelled) return
        const profit = cost != null ? revenue - cost : null
        const costPerUnit = cost != null && u > 0 ? cost / u : null
        const profitPerUnit =
          costPerUnit != null ? price - costPerUnit : profit != null && u > 0 ? profit / u : null

        setSalePreview({
          revenue,
          cost,
          profit,
          costPerUnit,
          profitPerUnit,
          ingredientLines,
        })
      } catch {
        if (!cancelled) setSalePreview(null)
      }
    }, 320)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [
    dialogOpen,
    businessId,
    saleSource,
    form.unitsSold,
    form.unitPrice,
    supabase,
    computeAutoCogs,
    batchItemLines,
    selectedVariantId,
    productCatalog,
  ])

  useEffect(() => {
    if (!dialogOpen || !businessId) {
      return
    }
    void loadSalePickerData()
  }, [dialogOpen, businessId, loadSalePickerData])

  useEffect(() => {
    if (!dialogOpen || !businessId || !saleSource || saleSource.kind !== 'batch') {
      setBatchItemLines([])
      return
    }
    let cancelled = false
    void (async () => {
      const { data, error } = await supabase
        .from('batch_items')
        .select('cost, items(name)')
        .eq('batch_id', saleSource.batchId)
      if (cancelled || error) return
      const lines: BatchItemLine[] = (data ?? []).map((row: Record<string, unknown>) => {
        const it = row.items as { name?: string } | null
        return {
          itemName: it?.name ?? 'Ingredient',
          lineCost: Number(row.cost ?? 0),
        }
      })
      setBatchItemLines(lines)
    })()
    return () => {
      cancelled = true
    }
  }, [dialogOpen, businessId, saleSource, supabase])

  const autoOpenedForBatch = useRef(false)
  useEffect(() => {
    const b = searchParams.get('batch')
    if (b && !autoOpenedForBatch.current) {
      autoOpenedForBatch.current = true
      setDialogOpen(true)
    }
  }, [searchParams])

  const prefApplied = useRef(false)
  useEffect(() => {
    if (!dialogOpen || prefApplied.current || !businessId) return
    const bid = searchParams.get('batch')
    if (!bid || batchesForPicker.length === 0) return
    const b = batchesForPicker.find((x) => x.id === bid)
    if (!b?.product_id || !b.products?.name) return
    prefApplied.current = true
    setSaleSource({
      kind: 'batch',
      batchId: b.id,
      productId: b.product_id,
      productName: b.products.name,
      unitsRemaining: Number(b.units_remaining),
      unitsProduced: Number(b.units_produced),
      costOfGoods: b.cost_of_goods != null ? Number(b.cost_of_goods) : null,
      producedAt: b.produced_at,
      variantId: null,
    })
    router.replace('/dashboard/sales', { scroll: false })
  }, [dialogOpen, businessId, searchParams, batchesForPicker, router])

  useEffect(() => {
    if (!dialogOpen) prefApplied.current = false
  }, [dialogOpen])

  function openAdd() {
    setEditingSale(null)
    setSaleSource(null)
    setPickerOpen(false)
    setVariantsForProduct([])
    setAddonsForProduct([])
    setSelectedVariantId(null)
    setSelectedAddonIds([])
    setForm({
      customerName: '',
      unitsSold: '',
      unitPrice: '',
      soldAt: formatCalendarDateInTimeZone(new Date(), timezone),
    })
    setDialogOpen(true)
  }

  function openEdit(sale: Sale) {
    setEditingSale(sale)
    setPickerOpen(false)
    setVariantsForProduct([])
    setAddonsForProduct([])
    setSelectedVariantId(null)
    setSelectedAddonIds([])
    if (sale.product_id && sale.product_name) {
      setSaleSource({ kind: 'quick', productId: sale.product_id, productName: sale.product_name, variantId: null })
    } else {
      setSaleSource(null)
    }
    setForm({
      customerName: sale.customer_name === 'Walk-in' ? '' : sale.customer_name,
      unitsSold: sale.units_sold.toString(),
      unitPrice: sale.unit_price.toString(),
      soldAt: formatCalendarDateInTimeZone(new Date(sale.sold_at), timezone),
    })
    setDialogOpen(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!businessId || isSubmitting) return

    if (!saleSource) {
      toast.error('Pick what you sold from the list.')
      return
    }

    const productName = saleSource.productName.trim()
    if (!productName) {
      toast.error('Pick a product or a run that still has stock.')
      return
    }
    if (productName.length > 200) {
      toast.error('Product name is too long. Keep it under 200 characters.')
      return
    }

    const units = parseFloat(form.unitsSold)
    const price = parseFloat(form.unitPrice)

    if (!units || units <= 0) {
      toast.error('Enter how many you sold.')
      return
    }
    if (!price || price <= 0) {
      toast.error('Enter the price for each one.')
      return
    }

    if (saleSource.kind === 'batch' && units > saleSource.unitsRemaining) {
      toast.error(`That run only has ${saleSource.unitsRemaining} left. Lower the quantity or pick another run.`)
      return
    }

    setIsSubmitting(true)

    try {
      let productId: string
      if (saleSource.kind === 'batch') {
        productId = saleSource.productId
      } else {
        const { data: ensuredId, error: productErr } = await supabase.rpc('ensure_product', {
          p_business_id: businessId,
          p_name: productName,
        })
        if (productErr) throw productErr
        if (!ensuredId || typeof ensuredId !== 'string') {
          toast.error('Could not save the product for this sale. Try again.')
          return
        }
        productId = ensuredId
      }

      let customerId: string | null = null

      if (form.customerName.trim()) {
        const name = form.customerName.trim()
        const { data: newCustomer, error: custError } = await supabase
          .from('customers')
          .insert({ business_id: businessId, name })
          .select('id')
          .single()

        if (custError?.code === '23505') {
          const { data: existing } = await supabase
            .from('customers')
            .select('id')
            .eq('business_id', businessId)
            .eq('name', name)
            .maybeSingle()
          customerId = existing?.id ?? null
        } else if (custError) {
          throw custError
        } else {
          customerId = newCustomer?.id ?? null
        }
      }

      if (editingSale) {
        const cogs = await computeAutoCogs(productId, units)
        const { error } = await supabase
          .from('sales')
          .update({
            product_id: productId,
            product_name: productName,
            units_sold: units,
            unit_price: price,
            sold_at: businessCalendarDateToIsoUtc(form.soldAt, timezone),
            cogs,
          })
          .eq('id', editingSale.id)
        if (error) throw error
        toast.success('Sale updated!')
        if (cogs != null && units * price < cogs) {
          toast.message('At this price you lose money on each item — raise the price or sell a smaller amount.', {
            duration: 6500,
          })
        }
      } else {
        // Prefer variant manual cost over WAC lookup
        const variantManualCost = selectedVariantId
          ? (productCatalog
              .find((p) => p.id === productId)
              ?.variants.find((v) => v.id === selectedVariantId)
              ?.cost_per_unit ?? null)
          : null
        const cogsQuick =
          saleSource.kind === 'quick'
            ? variantManualCost != null
              ? variantManualCost * units
              : await computeAutoCogs(productId, units)
            : null
        const { data: newSaleId, error } = await supabase.rpc('record_sale_with_batch', {
          p_business_id: businessId,
          p_product_id: productId,
          p_product_name: productName,
          p_units_sold: units,
          p_unit_price: price,
          p_sold_at: businessCalendarDateToIsoUtc(form.soldAt, timezone),
          p_customer_id: customerId,
          p_batch_id: saleSource.kind === 'batch' ? saleSource.batchId : null,
          p_cogs_if_no_batch: cogsQuick,
        })
        if (error) throw error
        // Attach variant if selected
        if (newSaleId && selectedVariantId) {
          await supabase.from('sales').update({ variant_id: selectedVariantId }).eq('id', newSaleId as string)
        }
        trackEvent('sale_recorded', businessId, { units_sold: units, revenue: units * price })
        toast.success('Sale recorded!')
        const rev = units * price
        const cost =
          saleSource.kind === 'batch' && saleSource.costOfGoods != null && saleSource.unitsProduced > 0
            ? saleCogsFromBatch(units, saleSource.costOfGoods, saleSource.unitsProduced)
            : cogsQuick
        if (cost != null && rev < cost) {
          toast.message('At this price you lose money on each item — raise the price or sell a smaller amount.', {
            duration: 6500,
          })
        }
      }

      setDialogOpen(false)
      fetchSales()
    } catch (error: unknown) {
      toast.error(friendlyError(error, 'Failed to save sale'))
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this sale?')) return

    const { error } = await supabase.rpc('delete_sale_restores_batch', { p_sale_id: id })
    if (error) {
      toast.error(friendlyError(error))
      return
    }
    toast.success('Sale deleted')
    fetchSales()
  }

  const totalRevenue = sales.reduce((sum, s) => sum + s.revenue, 0)
  const totalCogs = sales.reduce((sum, s) => sum + (s.cogs ?? 0), 0)
  const totalProfit = sales.reduce((sum, s) => sum + (s.gross_profit ?? 0), 0)
  const totalUnits = sales.reduce((sum, s) => sum + s.units_sold, 0)

  // Client-side search filter on customer name
  const filteredSales = search.trim()
    ? sales.filter((s) => s.customer_name.toLowerCase().includes(search.trim().toLowerCase()))
    : sales

  const chartData = Object.values(
    filteredSales.reduce((acc, s) => {
      const date = formatCalendarDateInTimeZone(new Date(s.sold_at), timezone)
      if (!acc[date]) acc[date] = { date, revenue: 0 }
      acc[date].revenue += s.revenue
      return acc
    }, {} as Record<string, { date: string; revenue: number }>)
  )
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-14)

  return (
    <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Sales</h1>
          <p className="text-gray-600 mt-1">
            Log each sale and the price. Pick a production run when you can. We keep your stock accurate and show
            whether you made money.
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          <Input
            type="search"
            placeholder="Search customer…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs min-h-10"
          />
          <div className="flex gap-1">
            {(['month', 'week', 'all'] as const).map((d) => (
              <Button
                key={d}
                variant={dateRange === d ? 'default' : 'outline'}
                size="sm"
                style={dateRange === d ? { backgroundColor: 'var(--brand)', borderColor: 'var(--brand)' } : undefined}
                onClick={() => setDateRange(d)}
              >
                {d === 'month' ? 'Last month' : d === 'week' ? 'Last week' : 'All time'}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="lg" className="min-h-12 text-base shrink-0 text-white hover:opacity-90" style={{ backgroundColor: 'var(--brand)' }}>
                <Plus size={20} className="mr-2" />
                Log sale
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg p-0">
              <div
                className="px-6 pt-5 pb-4 sticky top-0 z-10"
                style={{ backgroundColor: 'var(--brand-light)', borderBottom: '1px solid var(--brand-mid)' }}
              >
                <DialogHeader>
                  <DialogTitle className="text-xl font-semibold" style={{ color: 'var(--brand-dark)' }}>
                    {editingSale ? 'Change sale' : 'Log sale'}
                  </DialogTitle>
                </DialogHeader>
              </div>
              <form noValidate onSubmit={handleSave} className="space-y-4 px-6 py-5">
                <div className="space-y-2">
                  <Label className="text-base">What are you selling?</Label>
                  <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        role="combobox"
                        aria-expanded={pickerOpen}
                        disabled={!!editingSale}
                        className={cn(
                          'w-full justify-between min-h-11 text-base font-normal',
                          !saleSource && 'text-muted-foreground'
                        )}
                      >
                        {saleSource
                          ? saleSource.kind === 'batch'
                            ? `${saleSource.productName} · ${formatFriendlyDate(saleSource.producedAt, timezone)} · ${saleSource.unitsRemaining} left`
                            : `${saleSource.productName} · not from a specific run`
                          : 'Search or pick a product…'}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search products and runs…" className="h-11" />
                        <CommandList>
                          <CommandEmpty>Nothing matches. Add your products in the Products section first.</CommandEmpty>
                          {batchesForPicker.length > 0 ? (
                            <CommandGroup heading="From a production run">
                              {batchesForPicker.map((b) => {
                                const name = b.products?.name ?? 'Product'
                                if (!b.product_id) return null
                                return (
                                  <CommandItem
                                    key={b.id}
                                    value={`${name} ${b.id}`}
                                    onSelect={() => {
                                      setSaleSource({
                                        kind: 'batch',
                                        batchId: b.id,
                                        productId: b.product_id!,
                                        productName: name,
                                        unitsRemaining: Number(b.units_remaining),
                                        unitsProduced: Number(b.units_produced),
                                        costOfGoods: b.cost_of_goods != null ? Number(b.cost_of_goods) : null,
                                        producedAt: b.produced_at,
                                        variantId: null,
                                      })
                                      loadVariantsAddons(b.product_id!)
                                      setPickerOpen(false)
                                    }}
                                  >
                                    {name} · {formatFriendlyDate(b.produced_at, timezone)} ·{' '}
                                    {Number(b.units_remaining)} left
                                  </CommandItem>
                                )
                              })}
                            </CommandGroup>
                          ) : null}
                          <CommandGroup heading="Quick sale">
                            {productsForPicker.map((p) => (
                              <CommandItem
                                key={p.id}
                                value={p.name}
                                onSelect={() => {
                                  setSaleSource({
                                    kind: 'quick',
                                    productId: p.id,
                                    productName: p.name,
                                    variantId: null,
                                  })
                                  loadVariantsAddons(p.id)
                                  setPickerOpen(false)
                                }}
                              >
                                {p.name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <p className="text-xs text-gray-600">
                    Pick a run if you made this product today — that links the sale to your real stock.
                    Otherwise, quick sale works fine.
                  </p>
                </div>

                {/* Variant picker */}
                {variantsForProduct.length > 0 && (
                  <div className="space-y-1.5">
                    <Label className="text-sm text-gray-700">Which type?</Label>
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

                {/* Add-on checkboxes */}
                {addonsForProduct.length > 0 && (
                  <div className="space-y-1.5">
                    <Label className="text-sm text-gray-700">Any extras? (optional)</Label>
                    <div className="flex flex-wrap gap-2">
                      {addonsForProduct.map((a) => {
                        const checked = selectedAddonIds.includes(a.id)
                        return (
                          <button
                            key={a.id}
                            type="button"
                            onClick={() =>
                              setSelectedAddonIds(
                                checked
                                  ? selectedAddonIds.filter((id) => id !== a.id)
                                  : [...selectedAddonIds, a.id]
                              )
                            }
                            className={cn(
                              'px-3 py-1.5 rounded-full text-sm border transition-colors',
                              checked
                                ? 'text-white border-transparent'
                                : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                            )}
                            style={checked ? { backgroundColor: 'var(--brand)', borderColor: 'var(--brand)' } : undefined}
                          >
                            {a.name}
                            {a.extra_cost != null && a.extra_cost > 0
                              ? ` +${formatCurrency(a.extra_cost, currency)}`
                              : ''}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                <div>
                  <Label htmlFor="units" className="text-base">
                    How many?
                  </Label>
                  <WholeNumberChips
                    values={[...COMMON_SALE_AMOUNTS]}
                    onPick={(n) => setForm((f) => ({ ...f, unitsSold: String(n) }))}
                    className="mt-2"
                  />
                  <Input
                    id="units"
                    type="number"
                    step="0.01"
                    min="0.01"
                    inputMode="decimal"
                    value={form.unitsSold}
                    onChange={(e) => setForm({ ...form, unitsSold: e.target.value })}
                    placeholder="Or type"
                    className="mt-2 min-h-11 text-base"
                  />
                </div>
                <div>
                  <Label htmlFor="price" className="text-base">
                    Price each
                  </Label>
                  <PriceChips
                    amounts={[...COMMON_SALE_PRICES]}
                    onPick={(n) => setForm((f) => ({ ...f, unitPrice: String(n) }))}
                    className="mt-2"
                  />
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    min="0.01"
                    inputMode="decimal"
                    value={form.unitPrice}
                    onChange={(e) => setForm({ ...form, unitPrice: e.target.value })}
                    placeholder={`${currency} or type`}
                    className="mt-2 min-h-11 text-base"
                  />
                </div>
                {form.unitsSold && form.unitPrice && (
                  <p className="text-base text-gray-800 p-3 rounded-lg border" style={{ backgroundColor: 'var(--brand-light)', borderColor: 'var(--brand-mid)' }}>
                    Total:{' '}
                    <strong className="text-lg">
                      {formatCurrency(parseFloat(form.unitsSold || '0') * parseFloat(form.unitPrice || '0'), currency)}
                    </strong>
                  </p>
                )}
                {salePreview && salePreview.revenue > 0 ? (
                  <div className="rounded-lg border border-gray-200 bg-gray-50/80 p-4 space-y-3">
                    <div className="flex justify-between items-center gap-3">
                      <span className="text-gray-600">Cost</span>
                      <span className="text-lg font-semibold tabular-nums text-gray-800">
                        {salePreview.cost != null
                          ? formatCurrency(salePreview.cost, currency)
                          : '—'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center gap-3">
                      <span className="text-gray-600">Money in</span>
                      <span className="text-lg font-semibold text-green-600 tabular-nums">
                        {formatCurrency(salePreview.revenue, currency)}
                      </span>
                    </div>
                    {salePreview.cost != null ? (
                      <div className="flex justify-between items-center gap-3 pt-2 border-t">
                        <span className="font-medium text-gray-900">You keep</span>
                        <span className={`text-xl font-bold tabular-nums ${profitTextClass(salePreview.profit ?? 0)}`}>
                          {formatCurrency(salePreview.profit ?? 0, currency)}
                        </span>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">
                        {saleSource?.kind === 'quick'
                          ? `Log production for "${saleSource.productName}" first to see cost and profit.`
                          : 'No ingredient cost recorded for this run.'}
                      </p>
                    )}
                    {salePreview.cost != null ? (
                      <details className="text-sm border border-gray-200 rounded-md bg-white px-3 py-2">
                        <summary className="cursor-pointer font-medium text-gray-800 py-1">
                          See cost breakdown
                        </summary>
                        <div className="pt-2 space-y-2 text-gray-600">
                          {salePreview.profitPerUnit != null && salePreview.profitPerUnit < 0 ? (
                            <p className="text-red-700 bg-red-50 rounded p-2">
                              At this price you lose{' '}
                              {formatCurrency(-salePreview.profitPerUnit, currency)} on each one.
                            </p>
                          ) : salePreview.profitPerUnit != null ? (
                            <p className="text-green-700">
                              About {formatCurrency(salePreview.profitPerUnit, currency)} profit on each one.
                            </p>
                          ) : null}
                          {salePreview.ingredientLines.length > 0 ? (
                            <ul className="text-xs space-y-1 border-t pt-2">
                              {salePreview.ingredientLines.map((line, i) => (
                                <li key={`${line.name}-${i}`} className="flex justify-between gap-2">
                                  <span className="min-w-0 truncate">{line.name}</span>
                                  <span className="tabular-nums shrink-0">
                                    {formatCurrency(line.cost, currency)}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          ) : null}
                        </div>
                      </details>
                    ) : null}
                  </div>
                ) : null}
                <div>
                  <Label htmlFor="soldAt" className="text-base">
                    Date
                  </Label>
                  <Input
                    id="soldAt"
                    type="date"
                    value={form.soldAt}
                    onChange={(e) => setForm({ ...form, soldAt: e.target.value })}
                    className="min-h-11 mt-1"
                    required
                  />
                </div>
                <details className="text-sm border rounded-lg p-3 bg-gray-50">
                  <summary className="cursor-pointer font-medium">Customer (optional)</summary>
                  <div className="mt-3 pt-2 border-t">
                    <Label htmlFor="customerName">Customer name</Label>
                    <Input
                      id="customerName"
                      value={form.customerName}
                      onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                      placeholder="Leave blank for walk-in"
                      className="min-h-11 mt-1"
                    />
                  </div>
                </details>
                <Button
                  type="submit"
                  size="lg"
                  className="w-full min-h-12 text-base text-white hover:opacity-90" style={{ backgroundColor: 'var(--brand)' }}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <><Loader2 size={18} className="mr-2 animate-spin" />Saving…</>
                  ) : editingSale ? 'Save' : 'Save sale'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {sales.length > 0 && totalProfit < 0 && (
          <div
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
            role="status"
          >
            <strong className="font-semibold">These sales cost more than they brought in:</strong> raise prices,
            cut costs, or check that production is logged.
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">What it cost</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-700 tabular-nums">
                {formatCurrency(totalCogs, currency)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Money in</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600 tabular-nums">
                {formatCurrency(totalRevenue, currency)}
              </div>
            </CardContent>
          </Card>
          <Card className="border-2 shadow-sm" style={{ borderColor: 'var(--brand-mid)', backgroundColor: 'var(--brand-light)' }}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-800">You kept</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-3xl sm:text-4xl font-extrabold tabular-nums ${profitCardClass(totalProfit)}`}>
                {formatCurrency(totalProfit, currency)}
              </div>
              <p className="text-xs text-gray-600 mt-2">
                {totalProfit >= 0 ? 'After what it cost to make what you sold.' : 'Sales did not cover cost — check prices.'}
              </p>
            </CardContent>
          </Card>
        </div>

        <details
          className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm"
          onToggle={(e) => setSalesDetailsOpen(e.currentTarget.open)}
        >
          <summary className="cursor-pointer font-medium text-gray-900">See daily breakdown</summary>
          <div className="mt-3 space-y-3 text-gray-700">
            <p>
              <strong className="tabular-nums">{totalUnits.toFixed(0)}</strong> items sold in this view.
            </p>
            {salesDetailsOpen && chartData.length > 1 ? (
              <div className="pt-2">
                <p className="text-xs font-medium text-gray-600 mb-2">Money in per day (last 14 days in range)</p>
                <div className="rounded-md border border-gray-200 overflow-hidden max-w-md">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-left text-gray-600">
                        <th className="px-3 py-2 font-medium">Day</th>
                        <th className="px-3 py-2 font-medium text-right">Money in</th>
                      </tr>
                    </thead>
                    <tbody>
                      {chartData.map((row) => (
                        <tr key={row.date} className="border-t border-gray-100">
                          <td className="px-3 py-1.5 text-gray-800">
                            {formatFriendlyDate(
                              utcInstantFromBusinessCalendarDate(row.date, timezone),
                              timezone
                            )}
                          </td>
                          <td className="px-3 py-1.5 text-right tabular-nums font-medium text-green-700">
                            {formatCurrency(row.revenue, currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : salesDetailsOpen ? (
              <p className="text-xs text-gray-500">Not enough days with sales to show a daily breakdown.</p>
            ) : null}
          </div>
        </details>

        <Card>
          <CardHeader>
            <CardTitle>Recent sales</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-center text-gray-500 py-8">Loading...</p>
            ) : sales.length === 0 ? (
              <p className="text-center text-gray-500 py-8 max-w-md mx-auto leading-relaxed">
                No sales yet. Tap &ldquo;Log sale&rdquo; when money comes in. Your revenue, cost, and profit will
                show up here and on the dashboard.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10 p-2" />
                      <TableHead>Sale</TableHead>
                      <TableHead className="text-right">You kept</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSales.map((sale) => {
                      const expanded = expandedSaleId === sale.id
                      return (
                        <Fragment key={sale.id}>
                          <TableRow className={profitRowClass(sale.gross_profit)}>
                            <TableCell className="p-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0"
                                aria-expanded={expanded}
                                aria-label={expanded ? 'Hide sale details' : 'Show sale details'}
                                onClick={() => setExpandedSaleId(expanded ? null : sale.id)}
                              >
                                {expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                              </Button>
                            </TableCell>
                            <TableCell>
                              <div className="font-medium text-base">{sale.product_name?.trim() || '—'}</div>
                              <div className="text-sm text-gray-500">
                                {formatFriendlyDate(sale.sold_at, timezone)}
                                {sale.customer_name !== 'Walk-in' ? ` · ${sale.customer_name}` : ''}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              {sale.gross_profit != null ? (
                                <span className={`text-lg font-semibold tabular-nums ${profitTextClass(sale.gross_profit)}`}>
                                  {formatCurrency(sale.gross_profit, currency)}
                                </span>
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex gap-1 justify-end">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    if (sale.batch_id) {
                                      toast.message(
                                        'This sale is tied to a production run. To change it, delete this sale and log it again with the right amount and price.',
                                        { duration: 9000 }
                                      )
                                      return
                                    }
                                    openEdit(sale)
                                  }}
                                >
                                  Edit
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-gray-400 hover:text-red-600"
                                  aria-label={`Delete sale ${sale.product_name ?? sale.id}`}
                                  onClick={() => handleDelete(sale.id)}
                                >
                                  <Trash2 size={14} />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                          {expanded ? (
                            <TableRow className="bg-gray-50/80">
                              <TableCell colSpan={4} className="p-4 text-sm text-gray-800">
                                <div className="grid sm:grid-cols-2 gap-3 max-w-lg">
                                  <div>
                                    <p className="text-xs font-medium text-gray-500 uppercase">Money in</p>
                                    <p className="text-lg font-semibold text-green-700 tabular-nums">
                                      {formatCurrency(sale.revenue, currency)}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-xs font-medium text-gray-500 uppercase">Cost</p>
                                    <p className="text-lg font-semibold text-gray-800 tabular-nums">
                                      {sale.cogs != null ? formatCurrency(sale.cogs, currency) : '—'}
                                    </p>
                                  </div>
                                  <div className="sm:col-span-2 text-gray-600">
                                    {sale.units_sold} sold at {formatCurrency(sale.unit_price, currency)} each
                                    {' · '}
                                    {sale.customer_name}
                                    {sale.batch_id && (
                                      <span className="block text-xs text-gray-500 mt-1">
                                        Linked to a production run — use Delete, then log again, to change this
                                        sale.
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </TableCell>
                            </TableRow>
                          ) : null}
                        </Fragment>
                      )
                    })}
                  </TableBody>
                </Table>
                {sales.length === PAGE_SIZE && (
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
      </div>
  )
}
