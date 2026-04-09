import type { StockRow, UsageRow, TodayProfitData, TodaySalesData } from './data'

function money(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount)
  } catch {
    return `${currency} ${amount.toFixed(2)}`
  }
}

function qty(n: number, unit: string): string {
  const rounded = n % 1 === 0 ? n.toFixed(0) : n.toFixed(1)
  return unit ? `${rounded} ${unit}` : rounded
}

export function formatCurrentStock(rows: StockRow[]): string {
  if (rows.length === 0) {
    return "Your stock list is empty. Add items in the Stock section first."
  }

  const lowItems = rows.filter((r) => r.isLow)
  const lines = rows.map((r) => {
    const label = r.isLow ? ' ⚠ low' : ''
    return `• ${r.name}: ${qty(r.onHand, r.unitName)}${label}`
  })

  const header = "Here is what you have right now:"
  const body = lines.join('\n')
  const footer =
    lowItems.length > 0
      ? `\n${lowItems.length} item${lowItems.length > 1 ? 's are' : ' is'} running low — consider restocking.`
      : ''

  return `${header}\n${body}${footer}`
}

export function formatWeeklyUsage(rows: UsageRow[]): string {
  if (rows.length === 0) {
    return "No ingredients have been used this week yet."
  }

  const lines = rows.map((r) => `• ${r.name}: ${qty(r.used, r.unitName)} used`)
  return `This week you used:\n${lines.join('\n')}`
}

export function formatTodayProfit(data: TodayProfitData, currency: string): string {
  if (data.totalUnits === 0) {
    return "No sales recorded today yet."
  }

  const productLines =
    data.byProduct.length > 0
      ? '\n' + data.byProduct.map((p) => `  ${p.units} × ${p.name}`).join('\n')
      : ''

  const profitLine =
    data.totalCogs > 0
      ? `\nProfit: ${money(data.totalProfit, currency)}`
      : `\n(Add ingredient costs to production runs to see profit here.)`

  return (
    `Today you sold ${data.totalUnits} item${data.totalUnits !== 1 ? 's' : ''}:${productLines}` +
    `\n\nMoney in: ${money(data.totalRevenue, currency)}` +
    (data.totalCogs > 0 ? `\nCost: ${money(data.totalCogs, currency)}` : '') +
    profitLine
  )
}

export function formatTodaySales(data: TodaySalesData): string {
  if (data.totalUnits === 0) {
    return "No sales recorded today yet."
  }

  const lines = data.byProduct.map((p) => `• ${p.units} × ${p.name}`)
  return `Today you sold ${data.totalUnits} item${data.totalUnits !== 1 ? 's' : ''}:\n${lines.join('\n')}`
}

export function formatUnknown(): string {
  return (
    "I didn't quite follow that. Try asking:\n" +
    '• "What is left in my pantry?"\n' +
    '• "What did I use this week?"\n' +
    '• "Did I make profit today?"\n' +
    '• "How many items did I sell today?"'
  )
}
