import { type PropertyFormDraft } from '@/features/properties/lib/property-schema'
import { type Property } from '@/types'

/** Maps a stored property to form values for editing. */
export function toPropertyFormValues(property: Property): PropertyFormDraft {
  return {
    name: property.name,
    type: property.type,
    status: property.status,
    street: property.location.street ?? '',
    city: property.location.city,
    state: property.location.state,
    postalCode: property.location.postalCode ?? '',
    totalUnits: property.totalUnits,
    description: property.description ?? '',
    yearBuilt: property.yearBuilt ?? null,
    areaSqft: property.areaSqft ?? null,
  }
}
