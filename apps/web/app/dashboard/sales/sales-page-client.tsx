'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
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
import { Plus, Trash2, DollarSign, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useBusinessContext } from '@/providers/business-provider'
import { formatCurrency } from '@/lib/format-currency'
import { saleCogsFromBatch } from '@/lib/bakery/cost'
import { trackEvent } from '@/lib/services/events'
import { COMMON_SALE_AMOUNTS, COMMON_SALE_PRICES } from '@/lib/bakery/simple-presets'
import { PriceChips, WholeNumberChips } from '@/components/bakery-quick-picks'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import type { SalesRow, SalesBatchOptionRow } from '@/lib/dashboard/sales-data'

type Sale = SalesRow
type BatchOption = SalesBatchOptionRow

export function SalesPageClient({
  initialSales,
  initialBatches,
}: {
  initialSales: SalesRow[]
  initialBatches: SalesBatchOptionRow[]
}) {
  const { businessId, currency } = useBusinessContext()
  const [sales, setSales] = useState<Sale[]>(initialSales)
  const [batches, setBatches] = useState<BatchOption[]>(initialBatches)
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
    soldAt: new Date().toISOString().split('T')[0],
    batchId: '',
  })

  const supabase = useMemo(() => createClient(), [])

  const fetchSales = useCallback(async () => {
    if (!businessId) return
    setIsLoading(true)
    const client = createClient()

    const from = page * PAGE_SIZE
    const to = from + PAGE_SIZE - 1

    let query = client
      .from('sales')
      .select('id, units_sold, unit_price, revenue, cogs, gross_profit, sold_at, batch_id, customers(name)')
      .eq('business_id', businessId)

    // Date range filter
    if (dateRange !== 'all') {
      const now = new Date()
      const start = new Date(now)
      if (dateRange === 'week') start.setDate(now.getDate() - 7)
      else if (dateRange === 'month') start.setMonth(now.getMonth() - 1)
      query = query.gte('sold_at', start.toISOString())
    }

    const { data, error } = await query
      .range(from, to)
      .order('sold_at', { ascending: false })

    if (error) {
      toast.error(error.message)
      setIsLoading(false)
      return
    }

    setSales(
      (data ?? []).map((s: Record<string, unknown>) => {
        const c = s.customers as { name?: string } | null
        return {
          id: s.id as string,
          customer_name: c?.name ?? 'Walk-in',
          units_sold: Number(s.units_sold),
          unit_price: Number(s.unit_price),
          revenue: Number(s.revenue),
          cogs: s.cogs != null ? Number(s.cogs) : null,
          gross_profit: s.gross_profit != null ? Number(s.gross_profit) : null,
          sold_at: s.sold_at as string,
          batch_id: s.batch_id as string | null,
        }
      })
    )
    setIsLoading(false)
  }, [businessId, page, dateRange])

  const fetchBatches = useCallback(async () => {
    if (!businessId) return
    const client = createClient()
    const { data, error } = await client
      .from('batches')
      .select('id, notes, units_produced, cost_of_goods, products(name)')
      .eq('business_id', businessId)
      .order('produced_at', { ascending: false })

    if (error) return

    setBatches(
      (data ?? []).map((b: Record<string, unknown>) => {
        const p = b.products as { name?: string } | null
        const name = p?.name ?? (b.notes as string) ?? 'Batch'
        const cost = b.cost_of_goods != null ? Number(b.cost_of_goods) : null
        const up = Number(b.units_produced)
        const cpu = cost != null && up > 0 ? cost / up : null
        return {
          id: b.id as string,
          label:
            cpu != null
              ? `${name} (~$${cpu.toFixed(2)}/unit)`
              : `${name} (no batch cost)`,
          units_produced: up,
          cost_of_goods: cost,
        }
      })
    )
  }, [businessId])

  useEffect(() => {
    setSales(initialSales)
  }, [initialSales])

  useEffect(() => {
    setBatches(initialBatches)
  }, [initialBatches])

  useEffect(() => {
    if (!businessId) return
    const isDefaultList = page === 0 && dateRange === 'month'
    if (skipSsrListFetch.current && isDefaultList) {
      skipSsrListFetch.current = false
      return
    }
    void fetchSales()
    void fetchBatches()
  }, [businessId, fetchSales, fetchBatches, page, dateRange])

  function computeCogs(
    units: number,
    batchId: string | null
  ): number | null {
    if (!batchId) return null
    const b = batches.find((x) => x.id === batchId)
    if (!b?.cost_of_goods || b.units_produced <= 0) return null
    return saleCogsFromBatch(units, b.cost_of_goods, b.units_produced)
  }

  function openAdd() {
    setEditingSale(null)
    setForm({
      customerName: '',
      unitsSold: '',
      unitPrice: '',
      soldAt: new Date().toISOString().split('T')[0],
      batchId: '',
    })
    setDialogOpen(true)
  }

  function openEdit(sale: Sale) {
    setEditingSale(sale)
    setForm({
      customerName: sale.customer_name === 'Walk-in' ? '' : sale.customer_name,
      unitsSold: sale.units_sold.toString(),
      unitPrice: sale.unit_price.toString(),
      soldAt: sale.sold_at.split('T')[0],
      batchId: sale.batch_id ?? '',
    })
    setDialogOpen(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!businessId || isSubmitting) return

    const units = parseFloat(form.unitsSold)
    const price = parseFloat(form.unitPrice)

    if (!units || units <= 0 || !price || price <= 0) {
      toast.error('Please enter valid units and price')
      return
    }

    const batchId = form.batchId || null
    const cogs = computeCogs(units, batchId)
    setIsSubmitting(true)

    try {
      let customerId: string | null = null

      if (form.customerName.trim()) {
        const name = form.customerName.trim()
        // Upsert pattern: try insert, handle conflict gracefully
        const { data: newCustomer, error: custError } = await supabase
          .from('customers')
          .insert({ business_id: businessId, name })
          .select('id')
          .single()

        if (custError?.code === '23505') {
          // Unique violation — fetch existing
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

      const payload = {
        business_id: businessId,
        customer_id: customerId,
        batch_id: batchId,
        units_sold: units,
        unit_price: price,
        sold_at: form.soldAt,
        cogs,
      }

      if (editingSale) {
        const { error } = await supabase
          .from('sales')
          .update({
            units_sold: units,
            unit_price: price,
            sold_at: form.soldAt,
            batch_id: batchId,
            cogs,
          })
          .eq('id', editingSale.id)

        if (error) throw error
        toast.success('Sale updated!')
      } else {
        const { error } = await supabase.from('sales').insert(payload)
        if (error) throw error
        trackEvent('sale_recorded', businessId, { units_sold: payload.units_sold, revenue: payload.units_sold * payload.unit_price })
        toast.success('Sale recorded!')
      }

      setDialogOpen(false)
      fetchSales()
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to save sale'
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this sale?')) return

    const { error } = await supabase.from('sales').delete().eq('id', id)
    if (error) {
      toast.error(error.message)
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
      const date = s.sold_at.split('T')[0]
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
            Record every sale here — how many units, at what price, and who bought them.
            OB calculates your revenue and profit automatically. Link a batch to track your cost of goods.
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
                className={dateRange === d ? 'bg-amber-600 hover:bg-amber-700' : ''}
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
              <Button size="lg" className="bg-amber-600 hover:bg-amber-700 min-h-12 text-base shrink-0">
                <Plus size={20} className="mr-2" />
                Log sale
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="text-xl">{editingSale ? 'Change sale' : 'Log sale'}</DialogTitle>
              </DialogHeader>
              <form noValidate onSubmit={handleSave} className="space-y-4">
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
                    placeholder="$ or type"
                    className="mt-2 min-h-11 text-base"
                  />
                </div>
                {form.unitsSold && form.unitPrice && (
                  <p className="text-base text-gray-800 bg-amber-50 border border-amber-100 p-3 rounded-lg">
                    Total:{' '}
                    <strong className="text-lg">
                      {formatCurrency(parseFloat(form.unitsSold || '0') * parseFloat(form.unitPrice || '0'), currency)}
                    </strong>
                    {form.batchId &&
                      (() => {
                        const c = computeCogs(
                          parseFloat(form.unitsSold || '0'),
                          form.batchId || null
                        )
                        return c != null ? (
                          <span className="block mt-1 text-sm text-amber-900">
                            Cost estimate: <strong>{formatCurrency(c, currency)}</strong>
                          </span>
                        ) : null
                      })()}
                  </p>
                )}
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
                  <summary className="cursor-pointer font-medium">Customer or batch (optional)</summary>
                  <div className="space-y-3 mt-3 pt-2 border-t">
                    <div>
                      <Label htmlFor="customerName">Customer</Label>
                      <Input
                        id="customerName"
                        value={form.customerName}
                        onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                        placeholder="Leave blank for walk-in"
                        className="min-h-11 mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="batchId">Link a batch (for cost tracking)</Label>
                      <select
                        id="batchId"
                        value={form.batchId}
                        onChange={(e) => setForm({ ...form, batchId: e.target.value })}
                        className="w-full px-3 py-2.5 border border-gray-200 rounded-md text-base min-h-11 mt-1"
                      >
                        <option value="">— none —</option>
                        {batches.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </details>
                <Button
                  type="submit"
                  size="lg"
                  className="w-full bg-amber-600 hover:bg-amber-700 min-h-12 text-base"
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

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-gray-600">
                <DollarSign size={16} className="text-green-600" />
                Money in
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{formatCurrency(totalRevenue, currency)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Costs (tracked)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-700">{formatCurrency(totalCogs, currency)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">After costs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-800">{formatCurrency(totalProfit, currency)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Units sold</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalUnits.toFixed(0)}</div>
            </CardContent>
          </Card>
        </div>

        {chartData.length > 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Revenue trend (last 14 days)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis />
                  <Tooltip formatter={(v: number) => formatCurrency(v, currency)} />
                  <Bar dataKey="revenue" fill="#d97706" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Recent sales</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-center text-gray-500 py-8">Loading...</p>
            ) : sales.length === 0 ? (
              <p className="text-center text-gray-500 py-8">
                No sales yet. Tap &quot;Log sale&quot;.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead>Units</TableHead>
                      <TableHead>Unit price</TableHead>
                      <TableHead>Revenue</TableHead>
                      <TableHead>COGS</TableHead>
                      <TableHead>Profit</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSales.map((sale) => (
                      <TableRow key={sale.id}>
                        <TableCell className="font-medium">{sale.customer_name}</TableCell>
                        <TableCell>{sale.units_sold}</TableCell>
                        <TableCell>{formatCurrency(sale.unit_price, currency)}</TableCell>
                        <TableCell className="font-semibold text-green-600">
                          {formatCurrency(sale.revenue, currency)}
                        </TableCell>
                        <TableCell>
                          {sale.cogs != null ? formatCurrency(sale.cogs, currency) : '—'}
                        </TableCell>
                        <TableCell>
                          {sale.gross_profit != null ? (
                            <span className="text-amber-800 font-medium">
                              {formatCurrency(sale.gross_profit, currency)}
                            </span>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                        <TableCell>{new Date(sale.sold_at).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => openEdit(sale)}>
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDelete(sale.id)}
                            >
                              <Trash2 size={14} />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
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
