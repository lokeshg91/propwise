const relativeTimeFormat = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

const UNITS: ReadonlyArray<[Intl.RelativeTimeFormatUnit, number]> = [
  ['year', 60 * 60 * 24 * 365],
  ['month', 60 * 60 * 24 * 30],
  ['week', 60 * 60 * 24 * 7],
  ['day', 60 * 60 * 24],
  ['hour', 60 * 60],
  ['minute', 60],
]

/** Formats an ISO date relative to now, e.g. "12 minutes ago" or "yesterday". */
export function formatRelativeTime(isoDate: string, now: Date = new Date()): string {
  const seconds = Math.round((new Date(isoDate).getTime() - now.getTime()) / 1000)

  for (const [unit, unitSeconds] of UNITS) {
    if (Math.abs(seconds) >= unitSeconds) {
      return relativeTimeFormat.format(Math.round(seconds / unitSeconds), unit)
    }
  }

  return 'just now'
}

/** Returns up to two initials from a full name, e.g. "Alex Morgan" → "AM". */
export function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
}

const currencyFormat = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

const compactCurrencyFormat = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 1,
})

const numberFormat = new Intl.NumberFormat('en-US')

/** Formats USD, e.g. `$148,250` or compact `$148.3K`. */
export function formatCurrency(value: number, options: { compact?: boolean } = {}): string {
  return options.compact ? compactCurrencyFormat.format(value) : currencyFormat.format(value)
}

export function formatNumber(value: number): string {
  return numberFormat.format(value)
}

/** Formats a percentage value (0–100), e.g. `92.4%`. */
export function formatPercent(value: number, fractionDigits = 1): string {
  return `${value.toFixed(fractionDigits)}%`
}

/** Prefixes positive numbers with "+" and uses a true minus sign for negatives. */
export function formatSigned(value: number, format: (absolute: number) => string): string {
  if (value === 0) return format(0)
  return `${value > 0 ? '+' : '−'}${format(Math.abs(value))}`
}

/** "2026-10" → "Oct" (short) or "October 2026" (long). */
export function formatMonth(month: string, style: 'short' | 'long' = 'short'): string {
  const [year, monthIndex] = month.split('-').map(Number)
  const date = new Date(year ?? 1970, (monthIndex ?? 1) - 1, 1)
  return style === 'short'
    ? date.toLocaleDateString('en-US', { month: 'short' })
    : date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

/** Parses a calendar date (YYYY-MM-DD) as local time. */
export function parseCalendarDate(isoDate: string): Date {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1)
}

/** "2026-10-24" → "Oct 24". */
export function formatShortDate(isoDate: string): string {
  return parseCalendarDate(isoDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/** Whole days from `now` until a calendar date (negative when past). */
export function daysUntil(isoDate: string, now: Date = new Date()): number {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((parseCalendarDate(isoDate).getTime() - today.getTime()) / 86_400_000)
}

/** Human-friendly due label, e.g. "Due today", "Due in 3 days", "4 days overdue". */
export function formatDueLabel(isoDate: string, now: Date = new Date()): string {
  const days = daysUntil(isoDate, now)
  if (days === 0) return 'Due today'
  if (days === 1) return 'Due tomorrow'
  if (days > 1) return `Due in ${days} days`
  return days === -1 ? '1 day overdue' : `${Math.abs(days)} days overdue`
}

/** Short clock time, e.g. "10:42 AM". */
export function formatTime(isoDate: string): string {
  return new Date(isoDate).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

/** "2026-10-24" → "Oct 24, 2026". */
export function formatDate(isoDate: string): string {
  return parseCalendarDate(isoDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
