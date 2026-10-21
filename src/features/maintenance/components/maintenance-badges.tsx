import { Badge } from '@/components/ui/badge'
import { PRIORITY_LABELS, STATUS_LABELS } from '@/features/maintenance/lib/maintenance-meta'
import { type MaintenancePriority, type MaintenanceStatus } from '@/types'

const PRIORITY_VARIANT: Record<MaintenancePriority, 'danger' | 'warning' | 'info' | 'neutral'> = {
  urgent: 'danger',
  high: 'warning',
  medium: 'info',
  low: 'neutral',
}

const STATUS_VARIANT: Record<MaintenanceStatus, 'brand' | 'warning' | 'success'> = {
  open: 'brand',
  'in-progress': 'warning',
  completed: 'success',
}

export function MaintenancePriorityBadge({ priority }: { priority: MaintenancePriority }) {
  return (
    <Badge variant={PRIORITY_VARIANT[priority]}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {PRIORITY_LABELS[priority]}
    </Badge>
  )
}

export function MaintenanceStatusBadge({ status }: { status: MaintenanceStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABELS[status]}</Badge>
}
