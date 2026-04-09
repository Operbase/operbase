'use client'

import { useState, useRef, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2, Sparkles } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'
import { useBusinessContext } from '@/providers/business-provider'
import { detectIntent } from '@/lib/assistant/intent'
import { getCurrentStock, getWeeklyUsage, getTodayProfit, getTodaySales } from '@/lib/assistant/data'
import {
  formatCurrentStock,
  formatWeeklyUsage,
  formatTodayProfit,
  formatTodaySales,
  formatUnknown,
} from '@/lib/assistant/format'

const SUGGESTIONS = [
  'What stock do I have left?',
  'What did I use this week?',
  'How much did I make today?',
  'How many items did I sell today?',
]

export function BusinessAssistant() {
  const { businessId, currency, timezone } = useBusinessContext()
  const supabase = useMemo(() => createClient(), [])

  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  async function ask(q: string) {
    const trimmed = q.trim()
    if (!trimmed || loading || !businessId) return

    setLoading(true)
    setAnswer(null)
    setError(null)

    try {
      // 1. Detect intent from keywords — no external call
      const intent = detectIntent(trimmed)

      // 2. Fetch data from Supabase based on intent
      let result: string

      switch (intent.type) {
        case 'current_stock': {
          const data = await getCurrentStock(supabase, businessId)
          result = formatCurrentStock(data)
          break
        }
        case 'weekly_usage': {
          const data = await getWeeklyUsage(supabase, businessId)
          result = formatWeeklyUsage(data)
          break
        }
        case 'today_profit': {
          const data = await getTodayProfit(supabase, businessId, timezone)
          result = formatTodayProfit(data, currency)
          break
        }
        case 'today_sales': {
          const data = await getTodaySales(supabase, businessId, timezone)
          result = formatTodaySales(data)
          break
        }
        default:
          result = formatUnknown()
      }

      setAnswer(result)
    } catch {
      setError('Could not load your data. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    void ask(question)
  }

  function handleSuggestion(s: string) {
    setQuestion(s)
    void ask(s)
  }

  return (
    <Card className="border-amber-200">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base text-amber-950">
          <Sparkles size={18} className="text-amber-600" aria-hidden />
          Ask your business
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <textarea
            ref={inputRef}
            rows={2}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void ask(question)
              }
            }}
            placeholder="e.g. What flour do I have left?  How many did I sell today?"
            className="flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-base placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 min-h-[56px]"
            disabled={loading}
          />
          <Button
            type="submit"
            size="lg"
            className="bg-amber-600 hover:bg-amber-700 self-end min-h-11"
            disabled={loading || !question.trim()}
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : 'Ask'}
          </Button>
        </form>

        {!answer && !loading && !error && (
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => handleSuggestion(s)}
                className="text-sm px-3 py-1.5 rounded-full border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {loading && (
          <p className="text-sm text-gray-500 flex items-center gap-2">
            <Loader2 size={14} className="animate-spin" /> Checking your data…
          </p>
        )}

        {error && (
          <p className="text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2 border border-red-200">
            {error}
          </p>
        )}

        {answer && (
          <div className="bg-amber-50/60 rounded-lg px-4 py-3 border border-amber-100">
            <p className="text-sm text-gray-900 whitespace-pre-wrap">{answer}</p>
            <button
              type="button"
              className="mt-2 text-xs text-amber-700 hover:text-amber-900 underline"
              onClick={() => {
                setAnswer(null)
                setQuestion('')
                inputRef.current?.focus()
              }}
            >
              Ask another question
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
