import { Badge } from '@/components/ui/badge'
import { UNIT_STATUS_LABELS } from '@/features/properties/lib/property-meta'
import { type UnitStatus } from '@/types'

const VARIANT: Record<UnitStatus, 'success' | 'neutral' | 'warning'> = {
  occupied: 'success',
  vacant: 'neutral',
  maintenance: 'warning',
}

export function UnitStatusBadge({ status }: { status: UnitStatus }) {
  return (
    <Badge variant={VARIANT[status]}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {UNIT_STATUS_LABELS[status]}
    </Badge>
  )
}
