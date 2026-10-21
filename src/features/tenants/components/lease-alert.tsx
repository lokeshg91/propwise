import { CalendarClock, KeyRound, TriangleAlert } from 'lucide-react'
import { type ReactNode } from 'react'

import { daysBetween, todayIso } from '@/data/domain/dates'
import { formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import { type Lease, type LeaseDisplayStatus } from '@/types'

/** Explains statuses that need action: holdover, expiring and move-in due. */
export function LeaseAlert({ lease, status, action }: { lease: Lease; status: LeaseDisplayStatus; action?: ReactNode }) {
  const today = todayIso()
  const content =
    status === 'holdover'
      ? {
          icon: TriangleAlert,
          tone: 'border-danger/30 bg-danger/10 text-danger dark:bg-danger/15',
          title: `Lease ended ${formatDate(lease.endDate)} — not moved out`,
          body: 'The tenant is in holdover and the unit stays occupied. Renew the lease or record the move-out with End lease.',
        }
      : status === 'expiring'
        ? {
            icon: CalendarClock,
            tone: 'border-warning/30 bg-warning/10 text-warning dark:bg-warning/15',
            title: `Lease ends in ${daysBetween(today, lease.endDate)} days`,
            body: `Renew by editing the lease end date, or end the lease when the tenant moves out.`,
          }
        : status === 'move-in-due'
          ? {
              icon: KeyRound,
              tone: 'border-warning/30 bg-warning/10 text-warning dark:bg-warning/15',
              title: `Move-in was due ${formatDate(lease.startDate)}`,
              body: 'Mark the tenant as moved in to occupy the unit, or cancel the lease if they won’t be moving in.',
            }
          : null
  if (!content) return null
  const Icon = content.icon

  return (
    <div role="status" className={cn('flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center', content.tone)}>
      <Icon className="size-5 shrink-0 max-sm:hidden" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-body font-semibold">{content.title}</p>
        <p className="text-caption text-foreground/80">{content.body}</p>
      </div>
      {action ? <div className="flex shrink-0 gap-2">{action}</div> : null}
    </div>
  )
}
