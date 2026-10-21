import { type MaintenancePriority } from './maintenance'

/**
 * Stored maintenance requests (the Maintenance module). The Dashboard keeps
 * its own snapshot type, `MaintenanceRequest`, in `maintenance.ts`.
 */
export const REQUEST_STATUSES = ['open', 'scheduled', 'in-progress', 'on-hold', 'completed', 'cancelled'] as const
export type RequestStatus = (typeof REQUEST_STATUSES)[number]

/** Statuses where work is still outstanding. */
export const ACTIVE_REQUEST_STATUSES = ['open', 'scheduled', 'in-progress', 'on-hold'] as const satisfies readonly RequestStatus[]

export const REQUEST_CATEGORIES = [
  'plumbing',
  'electrical',
  'hvac',
  'appliance',
  'general',
  'locks-security',
  'pest',
  'landscaping',
  'cleaning',
  'elevator',
  'roofing',
  'other',
] as const
export type RequestCategory = (typeof REQUEST_CATEGORIES)[number]

export const REQUEST_SOURCES = ['tenant', 'staff', 'inspection'] as const
export type RequestSource = (typeof REQUEST_SOURCES)[number]

export const HOLD_REASONS = ['parts', 'access', 'tenant', 'approval', 'weather', 'other'] as const
export type HoldReason = (typeof HOLD_REASONS)[number]

export interface ServiceRequest {
  /** Human-readable reference, e.g. "MR-2062". */
  id: string
  title: string
  description: string
  category: RequestCategory
  priority: MaintenancePriority
  status: RequestStatus
  propertyId: string
  /** The unit the work is in, or null for a common area. */
  unitId: string | null
  /** Common-area label ("Lobby", "Level P2") when there is no unit. */
  area: string | null
  /** Tenant who reported or is affected by the issue. */
  tenantId: string | null
  source: RequestSource
  permissionToEnter: boolean
  accessNotes: string
  /** Resolution target (ISO timestamp) from the priority's SLA. */
  dueAt: string
  /** True when creating this request put a vacant unit under maintenance. */
  unitTakenOffline: boolean
  /** While on hold: why, and the status to resume to. */
  hold: { reason: HoldReason; note: string; from: 'scheduled' | 'in-progress' } | null
  reopenCount: number
  createdAt: string
  updatedAt: string
  completedAt: string | null
  cancelledAt: string | null
  cancelReason: string | null
}

export const WORK_ORDER_STATUSES = ['scheduled', 'in-progress', 'completed', 'cancelled'] as const
export type WorkOrderStatus = (typeof WORK_ORDER_STATUSES)[number]

/** A vendor job for a request. A request has at most one active (scheduled or in-progress) work order. */
export interface WorkOrder {
  /** e.g. "WO-2059-1": request number plus a per-request counter. */
  id: string
  requestId: string
  vendorId: string
  status: WorkOrderStatus
  /** Planned visit (ISO timestamp), if scheduled. */
  scheduledFor: string | null
  estimatedCost: number | null
  /** Final cost, kept once completed. Not an invoice. */
  actualCost: number | null
  notes: string
  createdAt: string
  updatedAt: string
  completedAt: string | null
  cancelledAt: string | null
}

export const MAINTENANCE_EVENT_KINDS = [
  'created',
  'updated',
  'priority-changed',
  'assigned',
  'reassigned',
  'rescheduled',
  'started',
  'on-hold',
  'resumed',
  'completed',
  'cancelled',
  'reopened',
  'unit-offline',
  'unit-returned',
] as const
export type MaintenanceEventKind = (typeof MAINTENANCE_EVENT_KINDS)[number]

export interface MaintenanceEvent {
  id: string
  requestId: string
  kind: MaintenanceEventKind
  title: string
  description: string
  createdAt: string
}

/** Fields set when creating or editing a request. Status and vendor change through actions. */
export interface ServiceRequestInput {
  title: string
  description: string
  category: RequestCategory
  priority: MaintenancePriority
  propertyId: string
  unitId: string | null
  area: string | null
  tenantId: string | null
  source: RequestSource
  permissionToEnter: boolean
  accessNotes: string
}

export interface WorkOrderInput {
  vendorId: string
  scheduledFor: string | null
  estimatedCost: number | null
  notes: string
}
