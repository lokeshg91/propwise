import { type PropertyDetail } from '@/data/services'
import { formatCurrency } from '@/lib/format'
import { type Unit, type UnitType } from '@/types'

export type TimelineCategory = 'property' | 'unit' | 'tenant' | 'lease' | 'payment' | 'maintenance' | 'completed'

export interface TimelineItem {
  id: string
  category: TimelineCategory
  title: string
  description: string
  /** ISO timestamp. */
  createdAt: string
}

/** Merges app changes, portfolio activity, maintenance and payments into one timeline, newest first. */
export function buildPropertyTimeline(detail: PropertyDetail): TimelineItem[] {
  const { property } = detail
  const items: TimelineItem[] = []

  for (const event of detail.events) {
    items.push({
      id: event.id,
      category: event.kind.startsWith('unit') ? 'unit' : 'property',
      title: event.title,
      description: event.description,
      createdAt: event.createdAt,
    })
  }

  for (const activity of detail.activities) {
    const category: TimelineCategory =
      activity.type === 'payment-received'
        ? 'payment'
        : activity.type === 'maintenance-created'
          ? 'maintenance'
          : activity.type === 'work-order-completed'
            ? 'completed'
            : activity.type === 'lease-signed'
              ? 'lease'
              : activity.type === 'property-added'
                ? 'property'
                : 'tenant'
    // Maintenance activity is covered by the request records below.
    if (category === 'maintenance' || category === 'completed') continue
    items.push({ id: activity.id, category, title: activity.title, description: activity.description, createdAt: activity.createdAt })
  }

  for (const request of detail.maintenanceRequests) {
    const where = request.unit
    items.push({
      id: `${request.id}-created`,
      category: 'maintenance',
      title: `${request.id} reported`,
      description: `${request.issue} — ${where}`,
      createdAt: request.createdAt,
    })
    if (request.completedAt) {
      items.push({
        id: `${request.id}-completed`,
        category: 'completed',
        title: `${request.id} completed`,
        description: `${request.issue} resolved${request.vendor ? ` by ${request.vendor}` : ''}`,
        createdAt: request.completedAt,
      })
    }
  }

  for (const payment of detail.payments) {
    if (!payment.paidAt) continue
    const alreadyLogged = items.some((item) => item.category === 'payment' && item.description.includes(payment.tenantName))
    if (alreadyLogged) continue
    items.push({
      id: `${payment.id}-paid`,
      category: 'payment',
      title: 'Rent payment received',
      description: `${payment.tenantName} paid ${formatCurrency(payment.amount)} — ${payment.unit}`,
      createdAt: payment.paidAt,
    })
  }

  if (!items.some((item) => item.title === 'Property added')) {
    items.push({
      id: `${property.id}-acquired`,
      category: 'property',
      title: 'Joined the portfolio',
      description: `${property.name} was added with ${property.totalUnits} units.`,
      createdAt: `${property.acquiredAt.slice(0, 10)}T12:00:00.000Z`,
    })
  }

  return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export interface UnitStats {
  added: number
  notAdded: number
  occupied: number
  vacant: number
  maintenance: number
  /** Occupancy against total units (capacity), 0–100. */
  occupancyRate: number
  averageRent: number
  byType: Array<{ type: UnitType; count: number; occupied: number; averageRent: number }>
}

export function getUnitStats(units: Unit[], totalUnits: number): UnitStats {
  const occupied = units.filter((unit) => unit.status === 'occupied')
  const byType = new Map<UnitType, Unit[]>()
  for (const unit of units) byType.set(unit.type, [...(byType.get(unit.type) ?? []), unit])
  const average = (list: Unit[]) => (list.length === 0 ? 0 : list.reduce((sum, unit) => sum + unit.rent, 0) / list.length)

  return {
    added: units.length,
    notAdded: Math.max(0, totalUnits - units.length),
    occupied: occupied.length,
    vacant: units.filter((unit) => unit.status === 'vacant').length,
    maintenance: units.filter((unit) => unit.status === 'maintenance').length,
    occupancyRate: totalUnits === 0 ? 0 : (occupied.length / totalUnits) * 100,
    averageRent: average(occupied),
    byType: [...byType.entries()]
      .map(([type, list]) => ({
        type,
        count: list.length,
        occupied: list.filter((unit) => unit.status === 'occupied').length,
        averageRent: average(list),
      }))
      .sort((a, b) => b.count - a.count),
  }
}
