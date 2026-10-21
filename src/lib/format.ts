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
