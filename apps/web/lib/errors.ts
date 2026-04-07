/**
 * Convert a Supabase/Postgres error into a message that is safe to show in the UI.
 *
 * Rules:
 * - PostgREST infrastructure errors (PGRST*) → generic message, log internally
 * - Postgres system errors (class 42 = syntax/schema, class 28 = auth) → generic, log
 * - Business-logic exceptions raised by our own RPCs (P0001 / RAISE EXCEPTION) → show as-is
 *   because we wrote those messages for users (e.g. "Insufficient stock for flour")
 * - Everything else → show error.message as-is (safe enough for authenticated app)
 */
export function friendlyError(
  err: unknown,
  fallback = 'Something went wrong. Please try again.'
): string {
  if (!err || typeof err !== 'object') return fallback

  const e = err as Record<string, unknown>
  const code = typeof e.code === 'string' ? e.code : ''
  const message = typeof e.message === 'string' ? e.message : ''

  // PostgREST layer errors — expose function signatures, schema names, etc.
  if (code.startsWith('PGRST')) {
    console.error('[db] PostgREST error:', code, message)
    return fallback
  }

  // Postgres class 42 (syntax/schema errors) and class 28 (auth failures)
  if (code.startsWith('42') || code.startsWith('28')) {
    console.error('[db] Schema/auth error:', code, message)
    return fallback
  }

  // Postgres class 23 (integrity violations) — constraint names must never reach the UI
  if (code.startsWith('23')) {
    console.error('[db] Integrity error:', code, message)
    if (code === '23505') return 'That already exists. Try a different name or check for a duplicate.'
    if (code === '23503') return 'This item is still in use and cannot be removed.'
    return fallback
  }

  // Our own RAISE EXCEPTION messages (P0001) — safe to show, we wrote them
  if (code === 'P0001' || code === '') {
    return message || fallback
  }

  return message || fallback
}
