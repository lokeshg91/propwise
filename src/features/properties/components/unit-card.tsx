import { Pencil } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { type UnitRow } from '@/features/properties/components/unit-columns'
import { UnitTenant } from '@/features/properties/components/unit-tenant'
import { UnitStatusBadge } from '@/features/properties/components/unit-status-badge'
import { UNIT_TYPE_LABELS } from '@/features/properties/lib/property-meta'
import { useFormat } from '@/hooks/use-format'

export function UnitCard({ row, onEdit }: { row: UnitRow; onEdit: () => void }) {
  const { amount: formatCurrency, number: formatNumber } = useFormat()
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-body font-medium text-foreground">{row.label}</p>
          <p className="text-caption text-muted-foreground">
            {UNIT_TYPE_LABELS[row.type]} · Floor {row.floor} · {formatNumber(row.areaSqft)} sq ft
          </p>
        </div>
        <UnitStatusBadge status={row.status} />
      </div>
      <p className="flex justify-between gap-3 text-caption">
        <span className="text-muted-foreground">{row.status === 'occupied' ? 'Rent' : 'Asking rent'}</span>
        <span className="font-semibold text-foreground tabular-nums">{formatCurrency(row.rent)}/mo</span>
      </p>
      <div className="flex items-center justify-between gap-3 border-t border-border pt-2.5">
        <div className="min-w-0 text-caption text-muted-foreground">
          {row.lease || row.tenantName ? <UnitTenant row={row} /> : 'No tenant'}
        </div>
        <Button variant="ghost" size="sm" onClick={onEdit} aria-label={`Edit ${row.label}`}>
          <Pencil data-icon="inline-start" />
          Edit
        </Button>
      </div>
    </div>
  )
}
