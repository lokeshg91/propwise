export const PROPERTY_TYPES = ['residential', 'commercial'] as const
export type PropertyType = (typeof PROPERTY_TYPES)[number]

export const PROPERTY_STATUSES = ['stable', 'attention', 'lease-up'] as const
export type PropertyStatus = (typeof PROPERTY_STATUSES)[number]

export interface PropertyLocation {
  city: string
  state: string
}

export interface Property {
  id: string
  name: string
  type: PropertyType
  location: PropertyLocation
  /** Apartments for residential properties, leasable suites for commercial. */
  totalUnits: number
  occupiedUnits: number
  /** Units currently offline for repairs or renovation. */
  maintenanceUnits: number
  /** Current monthly rental revenue in USD. */
  monthlyRevenue: number
  status: PropertyStatus
  /** ISO date the property joined the portfolio. */
  acquiredAt: string
}
