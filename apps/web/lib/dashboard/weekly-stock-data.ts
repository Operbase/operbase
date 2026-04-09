import type { SupabaseClient } from '@supabase/supabase-js'

export type WeeklyStockRow = {
  itemId: string
  name: string
  usageUnitName: string
  startOfWeek: number   // qty at Monday 00:00 (estimated: current - added + used this week)
  addedThisWeek: number // sum of positive entries this week
  usedThisWeek: number  // sum of abs(negative entries) this week
  onHandNow: number     // current quantity_on_hand
}

/**
 * Returns all items that had any stock movement this week (Mon–Sun),
 * plus any item currently below 0 or with low stock.
 * Uses the business timezone to determine week boundaries.
 */
export async function loadWeeklyStock(
  supabase: SupabaseClient,
  businessId: string,
  timezone: string
): Promise<WeeklyStockRow[]> {
  // Determine Monday 00:00 in the business timezone
  const now = new Date()
  const weekStart = getWeekStartIso(now, timezone)

  // 1. All stock_entries from this week, joined to item name + usage unit
  const { data: entries, error: entriesError } = await supabase
    .from('stock_entries')
    .select('item_id, quantity, created_at')
    .eq('business_id', businessId)
    .gte('created_at', weekStart)
    .order('created_at', { ascending: true })

  if (entriesError) throw entriesError

  // 2. All items for the business (for names, units, and current qty)
  const { data: itemsData, error: itemsError } = await supabase
    .from('items')
    .select(`
      id, name, quantity_on_hand,
      usage_unit:units!items_usage_unit_id_fkey (name)
    `)
    .eq('business_id', businessId)
    .order('name')

  if (itemsError) throw itemsError

  const rows = itemsData ?? []
  const entriesArr = entries ?? []

  // Aggregate weekly movements per item
  const addedMap = new Map<string, number>()
  const usedMap = new Map<string, number>()
  const movedItemIds = new Set<string>()

  for (const e of entriesArr) {
    const qty = Number(e.quantity)
    const itemId = e.item_id as string
    movedItemIds.add(itemId)
    if (qty > 0) {
      addedMap.set(itemId, (addedMap.get(itemId) ?? 0) + qty)
    } else {
      usedMap.set(itemId, (usedMap.get(itemId) ?? 0) + Math.abs(qty))
    }
  }

  const result: WeeklyStockRow[] = []

  for (const item of rows) {
    const id = item.id as string
    const added = addedMap.get(id) ?? 0
    const used = usedMap.get(id) ?? 0
    const onHand = Number(item.quantity_on_hand ?? 0)
    const usageUnit = (item.usage_unit as { name?: string } | null)?.name ?? ''

    // Only include items that had movement this week, or are currently low/empty
    if (!movedItemIds.has(id) && onHand > 0) continue

    const startOfWeekQty = onHand - added + used

    result.push({
      itemId: id,
      name: item.name as string,
      usageUnitName: usageUnit,
      startOfWeek: Math.max(0, startOfWeekQty),
      addedThisWeek: added,
      usedThisWeek: used,
      onHandNow: onHand,
    })
  }

  return result
}

/** Returns ISO string for Monday 00:00:00 local time, formatted as UTC */
function getWeekStartIso(now: Date, timezone: string): string {
  try {
    // Use Intl to get current date parts in business timezone
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now)

    const year = Number(parts.find((p) => p.type === 'year')?.value)
    const month = Number(parts.find((p) => p.type === 'month')?.value)
    const day = Number(parts.find((p) => p.type === 'day')?.value)

    // Get day of week (0=Sun, 1=Mon, ..., 6=Sat) in local timezone
    const localDate = new Date(now.toLocaleString('en-US', { timeZone: timezone }))
    const dayOfWeek = localDate.getDay() // 0=Sunday
    const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
    const mondayDay = day - daysFromMonday

    // Build the Monday date string
    const monday = new Date(Date.UTC(year, month - 1, mondayDay))
    return monday.toISOString()
  } catch {
    // Fallback: last 7 days
    const d = new Date(now)
    d.setUTCDate(d.getUTCDate() - 6)
    d.setUTCHours(0, 0, 0, 0)
    return d.toISOString()
  }
}
