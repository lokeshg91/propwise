export const MAINTENANCE_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const
export type MaintenancePriority = (typeof MAINTENANCE_PRIORITIES)[number]

export const MAINTENANCE_STATUSES = ['open', 'in-progress', 'completed'] as const
export type MaintenanceStatus = (typeof MAINTENANCE_STATUSES)[number]

export interface MaintenanceRequest {
  /** Human-readable reference, e.g. "MR-2048". */
  id: string
  issue: string
  propertyId: string
  unit: string
  priority: MaintenancePriority
  status: MaintenanceStatus
  /** Vendor name, or null while unassigned. */
  vendor: string | null
  /** ISO timestamps. */
  createdAt: string
  completedAt: string | null
}
