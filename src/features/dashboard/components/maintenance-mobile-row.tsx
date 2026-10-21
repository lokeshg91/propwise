import { MaintenancePriorityBadge, MaintenanceStatusBadge } from '@/features/maintenance/components/maintenance-badges'
import { formatRelativeTime } from '@/lib/format'
import { type MaintenanceRequestRow } from '@/types'

/** Compact card used for the maintenance table on small screens. */
export function MaintenanceMobileRow({ row }: { row: MaintenanceRequestRow }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-caption text-muted-foreground">{row.id}</span>
        <span className="flex items-center gap-1.5">
          <MaintenancePriorityBadge priority={row.priority} />
          <MaintenanceStatusBadge status={row.status} />
        </span>
      </div>
      <div>
        <p className="text-body font-medium text-foreground">{row.issue}</p>
        <p className="text-caption text-muted-foreground">
          {row.propertyName} · {row.unit}
        </p>
      </div>
      <p className="flex justify-between gap-3 text-caption">
        <span className={row.vendor ? 'text-foreground' : 'text-muted-foreground italic'}>
          {row.vendor ?? 'Unassigned'}
        </span>
        <time dateTime={row.createdAt} className="shrink-0 text-muted-foreground">
          {formatRelativeTime(row.createdAt)}
        </time>
      </p>
    </div>
  )
}
