import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { getSupabasePublicConfig } from '@/lib/supabase/public-env'

const ONBOARDED_COOKIE = 'ob_onboarded'
const ONBOARDED_MAX_AGE = 60 * 60 // 1 hour — refresh daily

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })
  const { url, anonKey } = getSupabasePublicConfig()

  const supabase = createServerClient(
    url,
    anonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  if (!user) {
    supabaseResponse.cookies.delete(ONBOARDED_COOKIE)
  }

  // Signed-in users skip the marketing home page
  if (user && pathname === '/') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Redirect unauthenticated users away from protected routes
  if (!user && pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Redirect unauthenticated users away from onboarding
  if (!user && pathname === '/onboarding') {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Redirect authenticated users away from auth pages
  if (user && (pathname === '/login' || pathname === '/signup')) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // For authenticated users going to dashboard, check onboarding
  // Use a short-lived cookie to skip the DB check on most requests
  const onboardedCookie = request.cookies.get(ONBOARDED_COOKIE)
  if (user && pathname.startsWith('/dashboard')) {
    if (!onboardedCookie) {
      // First request after login — verify onboarding status from DB
      const { data: business } = await supabase
        .from('user_businesses')
        .select('business_id')
        .eq('user_id', user.id)
        // Phase 1: single business per user
        .limit(1)
        .maybeSingle()

      if (!business) {
        return NextResponse.redirect(new URL('/onboarding', request.url))
      }

      // Set a cookie so subsequent requests skip the DB check
      supabaseResponse.cookies.set(ONBOARDED_COOKIE, '1', {
        maxAge: ONBOARDED_MAX_AGE,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
      })
    }
    // Cookie present — trust it, no DB query needed
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
