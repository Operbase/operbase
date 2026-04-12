'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, ChevronDown, ChevronUp, BookOpen, Loader2, AlertTriangle } from 'lucide-react'
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
import { createClient } from '@/lib/supabase/client'
import { useBusinessContext } from '@/providers/business-provider'
import { formatCurrency } from '@/lib/format-currency'
import { friendlyError } from '@/lib/errors'
import {
  fetchRecipesForProduct,
  fetchRecipeExpectedCosts,
  type Recipe,
  type RecipeExpectedCost,
} from '@/lib/recipes'
import type { ProductVariantRow } from '@/lib/dashboard/products-data'

type StockItem = {
  id: string
  name: string
  usage_unit_name: string
}

type RecipeItemDraft = {
  item_id: string
  quantity: string
  notes: string
}

function emptyLine(): RecipeItemDraft {
  return { item_id: '', quantity: '', notes: '' }
}

export function RecipeManager({
  productId,
  productName,
  variants,
}: {
  productId: string
  productName: string
  variants: ProductVariantRow[]
}) {
  const { businessId, currency } = useBusinessContext()
  const [expanded, setExpanded] = useState(false)
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [costs, setCosts] = useState<RecipeExpectedCost[]>([])
  const [stockItems, setStockItems] = useState<StockItem[]>([])
  const [loading, setLoading] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // form state
  const [recipeName, setRecipeName] = useState('')
  const [yieldQty, setYieldQty] = useState('1')
  const [variantId, setVariantId] = useState<string>('')
  const [recipeNotes, setRecipeNotes] = useState('')
  const [draftLines, setDraftLines] = useState<RecipeItemDraft[]>([emptyLine()])

  const supabase = createClient()

  const load = useCallback(async () => {
    if (!businessId) return
    setLoading(true)
    try {
      const [r, c] = await Promise.all([
        fetchRecipesForProduct(supabase, businessId, productId),
        fetchRecipeExpectedCosts(supabase, businessId, productId),
      ])
      setRecipes(r)
      setCosts(c)
    } catch (err) {
      toast.error(friendlyError(err, 'Could not load recipes'))
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, productId])

  // load stock items once when dialog opens
  async function loadStockItems() {
    if (stockItems.length > 0 || !businessId) return
    const { data, error } = await supabase
      .from('items')
      .select('id, name, usage_unit:units!items_usage_unit_id_fkey (name)')
      .eq('business_id', businessId)
      .order('name')
    if (error) { toast.error(friendlyError(error)); return }
    setStockItems(
      (data ?? []).map((row: Record<string, unknown>) => {
        const u = row.usage_unit as { name?: string } | null
        return { id: row.id as string, name: row.name as string, usage_unit_name: u?.name ?? '' }
      })
    )
  }

  useEffect(() => {
    if (expanded) void load()
  }, [expanded, load])

  function openCreate() {
    setRecipeName('')
    setYieldQty('1')
    setVariantId('')
    setRecipeNotes('')
    setDraftLines([emptyLine()])
    void loadStockItems()
    setDialogOpen(true)
  }

  function setLine(i: number, field: keyof RecipeItemDraft, val: string) {
    setDraftLines((prev) => prev.map((l, idx) => idx === i ? { ...l, [field]: val } : l))
  }

  function addLine() {
    setDraftLines((prev) => [...prev, emptyLine()])
  }

  function removeLine(i: number) {
    setDraftLines((prev) => prev.filter((_, idx) => idx !== i))
  }

  async function handleSave() {
    if (!businessId || isSubmitting) return
    if (!recipeName.trim()) { toast.error('Give the recipe a name'); return }
    const yieldNum = parseFloat(yieldQty)
    if (!yieldNum || yieldNum <= 0) { toast.error('Yield must be greater than zero'); return }
    const validLines = draftLines.filter((l) => l.item_id && parseFloat(l.quantity) > 0)
    if (validLines.length === 0) { toast.error('Add at least one ingredient'); return }

    setIsSubmitting(true)
    try {
      const { data: recipe, error: rErr } = await supabase
        .from('recipes')
        .insert({
          business_id: businessId,
          product_id: productId,
          variant_id: variantId || null,
          name: recipeName.trim(),
          yield_quantity: yieldNum,
          notes: recipeNotes.trim() || null,
        })
        .select('id')
        .single()
      if (rErr) throw rErr

      const { error: iErr } = await supabase.from('recipe_items').insert(
        validLines.map((l) => ({
          recipe_id: recipe.id,
          item_id: l.item_id,
          business_id: businessId,
          quantity: parseFloat(l.quantity),
          notes: l.notes.trim() || null,
        }))
      )
      if (iErr) throw iErr

      toast.success('Recipe saved!')
      setDialogOpen(false)
      void load()
    } catch (err) {
      toast.error(friendlyError(err, 'Could not save recipe'))
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDelete(recipeId: string, name: string) {
    if (!confirm(`Delete "${name}"? This won't affect past production runs.`)) return
    const { error } = await supabase.from('recipes').delete().eq('id', recipeId)
    if (error) { toast.error(friendlyError(error)); return }
    toast.success('Recipe deleted')
    void load()
  }

  const costMap = new Map(costs.map((c) => [c.recipe_id, c]))

  return (
    <div className="border-t border-gray-100">
      {/* ── Toggle row ── */}
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-gray-500 hover:text-gray-800 hover:bg-gray-50/60 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <span className="flex items-center gap-1.5">
          <BookOpen size={13} />
          {recipes.length > 0 ? `${recipes.length} recipe${recipes.length !== 1 ? 's' : ''}` : 'Recipes'}
        </span>
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          {loading ? (
            <p className="text-xs text-gray-400 py-2">Loading…</p>
          ) : recipes.length === 0 ? (
            <p className="text-xs text-gray-400 py-1">
              No recipes yet. Add one to speed up production logging.
            </p>
          ) : (
            <div className="space-y-2">
              {recipes.map((recipe) => {
                const c = costMap.get(recipe.id)
                const variantName = recipe.variant_id
                  ? variants.find((v) => v.id === recipe.variant_id)?.name
                  : null
                return (
                  <div
                    key={recipe.id}
                    className="rounded-lg border border-gray-100 bg-gray-50/60 px-3 py-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 leading-tight">
                          {recipe.name}
                          {variantName && (
                            <span className="ml-1.5 text-xs font-normal text-gray-500">
                              ({variantName})
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Makes {recipe.yield_quantity} · {recipe.items.length} ingredient{recipe.items.length !== 1 ? 's' : ''}
                          {c && c.expected_cost_per_yield > 0 && (
                            <>
                              {' · '}
                              <span style={{ color: 'var(--brand-dark)' }}>
                                {formatCurrency(c.expected_cost_per_yield, currency)} expected cost
                              </span>
                              {' ('}
                              {formatCurrency(c.expected_cost_per_unit, currency)}/unit
                              {')'}
                            </>
                          )}
                        </p>
                        {/* Ingredient list */}
                        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
                          {recipe.items.map((item) => (
                            <span key={item.id} className="text-xs text-gray-500">
                              {item.quantity} {item.usage_unit_name} {item.item_name}
                            </span>
                          ))}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="text-gray-300 hover:text-red-500 transition-colors shrink-0 mt-0.5"
                        onClick={() => handleDelete(recipe.id, recipe.name)}
                        aria-label={`Delete ${recipe.name}`}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <Button
            type="button"
            size="sm"
            variant="outline"
            className="text-xs h-8"
            onClick={openCreate}
          >
            <Plus size={12} className="mr-1" />
            Add recipe
          </Button>
        </div>
      )}

      {/* ── Create recipe dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto p-0">
          <div
            className="px-6 py-4 sticky top-0 z-10 rounded-t-lg"
            style={{ backgroundColor: 'var(--brand-light)', borderBottom: '1px solid var(--brand-mid)' }}
          >
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold" style={{ color: 'var(--brand-dark)' }}>
                New recipe for {productName}
              </DialogTitle>
            </DialogHeader>
          </div>

          <div className="px-6 py-5 space-y-4">

            {/* Recipe name */}
            <div>
              <Label htmlFor="recipeName">Recipe name</Label>
              <Input
                id="recipeName"
                value={recipeName}
                onChange={(e) => setRecipeName(e.target.value)}
                placeholder="e.g. Classic Banana Bread, Bulk batch"
                className="mt-1 min-h-11 text-base"
              />
            </div>

            {/* Yield */}
            <div>
              <Label htmlFor="yieldQty">How many units does this recipe make?</Label>
              <Input
                id="yieldQty"
                type="number"
                min="0.01"
                step="0.01"
                inputMode="decimal"
                value={yieldQty}
                onChange={(e) => setYieldQty(e.target.value)}
                className="mt-1 min-h-11 text-base"
              />
              <p className="text-xs text-gray-500 mt-1">
                When you log a run of a different size, ingredients scale automatically.
              </p>
            </div>

            {/* Variant (optional — only show if product has variants) */}
            {variants.length > 0 && (
              <div>
                <Label htmlFor="recipeVariant">Which variant is this for? (optional)</Label>
                <select
                  id="recipeVariant"
                  value={variantId}
                  onChange={(e) => setVariantId(e.target.value)}
                  className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-md text-base min-h-11"
                >
                  <option value="">All variants (shared recipe)</option>
                  {variants.map((v) => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Leave blank if all variants use the same base ingredients.
                </p>
              </div>
            )}

            {/* Ingredient lines */}
            <div>
              <Label>Ingredients</Label>
              <p className="text-xs text-gray-500 mb-2">
                Quantities are in each ingredient&apos;s usage unit (grams, cups, pieces…).
              </p>
              <div className="space-y-2">
                {draftLines.map((line, i) => (
                  <div key={i} className="flex gap-2 items-start">
                    <select
                      value={line.item_id}
                      onChange={(e) => setLine(i, 'item_id', e.target.value)}
                      className="flex-1 px-3 py-2.5 border border-gray-200 rounded-md text-sm min-h-10"
                    >
                      <option value="">Select ingredient</option>
                      {stockItems.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}{s.usage_unit_name ? ` (${s.usage_unit_name})` : ''}
                        </option>
                      ))}
                    </select>
                    <Input
                      type="number"
                      min="0.001"
                      step="0.001"
                      inputMode="decimal"
                      placeholder="Qty"
                      value={line.quantity}
                      onChange={(e) => setLine(i, 'quantity', e.target.value)}
                      className="w-24 min-h-10 text-sm"
                    />
                    {draftLines.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeLine(i)}
                        className="text-gray-300 hover:text-red-500 transition-colors mt-2.5 shrink-0"
                        aria-label="Remove line"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2 text-xs h-8"
                onClick={addLine}
              >
                <Plus size={12} className="mr-1" />
                Add ingredient
              </Button>
            </div>

            {/* Notes */}
            <div>
              <Label htmlFor="recipeNotes">Notes (optional)</Label>
              <Input
                id="recipeNotes"
                value={recipeNotes}
                onChange={(e) => setRecipeNotes(e.target.value)}
                placeholder="e.g. Use ripe bananas only"
                className="mt-1 min-h-10 text-sm"
              />
            </div>

            {/* Cost preview */}
            {draftLines.some((l) => l.item_id && parseFloat(l.quantity) > 0) && (
              <div
                className="rounded-lg border p-3 text-xs"
                style={{ borderColor: 'var(--brand-mid)', backgroundColor: 'var(--brand-light)' }}
              >
                <div className="flex items-start gap-1.5" style={{ color: 'var(--brand-dark)' }}>
                  <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                  <span>
                    Expected cost will show once saved, using your current average stock prices.
                  </span>
                </div>
              </div>
            )}

            <Button
              type="button"
              size="lg"
              className="w-full min-h-12 text-base text-white hover:opacity-90"
              style={{ backgroundColor: 'var(--brand)' }}
              disabled={isSubmitting}
              onClick={handleSave}
            >
              {isSubmitting ? (
                <><Loader2 size={18} className="mr-2 animate-spin" />Saving…</>
              ) : (
                'Save recipe'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
