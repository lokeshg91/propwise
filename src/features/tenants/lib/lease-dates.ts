import { type LeaseDisplayStatus } from '@/types'

/** One-line date context for a lease status, e.g. "Ends Oct 24, 2027" (`formatDate` is the workspace date format). */
export function leaseDateLine(
  status: LeaseDisplayStatus,
  dates: { start: string; end: string; endedAt?: string | null },
  formatDate: (isoDate: string) => string,
): string {
  switch (status) {
    case 'active':
    case 'expiring':
      return `Ends ${formatDate(dates.end)}`
    case 'holdover':
      return `Lease ended ${formatDate(dates.end)} — not moved out`
    case 'pending':
      return `Moves in ${formatDate(dates.start)}`
    case 'move-in-due':
      return `Move-in was due ${formatDate(dates.start)}`
    case 'expired':
    case 'terminated':
      return `Ended ${formatDate(dates.endedAt ?? dates.end)}`
  }
}
