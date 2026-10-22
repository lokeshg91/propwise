import { type WorkOrder } from '@/types'

const byCreated = (a: WorkOrder, b: WorkOrder) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)

/**
 * The work order that replaced a cancelled one on the same request (a
 * reassignment): the next one created after it. Cancelling a whole request
 * creates no new work order, so those have no replacement.
 */
export function replacementOf<T extends WorkOrder>(order: WorkOrder, orders: readonly T[]): T | null {
  if (order.status !== 'cancelled') return null
  return [...orders].filter((other) => other.requestId === order.requestId && other.id !== order.id && byCreated(other, order) > 0).sort(byCreated)[0] ?? null
}

/** The cancelled work order this one replaced, if it came from a reassignment. */
export function replacedOrderOf<T extends WorkOrder>(order: WorkOrder, orders: readonly T[]): T | null {
  return [...orders].filter((other) => other.requestId === order.requestId && other.id !== order.id && replacementOf(other, orders)?.id === order.id).sort(byCreated)[0] ?? null
}
