export const PROPERTY_TYPES = ['residential', 'commercial'] as const
export type PropertyType = (typeof PROPERTY_TYPES)[number]

export const PROPERTY_STATUSES = ['stable', 'attention', 'lease-up'] as const
export type PropertyStatus = (typeof PROPERTY_STATUSES)[number]

export interface PropertyLocation {
  /** Street address, e.g. "1450 Maple Court Dr". */
  street?: string
  city: string
  /** Two-letter US state code. */
  state: string
  postalCode?: string
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
  description?: string
  yearBuilt?: number
  /** Gross building area in square feet. */
  areaSqft?: number
  /** ISO timestamp of the last edit made in the app. */
  updatedAt?: string
}

/** Values accepted when creating or editing a property. */
export interface PropertyInput {
  name: string
  type: PropertyType
  status: PropertyStatus
  street: string
  city: string
  state: string
  postalCode: string
  totalUnits: number
  description: string
  yearBuilt: number | null
  areaSqft: number | null
}
