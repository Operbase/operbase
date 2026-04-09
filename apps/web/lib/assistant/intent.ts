/**
 * Rule-based intent detection.
 * Swap this module for an AI-based version later without touching anything else.
 */

export type IntentType =
  | 'weekly_usage'
  | 'current_stock'
  | 'today_profit'
  | 'today_sales'
  | 'unknown'

export type Intent = { type: IntentType }

// Each entry: [keyword/phrase, scores per intent]
// Higher score = stronger signal for that intent.
const SIGNALS: [string, Partial<Record<IntentType, number>>][] = [
  // Weekly usage
  ['used this week',    { weekly_usage: 5 }],
  ['use this week',     { weekly_usage: 5 }],
  ['used last week',    { weekly_usage: 4 }],
  ['usage this week',   { weekly_usage: 5 }],
  ['weekly usage',      { weekly_usage: 5 }],
  ['went through',      { weekly_usage: 4 }],
  ['consumed',          { weekly_usage: 3 }],
  ['consume',           { weekly_usage: 3 }],
  ['weekly',            { weekly_usage: 3 }],
  ['used',              { weekly_usage: 2 }],
  ['usage',             { weekly_usage: 2 }],
  ['week',              { weekly_usage: 2 }],
  ['ingredient',        { weekly_usage: 2, current_stock: 1 }],

  // Current stock
  ['on hand',           { current_stock: 5 }],
  ['in my pantry',      { current_stock: 5 }],
  ['in stock',          { current_stock: 4 }],
  ['do i have',         { current_stock: 4 }],
  ['what is left',      { current_stock: 4 }],
  ["what's left",       { current_stock: 4 }],
  ['how much left',     { current_stock: 4 }],
  ['pantry',            { current_stock: 4 }],
  ['remaining',         { current_stock: 3 }],
  ['inventory',         { current_stock: 3 }],
  ['left',              { current_stock: 2 }],
  ['stock',             { current_stock: 2 }],
  ['still have',        { current_stock: 3 }],
  ['how much',          { current_stock: 1, weekly_usage: 1 }],

  // Today profit
  ['make profit',       { today_profit: 5 }],
  ['made profit',       { today_profit: 5 }],
  ['did i profit',      { today_profit: 5 }],
  ['profit today',      { today_profit: 5 }],
  ["today's profit",    { today_profit: 5 }],
  ['how much did i make', { today_profit: 4 }],
  ['how much money',    { today_profit: 3 }],
  ['profit',            { today_profit: 4 }],
  ['revenue',           { today_profit: 3 }],
  ['income',            { today_profit: 3 }],
  ['earned',            { today_profit: 3 }],
  ['earn',              { today_profit: 2 }],
  ['money',             { today_profit: 2 }],
  ['made today',        { today_profit: 3 }],
  ['make today',        { today_profit: 3 }],

  // Today sales
  ['how many sold',     { today_sales: 5 }],
  ['how many did i sell', { today_sales: 5 }],
  ['items sold',        { today_sales: 4 }],
  ['units sold',        { today_sales: 4 }],
  ['sales today',       { today_sales: 4 }],
  ["today's sales",     { today_sales: 4 }],
  ['how many items',    { today_sales: 3 }],
  ['sold today',        { today_sales: 3 }],
  ['sold',              { today_sales: 2, today_profit: 1 }],
  ['sale',              { today_sales: 2, today_profit: 1 }],
  ['sales',             { today_sales: 2, today_profit: 1 }],
  ['how many',          { today_sales: 2 }],

  // Shared: "today" boosts both time-based intents
  ['today',             { today_profit: 1, today_sales: 1 }],
]

export function detectIntent(question: string): Intent {
  const q = question.toLowerCase()

  const scores: Record<IntentType, number> = {
    weekly_usage: 0,
    current_stock: 0,
    today_profit: 0,
    today_sales: 0,
    unknown: 0,
  }

  for (const [phrase, weights] of SIGNALS) {
    if (q.includes(phrase)) {
      for (const [intent, score] of Object.entries(weights) as [IntentType, number][]) {
        scores[intent] += score
      }
    }
  }

  const best = (Object.entries(scores) as [IntentType, number][])
    .filter(([k]) => k !== 'unknown')
    .sort(([, a], [, b]) => b - a)[0]

  if (!best || best[1] === 0) return { type: 'unknown' }
  return { type: best[0] }
}
