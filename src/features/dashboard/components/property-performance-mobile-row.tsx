import { PropertyStatusBadge, PropertyTypeLabel } from '@/features/properties/components/property-badges'
import { formatCurrency, formatPercent } from '@/lib/format'
import { cn } from '@/lib/utils'
import { type PropertyPerformanceRow } from '@/types'

/** Compact card used for the property performance table on small screens. */
export function PropertyPerformanceMobileRow({ row }: { row: PropertyPerformanceRow }) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-body font-medium text-foreground">{row.name}</p>
          <p className="flex flex-wrap items-center gap-x-2 text-caption text-muted-foreground">
            <PropertyTypeLabel type={row.type} />
            <span aria-hidden="true">·</span>
            <span>
              {row.location.city}, {row.location.state}
            </span>
          </p>
        </div>
        <PropertyStatusBadge status={row.status} />
      </div>
      <div className="flex items-center gap-3 text-caption">
        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden="true">
          <span
            className={cn('block h-full rounded-full', row.occupancyRate < 88 ? 'bg-chart-3' : 'bg-primary')}
            style={{ width: `${row.occupancyRate}%` }}
          />
        </span>
        <span className="text-muted-foreground tabular-nums">
          {row.occupiedUnits}/{row.totalUnits} units ·{' '}
          <span className="font-semibold text-foreground">{formatPercent(row.occupancyRate)}</span>
        </span>
      </div>
      <p className="flex justify-between text-caption">
        <span className="text-muted-foreground">Revenue / month</span>
        <span className="font-semibold text-foreground tabular-nums">{formatCurrency(row.monthlyRevenue)}</span>
      </p>
    </div>
  )
}
