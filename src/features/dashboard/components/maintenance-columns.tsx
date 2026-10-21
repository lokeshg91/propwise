import { createDataTableColumnHelper } from '@/components/tables/data-table-features'
import { MaintenancePriorityBadge, MaintenanceStatusBadge } from '@/features/maintenance/components/maintenance-badges'
import { PRIORITY_RANK, STATUS_RANK } from '@/features/maintenance/lib/maintenance-meta'
import { formatRelativeTime } from '@/lib/format'
import { type MaintenanceRequestRow } from '@/types'

const column = createDataTableColumnHelper<MaintenanceRequestRow>()

export const maintenanceColumns = column.columns([
  column.accessor('id', {
    header: 'Request ID',
    sortFn: 'alphanumeric',
    cell: (info) => <span className="font-mono text-caption text-muted-foreground">{info.getValue()}</span>,
  }),
  column.accessor('issue', {
    header: 'Issue',
    sortFn: 'text',
    cell: (info) => (
      <span className="block max-w-64 min-w-40">
        <span className="block truncate font-medium text-foreground">{info.getValue()}</span>
        <time dateTime={info.row.original.createdAt} className="text-caption text-muted-foreground">
          Reported {formatRelativeTime(info.row.original.createdAt)}
        </time>
      </span>
    ),
  }),
  column.accessor('propertyName', {
    header: 'Property',
    sortFn: 'text',
    cell: (info) => (
      <span className="block">
        <span className="block text-foreground">{info.getValue()}</span>
        <span className="text-caption text-muted-foreground">{info.row.original.unit}</span>
      </span>
    ),
  }),
  column.accessor((row) => PRIORITY_RANK[row.priority], {
    id: 'priority',
    header: 'Priority',
    sortDescFirst: true,
    cell: (info) => <MaintenancePriorityBadge priority={info.row.original.priority} />,
  }),
  column.accessor((row) => row.vendor ?? '', {
    id: 'vendor',
    header: 'Assigned vendor',
    sortFn: 'text',
    cell: (info) =>
      info.getValue() ? (
        <span className="text-foreground">{info.getValue()}</span>
      ) : (
        <span className="text-muted-foreground italic">Unassigned</span>
      ),
  }),
  column.accessor((row) => STATUS_RANK[row.status], {
    id: 'status',
    header: 'Status',
    meta: { align: 'end' },
    cell: (info) => <MaintenanceStatusBadge status={info.row.original.status} />,
  }),
])
