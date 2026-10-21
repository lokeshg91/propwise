import { MapPin, Pencil, Plus } from 'lucide-react'
import { Link } from 'react-router'

import { BackLink } from '@/components/shared/back-link'
import { Button } from '@/components/ui/button'
import { PropertyStatusBadge, PropertyTypeLabel } from '@/features/properties/components/property-badges'
import { formatAddress } from '@/features/properties/lib/property-meta'
import { type Property } from '@/types'

interface PropertyDetailHeaderProps {
  property: Property
  canAddUnit: boolean
  onAddUnit: () => void
}

export function PropertyDetailHeader({ property, canAddUnit, onAddUnit }: PropertyDetailHeaderProps) {
  return (
    <div className="flex flex-col gap-3">
      <BackLink to="/properties" label="Properties" />
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-h1 text-foreground">{property.name}</h1>
            <PropertyStatusBadge status={property.status} />
          </div>
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-body text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="size-4 shrink-0" aria-hidden="true" />
              {formatAddress(property.location)}
            </span>
            <PropertyTypeLabel type={property.type} />
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link to={`/properties/${property.id}/edit`}>
              <Pencil data-icon="inline-start" />
              Edit property
            </Link>
          </Button>
          <Button
            onClick={onAddUnit}
            aria-disabled={!canAddUnit}
            className="aria-disabled:opacity-60"
          >
            <Plus data-icon="inline-start" />
            Add unit
          </Button>
        </div>
      </div>
    </div>
  )
}
