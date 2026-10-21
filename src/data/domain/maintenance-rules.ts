import { addHours, hoursBetween } from '@/data/domain/dates'
import {
  ACTIVE_REQUEST_STATUSES,
  type MaintenancePriority,
  type RequestStatus,
  type ServiceRequest,
  type WorkOrder,
} from '@/types'

/** Resolution targets per priority, in hours. Edit to match your service levels. */
export const SLA_HOURS: Record<MaintenancePriority, number> = {
  urgent: 24,
  high: 72,
  medium: 7 * 24,
  low: 14 * 24,
}

/** Completed requests can be reopened for this many days. */
export const REOPEN_WINDOW_DAYS = 30

/** Share of the SLA window left at which a request is flagged "due soon". */
const DUE_SOON_SHARE = 0.25

export const dueAtFor = (createdAt: string, priority: MaintenancePriority) => addHours(createdAt, SLA_HOURS[priority])

export function isActiveRequest(request: Pick<ServiceRequest, 'status'>): boolean {
  return (ACTIVE_REQUEST_STATUSES as readonly RequestStatus[]).includes(request.status)
}

export function isActiveWorkOrder(order: Pick<WorkOrder, 'status'>): boolean {
  return order.status === 'scheduled' || order.status === 'in-progress'
}

/* ------------------------------------------------------------ transitions */

export const REQUEST_ACTIONS = [
  'assign',
  'reassign',
  'reschedule',
  'start',
  'hold',
  'resume',
  'complete',
  'cancel',
  'reopen',
] as const
export type RequestAction = (typeof REQUEST_ACTIONS)[number]

/**
 * The single source of truth for the lifecycle. The UI uses it to decide which
 * actions to show; the service uses it to reject anything else.
 *
 * open → scheduled → in-progress → completed, with on-hold from scheduled or
 * in-progress, cancel from any active status (final), and reopen of a
 * completed request within the reopen window.
 */
export const TRANSITIONS: Record<RequestAction, { from: readonly RequestStatus[]; needsWorkOrder: boolean }> = {
  assign: { from: ['open'], needsWorkOrder: false },
  reassign: { from: ['scheduled', 'in-progress', 'on-hold'], needsWorkOrder: true },
  reschedule: { from: ['scheduled'], needsWorkOrder: true },
  start: { from: ['scheduled'], needsWorkOrder: true },
  hold: { from: ['scheduled', 'in-progress'], needsWorkOrder: true },
  resume: { from: ['on-hold'], needsWorkOrder: true },
  complete: { from: ['scheduled', 'in-progress', 'on-hold'], needsWorkOrder: true },
  cancel: { from: ['open', 'scheduled', 'in-progress', 'on-hold'], needsWorkOrder: false },
  reopen: { from: ['completed'], needsWorkOrder: false },
}

export interface TransitionCheck {
  allowed: boolean
  reason?: string
}

/** Whether `action` is allowed for the request right now. */
export function checkTransition(
  request: Pick<ServiceRequest, 'status' | 'completedAt'>,
  action: RequestAction,
  options: { hasActiveWorkOrder: boolean; now?: Date },
): TransitionCheck {
  const rule = TRANSITIONS[action]
  if (request.status === 'cancelled') return { allowed: false, reason: 'Cancelled requests are closed and can’t be changed.' }
  if (action === 'assign' && options.hasActiveWorkOrder) {
    return { allowed: false, reason: 'This request already has an active work order. Reassign it instead.' }
  }
  if (rule.needsWorkOrder && request.status === 'open') return { allowed: false, reason: 'Assign a vendor first.' }
  if (!rule.from.includes(request.status)) {
    return { allowed: false, reason: `Can’t ${action} a request that is ${request.status.replace('-', ' ')}.` }
  }
  if (rule.needsWorkOrder && !options.hasActiveWorkOrder) {
    return { allowed: false, reason: 'Assign a vendor first.' }
  }
  if (action === 'reopen') {
    if (!request.completedAt) return { allowed: false, reason: 'This request has no completion date.' }
    const days = hoursBetween(request.completedAt, (options.now ?? new Date()).toISOString()) / 24
    if (days > REOPEN_WINDOW_DAYS) {
      return { allowed: false, reason: `Completed requests can only be reopened within ${REOPEN_WINDOW_DAYS} days.` }
    }
  }
  return { allowed: true }
}

/** Every action allowed now, in display order. */
export function availableActions(
  request: Pick<ServiceRequest, 'status' | 'completedAt'>,
  options: { hasActiveWorkOrder: boolean; now?: Date },
): RequestAction[] {
  return REQUEST_ACTIONS.filter((action) => checkTransition(request, action, options).allowed)
}

/* ---------------------------------------------------------- display state */

export type RequestTiming = 'overdue' | 'due-soon' | 'on-track' | 'closed'

/** Derived, never stored: whether an active request is past or near its SLA. */
export function getRequestTiming(
  request: Pick<ServiceRequest, 'status' | 'dueAt' | 'priority'>,
  now: Date = new Date(),
): RequestTiming {
  if (!isActiveRequest(request)) return 'closed'
  const left = hoursBetween(now.toISOString(), request.dueAt)
  if (left < 0) return 'overdue'
  return left <= SLA_HOURS[request.priority] * DUE_SOON_SHARE ? 'due-soon' : 'on-track'
}
