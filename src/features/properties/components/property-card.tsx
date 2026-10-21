import { MapPin } from 'lucide-react'
import { Link } from 'react-router'

import { OccupancyMeter, OccupancyValue } from '@/features/properties/components/occupancy-meter'
import { PropertyActionsMenu } from '@/features/properties/components/property-actions-menu'
import { PropertyStatusBadge, PropertyTypeLabel } from '@/features/properties/components/property-badges'
import { type PropertyListRow } from '@/features/properties/lib/property-list'
import { formatAddress } from '@/features/properties/lib/property-meta'
import { formatCurrency } from '@/lib/format'

/** Card layout for the properties list on tablet and mobile. */
export function PropertyCard({ row }: { row: PropertyListRow }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <Link
            to={`/properties/${row.id}`}
            className="block truncate rounded-sm text-body font-medium text-foreground outline-none hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {row.name}
          </Link>
          <p className="flex items-start gap-1.5 text-caption text-muted-foreground">
            <MapPin className="mt-px size-3.5 shrink-0" aria-hidden="true" />
            <span className="line-clamp-2">{formatAddress(row.location)}</span>
          </p>
        </div>
        <PropertyActionsMenu id={row.id} name={row.name} />
      </div>
      <div className="flex flex-wrap items-center gap-2 text-caption">
        <PropertyStatusBadge status={row.status} />
        <PropertyTypeLabel type={row.type} />
      </div>
      <div className="flex items-center gap-3 text-caption">
        <OccupancyMeter rate={row.occupancyRate} className="flex-1" />
        <span className="text-muted-foreground tabular-nums">
          {row.occupiedUnits}/{row.totalUnits} units · <OccupancyValue rate={row.occupancyRate} />
        </span>
      </div>
      <p className="flex justify-between border-t border-border pt-3 text-caption">
        <span className="text-muted-foreground">Monthly revenue</span>
        <span className="font-semibold text-foreground tabular-nums">{formatCurrency(row.monthlyRevenue)}</span>
      </p>
    </div>
  )
}
