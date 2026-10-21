import { Link } from 'react-router'

import { createDataTableColumnHelper } from '@/components/tables/data-table-features'
import { TenantActionsMenu } from '@/features/tenants/components/tenant-actions-menu'
import { TenantAvatar } from '@/features/tenants/components/tenant-avatar'
import { LeaseStatusBadge, TenantStatusBadge } from '@/features/tenants/components/tenant-badges'
import { leaseDateLine } from '@/features/tenants/lib/lease-dates'
import { type TenantRow } from '@/features/tenants/lib/tenant-list'
import { TENANT_STATUS_LABELS } from '@/features/tenants/lib/tenant-meta'
import { formatCurrency } from '@/lib/format'

const column = createDataTableColumnHelper<TenantRow>()

export const tenantColumns = column.columns([
  column.accessor('name', {
    header: 'Tenant',
    sortFn: 'text',
    cell: (info) => {
      const row = info.row.original
      return (
        <span className="flex min-w-0 items-center gap-3">
          <TenantAvatar name={row.name} kind={row.kind} />
          <span className="min-w-0">
            <Link
              to={`/tenants/${row.id}`}
              className="block truncate rounded-sm font-medium text-foreground outline-none hover:text-primary hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {row.name}
            </Link>
            <span className="block truncate text-caption text-muted-foreground">{row.email}</span>
          </span>
        </span>
      )
    },
  }),
  column.accessor('locationText', {
    id: 'property',
    header: 'Property / unit',
    sortFn: 'alphanumeric',
    cell: (info) => {
      const row = info.row.original
      if (!row.propertyId) return <span className="text-muted-foreground">—</span>
      return (
        <span className="block min-w-0">
          <Link
            to={`/properties/${row.propertyId}?tab=units`}
            className="block truncate rounded-sm text-foreground outline-none hover:text-primary hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {row.propertyName}
          </Link>
          <span className="block text-caption text-muted-foreground">{row.unitLabel}</span>
        </span>
      )
    },
  }),
  column.accessor('contactText', {
    id: 'phone',
    header: 'Phone',
    enableSorting: false,
    cell: (info) => <span className="whitespace-nowrap text-muted-foreground">{info.row.original.phone}</span>,
  }),
  column.accessor('monthlyRent', {
    header: 'Rent / mo',
    meta: { align: 'end' },
    cell: (info) =>
      info.getValue() > 0 ? <span className="font-medium text-foreground">{formatCurrency(info.getValue())}</span> : '—',
  }),
  // Sorts by the key date: lease end, or move-in for pending leases.
  column.accessor((row) => row.keyDate ?? '', {
    id: 'lease',
    header: 'Lease',
    sortFn: 'text',
    cell: (info) => {
      const row = info.row.original
      if (!row.leaseStatus || !row.leaseStart || !row.leaseEnd) return <span className="text-muted-foreground">No lease</span>
      return (
        <span className="flex flex-col items-start gap-1">
          <LeaseStatusBadge status={row.leaseStatus} />
          <span className="text-caption text-muted-foreground">
            {leaseDateLine(row.leaseStatus, { start: row.leaseStart, end: row.leaseEnd, endedAt: row.keyDate })}
          </span>
        </span>
      )
    },
  }),
  column.accessor((row) => TENANT_STATUS_LABELS[row.status], {
    id: 'status',
    header: 'Status',
    sortFn: 'text',
    cell: (info) => <TenantStatusBadge status={info.row.original.status} />,
  }),
  column.display({
    id: 'actions',
    header: () => <span className="sr-only">Actions</span>,
    meta: { align: 'end', cellClassName: 'w-12' },
    cell: (info) => <TenantActionsMenu id={info.row.original.id} name={info.row.original.name} />,
  }),
])
