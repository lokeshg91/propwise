import { DEFAULT_CURRENCY, formatMoney, parseCalendarDate, type MoneyFormat } from '@/lib/format'

/**
 * Settings-aware formatting (Phase 9). `createFormatters` builds every money,
 * number and date formatter from the workspace currency and region, and the
 * app shell provides one set to the whole app (`useFormat()`).
 *
 * With the default settings (USD, en-US) every function returns exactly what
 * the fixed helpers in `format.ts` return, so nothing changes until a setting
 * does. The Dashboard keeps the fixed helpers and is always rendered with the
 * default set, so it never follows the workspace settings.
 *
 * Words stay English ("Due today", "2 days ago"); the region only changes
 * number, currency and date formats.
 */
export type FormatSettings = MoneyFormat

export const DEFAULT_FORMAT: FormatSettings = DEFAULT_CURRENCY

export interface Formatters {
  readonly settings: FormatSettings
  /** Integer cents, e.g. 125050 → "$1,250.50"; `whole` drops the cents, `compact` gives "$1.3K". */
  money: (cents: number, options?: { compact?: boolean; whole?: boolean }) => string
  /** Whole-currency values from leases, units and work orders, e.g. 1850 → "$1,850" (no cents, like `formatCurrency`). */
  amount: (value: number, options?: { compact?: boolean }) => string
  /** The currency symbol, e.g. "$" or "€" (input prefixes). */
  symbol: string
  number: (value: number) => string
  /** A percentage value (0–100), e.g. 92.4 → "92.4%" ("92,4%" in en-ZA). Rounds like `formatPercent`. */
  percent: (value: number, fractionDigits?: number) => string
  /** "2026-10-24" → "Oct 24, 2026" (en-US) or "24 Oct 2026" (en-GB). */
  date: (isoDate: string) => string
  /** "2026-10-24" → "Oct 24". */
  shortDate: (isoDate: string) => string
  /** "2026-10-24" → "October 24, 2026" (activity day headings). */
  longDate: (isoDate: string) => string
  /** "2026-10" → "Oct" (short) or "October 2026" (long). */
  month: (period: string, style?: 'short' | 'long') => string
  /** Clock time, e.g. "10:42 AM". */
  time: (iso: string) => string
  /** "Oct 24, 2026, 9:30 AM". */
  dateTime: (iso: string) => string
}

const cache = new Map<string, Formatters>()

export function createFormatters(settings: FormatSettings = DEFAULT_FORMAT): Formatters {
  const key = `${settings.locale}|${settings.currency}`
  const cached = cache.get(key)
  if (cached) return cached
  const { locale, currency } = settings
  const amountFormat = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  })
  const compactAmountFormat = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    notation: 'compact',
    maximumFractionDigits: 1,
  })
  const numberFormat = new Intl.NumberFormat(locale)
  const percentFormats = new Map<number, Intl.NumberFormat>()
  const dateFormat = new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  const shortDateFormat = new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
  })
  const longDateFormat = new Intl.DateTimeFormat(locale, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
  const monthShortFormat = new Intl.DateTimeFormat(locale, { month: 'short' })
  const monthLongFormat = new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric',
  })
  const timeFormat = new Intl.DateTimeFormat(locale, {
    hour: 'numeric',
    minute: '2-digit',
  })
  const dateTimeFormat = new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
  const symbol = new Intl.NumberFormat(locale, { style: 'currency', currency }).formatToParts(0).find((part) => part.type === 'currency')?.value ?? currency
  const formatters: Formatters = {
    settings: { locale, currency },
    money: (cents, options) => formatMoney(cents, settings, options),
    amount: (value, options) => (options?.compact ? compactAmountFormat : amountFormat).format(value),
    symbol,
    number: (value) => numberFormat.format(value),
    percent: (value, fractionDigits = 1) => {
      let format = percentFormats.get(fractionDigits)
      if (!format) {
        format = new Intl.NumberFormat(locale, { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits, useGrouping: false })
        percentFormats.set(fractionDigits, format)
      }
      // Round exactly like `toFixed` (as `formatPercent` does), then apply the region's decimal mark.
      return `${format.format(Number(value.toFixed(fractionDigits)))}%`
    },
    date: (isoDate) => dateFormat.format(parseCalendarDate(isoDate)),
    shortDate: (isoDate) => shortDateFormat.format(parseCalendarDate(isoDate)),
    longDate: (isoDate) => longDateFormat.format(parseCalendarDate(isoDate)),
    month: (period, style = 'short') => {
      const [year, monthIndex] = period.split('-').map(Number)
      const date = new Date(year ?? 1970, (monthIndex ?? 1) - 1, 1)
      return (style === 'short' ? monthShortFormat : monthLongFormat).format(date)
    },
    time: (iso) => timeFormat.format(new Date(iso)),
    dateTime: (iso) => dateTimeFormat.format(new Date(iso)),
  }
  cache.set(key, formatters)
  return formatters
}
