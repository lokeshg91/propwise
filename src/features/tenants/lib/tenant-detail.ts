import {
  CalendarCheck,
  CalendarX,
  FileSignature,
  KeyRound,
  type LucideIcon,
  MoveRight,
  UserPen,
  UserPlus,
} from 'lucide-react'

import { type ActivityItem, type ActivityTone } from '@/components/shared/activity-timeline'
import { type TenantDetail } from '@/data/services'
import { type RentCharge, type TenantEventKind } from '@/types'

const EVENT_STYLES: Record<TenantEventKind, { icon: LucideIcon; tone: ActivityTone }> = {
  'tenant-created': { icon: UserPlus, tone: 'primary' },
  'tenant-updated': { icon: UserPen, tone: 'info' },
  'lease-created': { icon: FileSignature, tone: 'primary' },
  'lease-updated': { icon: FileSignature, tone: 'info' },
  'lease-activated': { icon: KeyRound, tone: 'success' },
  'lease-moved': { icon: MoveRight, tone: 'info' },
  'lease-ended': { icon: CalendarCheck, tone: 'neutral' },
  'lease-cancelled': { icon: CalendarX, tone: 'warning' },
}

/**
 * Tenant history: changes made in the app plus lease milestones from the
 * stored lease dates (so seeded tenants have a meaningful history too).
 */
export function buildTenantTimeline(detail: TenantDetail): ActivityItem[] {
  const items: ActivityItem[] = detail.events.map((event) => ({
    id: event.id,
    title: event.title,
    description: event.description,
    createdAt: event.createdAt,
    ...EVENT_STYLES[event.kind],
  }))
  const has = (leaseId: string, kinds: TenantEventKind[]) =>
    detail.events.some((event) => event.leaseId === leaseId && kinds.includes(event.kind))

  // Seeded and migrated leases have no app events; derive their milestones from the lease dates.
  for (const lease of detail.leases) {
    const where = `${lease.propertyName}, ${lease.unitLabel}`
    if (!has(lease.id, ['lease-created'])) {
      const pending = lease.status === 'pending' || (lease.status === 'terminated' && lease.endedAt !== null && lease.endedAt < lease.startDate)
      items.push({
        id: `${lease.id}-start`,
        title: pending ? 'Lease signed' : 'Lease started',
        description: `${where}.`,
        createdAt: pending ? lease.createdAt : `${lease.startDate}T15:00:00.000Z`,
        ...EVENT_STYLES[pending ? 'lease-created' : 'lease-activated'],
      })
    }
    if (lease.endedAt && !has(lease.id, ['lease-ended', 'lease-cancelled'])) {
      items.push({
        id: `${lease.id}-end`,
        title: lease.status === 'terminated' ? 'Lease terminated early' : 'Lease ended',
        description: `Moved out of ${where}.`,
        createdAt: `${lease.endedAt}T15:00:00.000Z`,
        ...EVENT_STYLES['lease-ended'],
      })
    }
  }

  return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function summarizeLedger(ledger: RentCharge[]) {
  const settled = ledger.filter((charge) => charge.status === 'paid')
  const overdue = ledger.filter((charge) => charge.status === 'overdue')
  return {
    paidTotal: settled.reduce((sum, charge) => sum + charge.amount, 0),
    paidCount: settled.length,
    onTimeRate: settled.length === 0 ? 100 : (settled.filter((charge) => !charge.late).length / settled.length) * 100,
    overdueTotal: overdue.reduce((sum, charge) => sum + charge.amount, 0),
    overdueCount: overdue.length,
    next: [...ledger].reverse().find((charge) => charge.status === 'scheduled' || charge.status === 'pending') ?? null,
  }
}
