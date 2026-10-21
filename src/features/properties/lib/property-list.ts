import { PROPERTY_STATUSES, PROPERTY_TYPES, type Property, type PropertyStatus, type PropertyType } from '@/types'

export interface PropertyListFilters {
  q: string
  type: PropertyType | 'all'
  status: PropertyStatus | 'all'
}

export const DEFAULT_LIST_FILTERS: PropertyListFilters = { q: '', type: 'all', status: 'all' }

export interface PropertyListRow extends Property {
  /** Occupancy in percent of total units (0–100). */
  occupancyRate: number
  /** Searchable address text: street, city, state and ZIP. */
  addressText: string
}

export function parseListFilters(params: URLSearchParams): PropertyListFilters {
  const type = params.get('type')
  const status = params.get('status')
  return {
    q: params.get('q') ?? '',
    type: (PROPERTY_TYPES as readonly string[]).includes(type ?? '') ? (type as PropertyType) : 'all',
    status: (PROPERTY_STATUSES as readonly string[]).includes(status ?? '') ? (status as PropertyStatus) : 'all',
  }
}

export function toListRow(property: Property): PropertyListRow {
  const { street = '', city, state, postalCode = '' } = property.location
  return {
    ...property,
    occupancyRate: property.totalUnits === 0 ? 0 : (property.occupiedUnits / property.totalUnits) * 100,
    addressText: `${street} ${city} ${state} ${postalCode}`.trim(),
  }
}

/** Applies type and status filters. Text search is handled by the table. */
export function filterPropertyRows(rows: PropertyListRow[], filters: PropertyListFilters): PropertyListRow[] {
  return rows.filter(
    (row) =>
      (filters.type === 'all' || row.type === filters.type) && (filters.status === 'all' || row.status === filters.status),
  )
}

export function summarizeProperties(rows: PropertyListRow[]) {
  const units = rows.reduce((sum, row) => sum + row.totalUnits, 0)
  const occupied = rows.reduce((sum, row) => sum + row.occupiedUnits, 0)
  return {
    properties: rows.length,
    units,
    occupied,
    occupancyRate: units === 0 ? 0 : (occupied / units) * 100,
    monthlyRevenue: rows.reduce((sum, row) => sum + row.monthlyRevenue, 0),
  }
}
