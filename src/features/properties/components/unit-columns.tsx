import { Pencil } from 'lucide-react'

import { IconButton } from '@/components/shared/icon-button'
import { createDataTableColumnHelper } from '@/components/tables/data-table-features'
import { UnitStatusBadge } from '@/features/properties/components/unit-status-badge'
import { UNIT_TYPE_LABELS } from '@/features/properties/lib/property-meta'
import { formatCurrency, formatNumber, formatShortDate } from '@/lib/format'
import { type Unit } from '@/types'

export interface UnitRow extends Unit {
  /** Display label, e.g. "Unit 204" or "Suite 310". */
  label: string
}

const column = createDataTableColumnHelper<UnitRow>()

export function createUnitColumns(onEdit: (unit: Unit) => void) {
  return column.columns([
    column.accessor('label', {
      id: 'unit',
      header: 'Unit',
      sortFn: 'alphanumeric',
      cell: (info) => <span className="font-medium text-foreground">{info.getValue()}</span>,
    }),
    column.accessor((row) => UNIT_TYPE_LABELS[row.type], {
      id: 'type',
      header: 'Type',
      sortFn: 'text',
      cell: (info) => <span className="text-muted-foreground">{info.getValue()}</span>,
    }),
    column.accessor('floor', {
      header: 'Floor',
      meta: { align: 'end' },
    }),
    column.accessor('areaSqft', {
      header: 'Size',
      meta: { align: 'end' },
      cell: (info) => `${formatNumber(info.getValue())} sq ft`,
    }),
    column.accessor('rent', {
      header: 'Rent / mo',
      meta: { align: 'end' },
      cell: (info) => (
        <span className="block">
          <span className="block font-medium text-foreground">{formatCurrency(info.getValue())}</span>
          {info.row.original.status === 'occupied' ? null : (
            <span className="block text-caption text-muted-foreground">Asking</span>
          )}
        </span>
      ),
    }),
    column.accessor('status', {
      header: 'Status',
      sortFn: 'text',
      cell: (info) => <UnitStatusBadge status={info.getValue()} />,
    }),
    column.accessor((row) => row.tenantName ?? '', {
      id: 'tenant',
      header: 'Tenant',
      sortFn: 'text',
      cell: (info) => {
        const unit = info.row.original
        if (!unit.tenantName) return <span className="text-muted-foreground">—</span>
        return (
          <span className="block">
            <span className="block text-foreground">{unit.tenantName}</span>
            {unit.leaseEndDate ? (
              <span className="block text-caption text-muted-foreground">Lease ends {formatShortDate(unit.leaseEndDate)}, {unit.leaseEndDate.slice(0, 4)}</span>
            ) : null}
          </span>
        )
      },
    }),
    column.display({
      id: 'actions',
      header: () => <span className="sr-only">Actions</span>,
      meta: { align: 'end', cellClassName: 'w-12' },
      cell: (info) => (
        <IconButton label={`Edit ${info.row.original.label}`} size="icon-sm" onClick={() => onEdit(info.row.original)}>
          <Pencil />
        </IconButton>
      ),
    }),
  ])
}
