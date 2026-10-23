import { CalendarClock, KeyRound, TriangleAlert } from 'lucide-react'
import { type ReactNode } from 'react'

import { StatusAlert } from '@/components/shared/status-alert'
import { daysBetween, todayIso } from '@/data/domain/dates'
import { useFormat } from '@/hooks/use-format'
import { type Lease, type LeaseDisplayStatus } from '@/types'

/** Explains statuses that need action: holdover, expiring and move-in due. */
export function LeaseAlert({ lease, status, action }: { lease: Lease; status: LeaseDisplayStatus; action?: ReactNode }) {
  const { date: formatDate } = useFormat()
  const today = todayIso()
  switch (status) {
    case 'holdover':
      return (
        <StatusAlert tone="danger" icon={TriangleAlert} title={`Lease ended ${formatDate(lease.endDate)} — not moved out`} action={action}>
          The tenant is in holdover and the unit stays occupied. Renew the lease or record the move-out with End lease.
        </StatusAlert>
      )
    case 'expiring':
      return (
        <StatusAlert tone="warning" icon={CalendarClock} title={`Lease ends in ${daysBetween(today, lease.endDate)} days`} action={action}>
          Renew by editing the lease end date, or end the lease when the tenant moves out.
        </StatusAlert>
      )
    case 'move-in-due':
      return (
        <StatusAlert tone="warning" icon={KeyRound} title={`Move-in was due ${formatDate(lease.startDate)}`} action={action}>
          Mark the tenant as moved in to occupy the unit, or cancel the lease if they won’t be moving in.
        </StatusAlert>
      )
    default:
      return null
  }
}
