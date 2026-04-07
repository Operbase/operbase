/**
 * App-specific auth-related cookies (not Supabase session cookies).
 * Keep names and option shapes in one place so logout can clear what middleware sets.
 */
export const ONBOARDED_COOKIE_NAME = 'ob_onboarded'

/** Short-lived hint: user has a business row; avoids DB read on every dashboard hit. */
export const ONBOARDED_COOKIE_MAX_AGE_SEC = 60 * 60

export function onboardedCookieBaseOptions() {
  return {
    path: '/' as const,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
  }
}
