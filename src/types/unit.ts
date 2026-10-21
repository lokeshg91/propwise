export const UNIT_STATUSES = ['occupied', 'vacant', 'maintenance'] as const
export type UnitStatus = (typeof UNIT_STATUSES)[number]

export const RESIDENTIAL_UNIT_TYPES = ['studio', '1-bed', '2-bed', '3-bed'] as const
export const COMMERCIAL_UNIT_TYPES = ['office', 'retail', 'medical', 'flex'] as const
export type ResidentialUnitType = (typeof RESIDENTIAL_UNIT_TYPES)[number]
export type CommercialUnitType = (typeof COMMERCIAL_UNIT_TYPES)[number]
export type UnitType = ResidentialUnitType | CommercialUnitType

/** An apartment (residential) or leasable suite (commercial). */
export interface Unit {
  id: string
  propertyId: string
  /** Unit or suite number without prefix, e.g. "204". */
  number: string
  type: UnitType
  floor: number
  areaSqft: number
  /** Monthly rent in USD: the contract rent when occupied, the asking rent otherwise. */
  rent: number
  status: UnitStatus
  /** Current tenant, copied from the active lease. Managed by the Tenants module. */
  tenantName: string | null
  /** End date of the active lease (YYYY-MM-DD), copied from the lease. */
  leaseEndDate: string | null
  updatedAt: string
}

/**
 * Values accepted when creating or editing a unit. Occupancy is controlled
 * by leases: `status` may only be `vacant` or `maintenance` for units without
 * an active lease, and must stay `occupied` (with unchanged rent) for leased units.
 */
export interface UnitInput {
  number: string
  type: UnitType
  floor: number
  areaSqft: number
  rent: number
  status: UnitStatus
}
