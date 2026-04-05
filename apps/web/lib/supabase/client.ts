import { createBrowserClient } from '@supabase/ssr'
import { getSupabasePublicConfig } from './public-env'

export function createClient() {
  const { url, anonKey } = getSupabasePublicConfig()
  return createBrowserClient(url, anonKey)
}
