import { Building2, Home } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { PROPERTY_STATUS_LABELS } from '@/features/properties/lib/property-meta'
import { type PropertyStatus, type PropertyType } from '@/types'

const STATUS_VARIANT: Record<PropertyStatus, 'success' | 'warning' | 'info'> = {
  stable: 'success',
  attention: 'warning',
  'lease-up': 'info',
}

export function PropertyStatusBadge({ status }: { status: PropertyStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{PROPERTY_STATUS_LABELS[status]}</Badge>
}

export function PropertyTypeLabel({ type }: { type: PropertyType }) {
  const Icon = type === 'residential' ? Home : Building2
  return (
    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
      <Icon className="size-3.5" aria-hidden="true" />
      {type === 'residential' ? 'Residential' : 'Commercial'}
    </span>
  )
}
