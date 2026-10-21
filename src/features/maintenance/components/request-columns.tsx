import { Link } from 'react-router'

import { createDataTableColumnHelper } from '@/components/tables/data-table-features'
import { MaintenancePriorityBadge } from '@/features/maintenance/components/maintenance-badges'
import { RequestActionsMenu } from '@/features/maintenance/components/request-actions-menu'
import { CategoryLabel, InactiveVendorBadge, RequestStatusBadge, TimingText } from '@/features/maintenance/components/request-badges'
import { type RequestRow } from '@/features/maintenance/lib/request-list'
import { REQUEST_STATUS_LABELS } from '@/features/maintenance/lib/request-meta'
import { timingLine } from '@/features/maintenance/lib/request-time'
import { formatRelativeTime } from '@/lib/format'

const column = createDataTableColumnHelper<RequestRow>()

const linkClass =
  'rounded-sm outline-none hover:text-primary hover:underline focus-visible:ring-3 focus-visible:ring-ring/50'

/** Columns for request tables. `showProperty: false` hides the property (used on a property's own page). */
export function createRequestColumns({ showProperty = true }: { showProperty?: boolean } = {}) {
  return column.columns([
    column.accessor('searchText', {
      id: 'request',
      header: 'Request',
      // Sort by request number, search across all the request text.
      sortFn: (a, b) => a.original.id.localeCompare(b.original.id, 'en', { numeric: true }),
      cell: (info) => {
        const row = info.row.original
        return (
          <span className="block min-w-0">
            <Link to={`/maintenance/${row.id}`} className={`block truncate font-medium text-foreground ${linkClass}`}>
              {row.title}
            </Link>
            <span className="flex flex-wrap items-center gap-x-2 text-caption">
              <span className="text-muted-foreground tabular-nums">{row.id}</span>
              <CategoryLabel category={row.category} />
            </span>
          </span>
        )
      },
    }),
    column.accessor((row) => `${row.propertyName} ${row.locationLabel}`, {
      id: 'location',
      header: showProperty ? 'Location' : 'Unit / area',
      sortFn: 'alphanumeric',
      cell: (info) => {
        const row = info.row.original
        return (
          <span className="block min-w-0">
            {showProperty ? (
              <Link to={`/properties/${row.propertyId}`} className={`block truncate text-foreground ${linkClass}`}>
                {row.propertyName}
              </Link>
            ) : null}
            <span className={showProperty ? 'block text-caption text-muted-foreground' : 'block text-foreground'}>{row.locationLabel}</span>
            {row.tenantName ? <span className="block truncate text-caption text-muted-foreground">Reported by {row.tenantName}</span> : null}
          </span>
        )
      },
    }),
    column.accessor('priorityRank', {
      id: 'priority',
      header: 'Priority',
      cell: (info) => <MaintenancePriorityBadge priority={info.row.original.priority} />,
    }),
    column.accessor((row) => REQUEST_STATUS_LABELS[row.status], {
      id: 'status',
      header: 'Status',
      sortFn: 'text',
      cell: (info) => {
        const { request } = info.row.original
        const { timing, text } = timingLine(request)
        return (
          <span className="flex flex-col items-start gap-1">
            <RequestStatusBadge status={request.status} />
            <TimingText timing={timing} text={text} />
          </span>
        )
      },
    }),
    column.accessor('vendorName', {
      id: 'vendor',
      header: 'Vendor',
      sortFn: 'text',
      cell: (info) => {
        const row = info.row.original
        if (!row.vendorName) return <span className="text-muted-foreground">Unassigned</span>
        return (
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="text-foreground">{row.vendorName}</span>
            {row.vendorActive ? null : <InactiveVendorBadge />}
          </span>
        )
      },
    }),
    column.accessor('createdAt', {
      id: 'opened',
      header: 'Opened',
      sortFn: 'text',
      cell: (info) => (
        <time dateTime={info.getValue()} className="whitespace-nowrap text-muted-foreground">
          {formatRelativeTime(info.getValue())}
        </time>
      ),
    }),
    column.display({
      id: 'actions',
      header: () => <span className="sr-only">Actions</span>,
      meta: { align: 'end', cellClassName: 'w-12' },
      cell: (info) => <RequestActionsMenu id={info.row.original.id} editable={info.row.original.status !== 'cancelled'} />,
    }),
  ])
}
