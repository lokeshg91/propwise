import { createDataTableColumnHelper } from '@/components/tables/data-table-features'
import { PropertyStatusBadge, PropertyTypeLabel } from '@/features/properties/components/property-badges'
import { PROPERTY_STATUS_LABELS } from '@/features/properties/lib/property-meta'
import { formatCurrency, formatNumber, formatPercent } from '@/lib/format'
import { cn } from '@/lib/utils'
import { type PropertyPerformanceRow } from '@/types'

const column = createDataTableColumnHelper<PropertyPerformanceRow>()

export const propertyPerformanceColumns = column.columns([
  column.accessor('name', {
    header: 'Property',
    sortFn: 'text',
    cell: (info) => <span className="font-medium text-foreground">{info.getValue()}</span>,
  }),
  column.accessor('type', {
    header: 'Type',
    sortFn: 'text',
    cell: (info) => <PropertyTypeLabel type={info.getValue()} />,
  }),
  column.accessor((row) => `${row.location.city}, ${row.location.state}`, {
    id: 'location',
    header: 'Location',
    sortFn: 'text',
    cell: (info) => <span className="text-muted-foreground">{info.getValue()}</span>,
  }),
  column.accessor('totalUnits', {
    header: 'Units',
    meta: { align: 'end' },
    cell: (info) => formatNumber(info.getValue()),
  }),
  column.accessor('occupiedUnits', {
    header: 'Occupied',
    meta: { align: 'end' },
    cell: (info) => formatNumber(info.getValue()),
  }),
  column.accessor('occupancyRate', {
    header: 'Occupancy',
    meta: { align: 'end' },
    cell: (info) => {
      const rate = info.getValue()
      return (
        <span className="inline-flex items-center justify-end gap-2.5">
          <span className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-muted md:block" aria-hidden="true">
            <span
              className={cn('block h-full rounded-full', rate < 88 ? 'bg-chart-3' : 'bg-primary')}
              style={{ width: `${rate}%` }}
            />
          </span>
          <span className="w-12 font-medium text-foreground">{formatPercent(rate)}</span>
        </span>
      )
    },
  }),
  column.accessor('monthlyRevenue', {
    header: 'Revenue / mo',
    meta: { align: 'end' },
    cell: (info) => <span className="font-medium text-foreground">{formatCurrency(info.getValue())}</span>,
  }),
  column.accessor((row) => PROPERTY_STATUS_LABELS[row.status], {
    id: 'status',
    header: 'Status',
    sortFn: 'text',
    cell: (info) => <PropertyStatusBadge status={info.row.original.status} />,
  }),
])
