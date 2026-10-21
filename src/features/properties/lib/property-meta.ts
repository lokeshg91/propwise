import {
  COMMERCIAL_UNIT_TYPES,
  type PropertyStatus,
  type PropertyType,
  RESIDENTIAL_UNIT_TYPES,
  type UnitStatus,
  type UnitType,
} from '@/types'

export const PROPERTY_STATUS_LABELS: Record<PropertyStatus, string> = {
  stable: 'Stable',
  attention: 'Needs attention',
  'lease-up': 'Lease-up',
}

export const PROPERTY_STATUS_DESCRIPTIONS: Record<PropertyStatus, string> = {
  stable: 'Operating normally with steady occupancy.',
  attention: 'Occupancy, maintenance or collections need follow-up.',
  'lease-up': 'Newly acquired or renovated and filling vacant units.',
}

export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  residential: 'Residential',
  commercial: 'Commercial',
}

export const PROPERTY_TYPE_DESCRIPTIONS: Record<PropertyType, string> = {
  residential: 'Apartments, townhomes and other homes.',
  commercial: 'Offices, retail, medical and flex space.',
}

export const UNIT_TYPE_LABELS: Record<UnitType, string> = {
  studio: 'Studio',
  '1-bed': '1 bedroom',
  '2-bed': '2 bedrooms',
  '3-bed': '3 bedrooms',
  office: 'Office suite',
  retail: 'Retail',
  medical: 'Medical suite',
  flex: 'Flex space',
}

export const UNIT_STATUS_LABELS: Record<UnitStatus, string> = {
  occupied: 'Occupied',
  vacant: 'Vacant',
  maintenance: 'Under maintenance',
}

export function unitTypesFor(type: PropertyType): readonly UnitType[] {
  return type === 'residential' ? RESIDENTIAL_UNIT_TYPES : COMMERCIAL_UNIT_TYPES
}

/** "Unit 204" for residential, "Suite 204" for commercial. */
export function unitLabel(type: PropertyType, number: string): string {
  return `${type === 'residential' ? 'Unit' : 'Suite'} ${number}`
}

export function formatAddress(location: { street?: string; city: string; state: string; postalCode?: string }): string {
  const cityLine = [location.city, [location.state, location.postalCode].filter(Boolean).join(' ')].join(', ')
  return location.street ? `${location.street}, ${cityLine}` : cityLine
}
