/**
 * Mock records are expressed relative to the moment the app loads, so the
 * demo always shows recent activity and upcoming due dates.
 */
const DAY = 24 * 60 * 60 * 1000

export const mockNow = new Date()

export function minutesAgo(minutes: number): string {
  return new Date(mockNow.getTime() - minutes * 60_000).toISOString()
}

export function daysAgo(days: number): string {
  return new Date(mockNow.getTime() - days * DAY).toISOString()
}

/** Calendar date (YYYY-MM-DD) relative to today. Negative values are in the past. */
export function dateFromToday(days: number): string {
  const date = new Date(mockNow.getFullYear(), mockNow.getMonth(), mockNow.getDate() + days)
  return toIsoDate(date)
}

export function monthsAgo(months: number, day = 1): string {
  return toIsoDate(new Date(mockNow.getFullYear(), mockNow.getMonth() - months, day))
}

function toIsoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}
