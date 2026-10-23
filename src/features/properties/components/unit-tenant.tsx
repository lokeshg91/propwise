import { Link } from 'react-router'

import { type UnitRow } from '@/features/properties/components/unit-columns'
import { useFormat } from '@/hooks/use-format'

/** Tenant cell: links to the tenant profile; pending leases show as reserved. */
export function UnitTenant({ row }: { row: UnitRow }) {
  const { date: formatDate } = useFormat()
  const { lease } = row
  if (!lease) {
    if (!row.tenantName) return <span className="text-muted-foreground">—</span>
    return <span className="block text-foreground">{row.tenantName}</span>
  }
  const link = (
    <Link
      to={`/tenants/${lease.tenant.id}`}
      className="rounded-sm text-foreground underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      {lease.tenant.name}
    </Link>
  )
  return (
    <span className="block min-w-0">
      <span className="block truncate">{link}</span>
      <span className="block text-caption text-muted-foreground">
        {lease.status === 'pending' ? `Reserved · moves in ${formatDate(lease.startDate)}` : `Lease ends ${formatDate(lease.endDate)}`}
      </span>
    </span>
  )
}
