import { type MaintenancePriority, type MaintenanceStatus } from '@/types'

export const PRIORITY_LABELS: Record<MaintenancePriority, string> = {
  urgent: 'Urgent',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
}

export const STATUS_LABELS: Record<MaintenanceStatus, string> = {
  open: 'Open',
  'in-progress': 'In progress',
  completed: 'Completed',
}

/** Sort rank so "urgent" sorts above "low". */
export const PRIORITY_RANK: Record<MaintenancePriority, number> = { low: 0, medium: 1, high: 2, urgent: 3 }
export const STATUS_RANK: Record<MaintenanceStatus, number> = { open: 0, 'in-progress': 1, completed: 2 }
