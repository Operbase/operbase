import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import {
  ONBOARDED_COOKIE_NAME,
  onboardedCookieBaseOptions,
} from '@/lib/auth/cookies'
import { getSupabasePublicConfig } from '@/lib/supabase/public-env'

/**
 * Server-side logout: revokes the session cookies and clears app-only cookies (e.g. ob_onboarded)
 * in the same response. Client-side signOut() alone cannot remove httpOnly cookies, which caused
 * a one-request stale onboarded flag after logout.
 */
export async function POST() {
  const cookieStore = await cookies()
  const { url, anonKey } = getSupabasePublicConfig()

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        } catch {
          // ignore
        }
      },
    },
  })

  await supabase.auth.signOut()

  cookieStore.set(ONBOARDED_COOKIE_NAME, '', {
    maxAge: 0,
    ...onboardedCookieBaseOptions(),
  })

  return NextResponse.json({ ok: true })
}
