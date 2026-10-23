import { Link } from 'react-router'

import { FormattedAmount, FormattedNumber } from '@/components/shared/formatted'
import { createDataTableColumnHelper } from '@/components/tables/data-table-features'
import { OccupancyMeter, OccupancyValue } from '@/features/properties/components/occupancy-meter'
import { PropertyActionsMenu } from '@/features/properties/components/property-actions-menu'
import { PropertyStatusBadge, PropertyTypeLabel } from '@/features/properties/components/property-badges'
import { type PropertyListRow } from '@/features/properties/lib/property-list'
import { PROPERTY_STATUS_LABELS } from '@/features/properties/lib/property-meta'

const column = createDataTableColumnHelper<PropertyListRow>()

export const propertyColumns = column.columns([
  column.accessor('name', {
    header: 'Property',
    sortFn: 'text',
    cell: (info) => (
      <Link
        to={`/properties/${info.row.original.id}`}
        className="rounded-sm font-medium text-foreground outline-none hover:text-primary hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {info.getValue()}
      </Link>
    ),
  }),
  column.accessor('type', {
    header: 'Type',
    sortFn: 'text',
    cell: (info) => <PropertyTypeLabel type={info.getValue()} />,
  }),
  column.accessor('addressText', {
    id: 'location',
    header: 'Location',
    sortFn: 'text',
    cell: (info) => {
      const { street, city, state } = info.row.original.location
      return (
        <span className="block">
          <span className="block text-foreground">
            {city}, {state}
          </span>
          {street ? <span className="block text-caption text-muted-foreground">{street}</span> : null}
        </span>
      )
    },
  }),
  column.accessor('totalUnits', {
    header: 'Units',
    meta: { align: 'end' },
    cell: (info) => <FormattedNumber value={info.getValue()} />,
  }),
  column.accessor('occupiedUnits', {
    header: 'Occupied',
    meta: { align: 'end' },
    cell: (info) => <FormattedNumber value={info.getValue()} />,
  }),
  column.accessor('occupancyRate', {
    header: 'Occupancy',
    meta: { align: 'end' },
    cell: (info) => (
      <span className="inline-flex items-center justify-end gap-2.5">
        <OccupancyMeter rate={info.getValue()} className="w-16" />
        <span className="w-12">
          <OccupancyValue rate={info.getValue()} />
        </span>
      </span>
    ),
  }),
  column.accessor('monthlyRevenue', {
    header: 'Revenue / mo',
    meta: { align: 'end' },
    cell: (info) => <span className="font-medium text-foreground"><FormattedAmount value={info.getValue()} /></span>,
  }),
  column.accessor((row) => PROPERTY_STATUS_LABELS[row.status], {
    id: 'status',
    header: 'Status',
    sortFn: 'text',
    cell: (info) => <PropertyStatusBadge status={info.row.original.status} />,
  }),
  column.display({
    id: 'actions',
    header: () => <span className="sr-only">Actions</span>,
    meta: { align: 'end', cellClassName: 'w-12' },
    cell: (info) => <PropertyActionsMenu id={info.row.original.id} name={info.row.original.name} />,
  }),
])
