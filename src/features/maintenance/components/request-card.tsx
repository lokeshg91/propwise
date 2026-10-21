import { Link } from 'react-router'

import { MaintenancePriorityBadge } from '@/features/maintenance/components/maintenance-badges'
import { RequestActionsMenu } from '@/features/maintenance/components/request-actions-menu'
import { CategoryLabel, InactiveVendorBadge, RequestStatusBadge, TimingText } from '@/features/maintenance/components/request-badges'
import { type RequestRow } from '@/features/maintenance/lib/request-list'
import { timingLine } from '@/features/maintenance/lib/request-time'
import { formatRelativeTime } from '@/lib/format'

/** Card layout for request lists on tablet and mobile. */
export function RequestCard({ row, showProperty = true }: { row: RequestRow; showProperty?: boolean }) {
  const { timing, text } = timingLine(row.request)
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <Link
            to={`/maintenance/${row.id}`}
            className="block truncate rounded-sm text-body font-medium text-foreground outline-none hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {row.title}
          </Link>
          <p className="flex flex-wrap items-center gap-x-2 text-caption">
            <span className="text-muted-foreground tabular-nums">{row.id}</span>
            <CategoryLabel category={row.category} />
          </p>
        </div>
        <RequestActionsMenu id={row.id} editable={row.status !== 'cancelled'} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <RequestStatusBadge status={row.status} />
        <MaintenancePriorityBadge priority={row.priority} />
        <TimingText timing={timing} text={text} />
      </div>
      <p className="truncate text-caption text-muted-foreground">
        {showProperty ? `${row.propertyName} · ` : ''}
        {row.locationLabel}
        {row.tenantName ? ` · ${row.tenantName}` : ''}
      </p>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-border pt-3 text-caption">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className={row.vendorName ? 'truncate text-foreground' : 'text-muted-foreground'}>{row.vendorName || 'Unassigned'}</span>
          {row.vendorName && !row.vendorActive ? <InactiveVendorBadge /> : null}
        </span>
        <span className="text-muted-foreground">Opened {formatRelativeTime(row.createdAt)}</span>
      </div>
    </div>
  )
}
