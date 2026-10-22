import {
  ArrowRightLeft,
  CircleCheckBig,
  CircleX,
  type LucideIcon,
  Pencil,
  UserCheck,
  UserPlus,
  UserRoundCheck,
  UserRoundX,
} from 'lucide-react'

import { type ActivityItem, type ActivityTone } from '@/components/shared/activity-timeline'
import { isActiveWorkOrder } from '@/data/domain/maintenance-rules'
import { type VendorDetail, type VendorWorkOrder } from '@/data/services'
import { formatCurrency } from '@/lib/format'
import { type VendorEventKind } from '@/types'

export const WORK_ORDER_GROUPS = ['ongoing', 'completed', 'cancelled', 'all'] as const
export type WorkOrderGroup = (typeof WORK_ORDER_GROUPS)[number]

export const WORK_ORDER_GROUP_LABELS: Record<WorkOrderGroup, string> = {
  ongoing: 'Ongoing',
  completed: 'Completed',
  cancelled: 'Cancelled',
  all: 'All',
}

export function matchesWorkOrderGroup(entry: VendorWorkOrder, group: WorkOrderGroup): boolean {
  if (group === 'all') return true
  if (group === 'ongoing') return isActiveWorkOrder(entry.order)
  return entry.order.status === group
}

/** "Harbor View Residences · Unit 204" or the common-area name. */
export function locationText(entry: Pick<VendorWorkOrder, 'property' | 'unit' | 'area'>): string {
  const where = entry.unit ? `${entry.property?.type === 'commercial' ? 'Suite' : 'Unit'} ${entry.unit.number}` : (entry.area ?? 'Common area')
  return `${entry.property?.name ?? 'Property'} · ${where}`
}

const EVENT_STYLES: Record<VendorEventKind, { icon: LucideIcon; tone: ActivityTone }> = {
  created: { icon: UserPlus, tone: 'primary' },
  updated: { icon: Pencil, tone: 'info' },
  deactivated: { icon: UserRoundX, tone: 'neutral' },
  reactivated: { icon: UserRoundCheck, tone: 'success' },
}

/**
 * Vendor history: profile events (which keep the name the vendor had at the
 * time) plus job milestones from its work orders. Newest first.
 */
export function buildVendorTimeline(detail: Pick<VendorDetail, 'vendor' | 'events' | 'workOrders'>): ActivityItem[] {
  const items: ActivityItem[] = detail.events.map((event) => ({
    id: event.id,
    title: event.title,
    description: event.vendorName !== detail.vendor.name ? `${event.description} Recorded as “${event.vendorName}”.` : event.description,
    createdAt: event.createdAt,
    ...EVENT_STYLES[event.kind],
  }))

  for (const entry of detail.workOrders) {
    const { order, request } = entry
    const label = request ? `${request.id}: ${request.title}` : order.requestId
    items.push({
      id: `${order.id}-assigned`,
      title: `Assigned ${request?.id ?? order.requestId}`,
      description: `${label} — ${locationText(entry)}.`,
      createdAt: order.createdAt,
      icon: UserCheck,
      tone: 'primary',
    })
    if (order.status === 'completed' && order.completedAt) {
      items.push({
        id: `${order.id}-completed`,
        title: `Completed ${request?.id ?? order.requestId}`,
        description: order.actualCost !== null ? `Final cost ${formatCurrency(order.actualCost)}.` : 'No final cost recorded.',
        createdAt: order.completedAt,
        icon: CircleCheckBig,
        tone: 'success',
      })
    }
    if (order.status === 'cancelled' && order.cancelledAt) {
      items.push({
        id: `${order.id}-cancelled`,
        title: entry.replacedBy ? `Reassigned away from ${request?.id ?? order.requestId}` : `Work order ${order.id} cancelled`,
        description: entry.replacedBy ? `The job moved to ${entry.replacedBy.vendorName} (${entry.replacedBy.workOrderId}).` : 'The request was cancelled.',
        createdAt: order.cancelledAt,
        icon: entry.replacedBy ? ArrowRightLeft : CircleX,
        tone: 'neutral',
      })
    }
  }
  return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}
