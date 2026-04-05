/**
 * Initials for favicon / avatars — matches `dashboard-layout.tsx` sidebar fallback
 * (first letter of up to two words).
 */
export function businessInitials(businessName: string | null | undefined): string {
  const t = (businessName ?? '').trim()
  if (!t) return '?'
  const parts = t.split(/\s+/).filter(Boolean).slice(0, 2)
  const letters = parts.map((w) => w[0]).join('').toUpperCase()
  return letters || '?'
}
