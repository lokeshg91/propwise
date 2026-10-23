import { useFormat } from '@/hooks/use-format'

/**
 * Settings-aware values for places that can't call `useFormat()` themselves,
 * such as table column definitions declared at module level. Each renders
 * plain text in the workspace currency and region.
 */

/** Whole-currency amount (leases, units, work orders), e.g. "$1,850"; `null` → "—". */
export function FormattedAmount({ value }: { value: number | null }) {
  const { amount } = useFormat()
  return value === null ? '—' : amount(value)
}

/** Calendar date, e.g. "Oct 24, 2026". */
export function FormattedDate({ value }: { value: string }) {
  const { date } = useFormat()
  return date(value)
}

/** Date and time, e.g. "Oct 24, 2026, 9:30 AM". */
export function FormattedDateTime({ value }: { value: string }) {
  const { dateTime } = useFormat()
  return dateTime(value)
}

/** Plain number with the region's grouping, e.g. "12,400". */
export function FormattedNumber({ value }: { value: number }) {
  const { number } = useFormat()
  return number(value)
}

/** Percentage value (0–100), e.g. "92.4%"; `null` → "—". */
export function FormattedPercent({ value, fractionDigits }: { value: number | null; fractionDigits?: number }) {
  const { percent } = useFormat()
  return value === null ? '—' : percent(value, fractionDigits)
}
