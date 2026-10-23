import { Link } from 'react-router'

import { TenantActionsMenu } from '@/features/tenants/components/tenant-actions-menu'
import { TenantAvatar } from '@/features/tenants/components/tenant-avatar'
import { LeaseStatusBadge, TenantStatusBadge } from '@/features/tenants/components/tenant-badges'
import { leaseDateLine } from '@/features/tenants/lib/lease-dates'
import { type TenantRow } from '@/features/tenants/lib/tenant-list'
import { useFormat } from '@/hooks/use-format'

/** Card layout for the tenants list on tablet and mobile. */
export function TenantCard({ row }: { row: TenantRow }) {
  const { amount: formatCurrency, date: formatDate } = useFormat()
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <TenantAvatar name={row.name} kind={row.kind} />
          <div className="min-w-0">
            <Link
              to={`/tenants/${row.id}`}
              className="block truncate rounded-sm text-body font-medium text-foreground outline-none hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {row.name}
            </Link>
            <p className="truncate text-caption text-muted-foreground">
              {row.propertyName ? `${row.propertyName} · ${row.unitLabel}` : 'No unit'}
            </p>
          </div>
        </div>
        <TenantActionsMenu id={row.id} name={row.name} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <TenantStatusBadge status={row.status} />
        {/* Skip the lease badge when it would just repeat “Active”. */}
        {row.leaseStatus && row.leaseStatus !== 'active' ? <LeaseStatusBadge status={row.leaseStatus} /> : null}
      </div>
      {row.leaseStatus && row.leaseStart && row.leaseEnd ? (
        <p className="text-caption text-muted-foreground">
          {leaseDateLine(row.leaseStatus, { start: row.leaseStart, end: row.leaseEnd, endedAt: row.keyDate }, formatDate)}
        </p>
      ) : null}
      <div className="flex flex-wrap justify-between gap-x-3 gap-y-1 border-t border-border pt-3 text-caption">
        <span className="min-w-0 truncate text-muted-foreground">
          {row.phone} · {row.email}
        </span>
        {row.monthlyRent > 0 ? (
          <span className="font-semibold text-foreground tabular-nums">{formatCurrency(row.monthlyRent)}/mo</span>
        ) : null}
      </div>
    </div>
  )
}
