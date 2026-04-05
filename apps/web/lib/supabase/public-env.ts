/**
 * Public Supabase URL + anon key. During `next build`, env vars may be unset;
 * placeholders let prerender complete. Runtime always needs real values in .env.local.
 */
export function getSupabasePublicConfig(): { url: string; anonKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (url && anonKey) {
    return { url, anonKey }
  }
  return {
    url: 'http://127.0.0.1:54321',
    anonKey:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDI2OTI4MDAsImV4cCI6MTk1ODI2ODgwMH0.build-placeholder',
  }
}
