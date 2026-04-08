import { endOfDay, startOfDay, subMonths } from 'date-fns'
import { fromZonedTime, toDate, toZonedTime } from 'date-fns-tz'

/** Default until per-business settings are editable in product UI. */
export const DEFAULT_BUSINESS_TIMEZONE = 'Africa/Lagos'

const MS_PER_DAY = 86_400_000
const ROLLING_WEEK_MS = 7 * MS_PER_DAY

function calendarDaysFromEventToToday(eventYmd: string, todayYmd: string): number {
  const [ey, em, ed] = eventYmd.split('-').map(Number)
  const [ty, tm, td] = todayYmd.split('-').map(Number)
  const e = Date.UTC(ey, em - 1, ed)
  const t = Date.UTC(ty, tm - 1, td)
  return Math.round((t - e) / MS_PER_DAY)
}

/** Safe fallback when DB value is missing or invalid. */
export function resolveBusinessTimeZone(raw: string | null | undefined): string {
  const t = (raw ?? '').trim()
  if (!t) return DEFAULT_BUSINESS_TIMEZONE
  try {
    Intl.DateTimeFormat(undefined, { timeZone: t }).format(new Date())
    return t
  } catch {
    return DEFAULT_BUSINESS_TIMEZONE
  }
}

/**
 * Current instant in UTC (what the DB uses). Pass the business zone so call sites
 * stay explicit when multiple tenants exist; optional `now` supports tests.
 */
export function getBusinessNow(timeZone: string, now: Date = new Date()): Date {
  void timeZone
  return now
}

/** Interpret `YYYY-MM-DD` as a business-local calendar date; return that local midnight as a UTC `Date`. */
export function utcInstantFromBusinessCalendarDate(ymd: string, timeZone: string): Date {
  const tz = resolveBusinessTimeZone(timeZone)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
    throw new RangeError('Expected YYYY-MM-DD')
  }
  return toDate(`${ymd}T00:00:00`, { timeZone: tz })
}

export function businessCalendarDateToIsoUtc(ymd: string, timeZone: string): string {
  return utcInstantFromBusinessCalendarDate(ymd, timeZone).toISOString()
}

/** Start of the business-local calendar day for `ref`, as a UTC Date. */
export function getStartOfDay(timeZone: string, ref: Date = new Date()): Date {
  const tz = resolveBusinessTimeZone(timeZone)
  const z = toZonedTime(ref, tz)
  const sod = startOfDay(z)
  return fromZonedTime(sod, tz)
}

/** Last millisecond of the business-local calendar day for `ref`, as a UTC Date. */
export function getEndOfDay(timeZone: string, ref: Date = new Date()): Date {
  const tz = resolveBusinessTimeZone(timeZone)
  const z = toZonedTime(ref, tz)
  const eod = endOfDay(z)
  return fromZonedTime(eod, tz)
}

/** `YYYY-MM-DD` for the business-local calendar date of this instant. */
export function formatCalendarDateInTimeZone(instant: Date, timeZone: string): string {
  const tz = resolveBusinessTimeZone(timeZone)
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant)
}

/** Hour 0–23 in the business zone for this instant. */
export function getBusinessHour(timeZone: string, ref: Date = new Date()): number {
  const tz = resolveBusinessTimeZone(timeZone)
  const h = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    hour: 'numeric',
    hour12: false,
  }).format(ref)
  return Number.parseInt(h, 10)
}

export function businessGreetingLabel(timeZone: string, ref: Date = new Date()): string {
  const hour = getBusinessHour(timeZone, ref)
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

/** Rolling windows aligned to business month where relevant; “today” uses local midnight. */
export function salesSinceForDashboardPeriod(
  period: 'today' | 'week' | 'month' | 'all',
  timeZone: string,
  now: Date = new Date()
): Date | null {
  const tz = resolveBusinessTimeZone(timeZone)
  if (period === 'all') return null
  if (period === 'today') return getStartOfDay(tz, now)
  if (period === 'week') return new Date(now.getTime() - ROLLING_WEEK_MS)
  const z = toZonedTime(now, tz)
  return fromZonedTime(subMonths(z, 1), tz)
}

/**
 * Human-friendly calendar label vs “today” in the business zone (DB timestamps are UTC instants).
 */
export function formatFriendlyDate(
  dateInput: string | Date | null | undefined,
  timeZone: string = DEFAULT_BUSINESS_TIMEZONE
): string {
  if (!dateInput) return '-'

  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput
  if (Number.isNaN(date.getTime())) return '-'

  const tz = resolveBusinessTimeZone(timeZone)
  const eventDay = formatCalendarDateInTimeZone(date, tz)
  const todayDay = formatCalendarDateInTimeZone(getBusinessNow(tz), tz)
  const diffDays = calendarDaysFromEventToToday(eventDay, todayDay)

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'

  if (diffDays > 0 && diffDays < 7) {
    return date.toLocaleDateString('en-US', {
      timeZone: tz,
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })
  }

  return date.toLocaleDateString('en-US', {
    timeZone: tz,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

/**
 * Friendly date plus wall time in the business zone.
 */
export function formatFriendlyDateTime(
  dateInput: string | Date | null | undefined,
  timeZone: string = DEFAULT_BUSINESS_TIMEZONE
): string {
  if (!dateInput) return '-'

  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput
  if (Number.isNaN(date.getTime())) return '-'

  const tz = resolveBusinessTimeZone(timeZone)
  const eventDay = formatCalendarDateInTimeZone(date, tz)
  const todayDay = formatCalendarDateInTimeZone(getBusinessNow(tz), tz)
  const diffDays = calendarDaysFromEventToToday(eventDay, todayDay)

  const timeStr = date.toLocaleTimeString('en-US', {
    timeZone: tz,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })

  if (diffDays === 0) return `Today, ${timeStr}`
  if (diffDays === 1) return `Yesterday, ${timeStr}`

  const dateStr = date.toLocaleDateString('en-US', {
    timeZone: tz,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  return `${dateStr}, ${timeStr}`
}
