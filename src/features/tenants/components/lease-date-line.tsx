import { leaseDateLine } from '@/features/tenants/lib/lease-dates'
import { useFormat } from '@/hooks/use-format'
import { type LeaseDisplayStatus } from '@/types'

/** `leaseDateLine` in the workspace date format, for table cells. */
export function LeaseDateLine({ status, dates }: { status: LeaseDisplayStatus; dates: { start: string; end: string; endedAt?: string | null } }) {
  const { date } = useFormat()
  return leaseDateLine(status, dates, date)
}
