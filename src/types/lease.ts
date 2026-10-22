/**
 * Stored lease state. Only explicit actions change it:
 * - `pending` → `active` via "Mark as moved in"
 * - `active` → `expired` / `terminated` via "End lease"
 * - `pending` → `terminated` via "Cancel lease"
 * Passing a date never changes it; see `getLeaseDisplayStatus` for the derived view.
 */
export const LEASE_STATUSES = ['pending', 'active', 'expired', 'terminated'] as const
export type LeaseStatus = (typeof LEASE_STATUSES)[number]

/** What a lease looks like today, derived from its stored status and dates. */
export const LEASE_DISPLAY_STATUSES = [
  'active',
  'expiring',
  'holdover',
  'pending',
  'move-in-due',
  'expired',
  'terminated',
] as const
export type LeaseDisplayStatus = (typeof LEASE_DISPLAY_STATUSES)[number]

export const LEASE_END_REASONS = ['moved-out', 'early-termination', 'transfer', 'other'] as const
export type LeaseEndReason = (typeof LEASE_END_REASONS)[number]

export interface Lease {
  id: string
  tenantId: string
  propertyId: string
  unitId: string
  /** Calendar dates (YYYY-MM-DD). */
  startDate: string
  endDate: string
  monthlyRent: number
  securityDeposit: number
  /** Day of the month rent is due (1–28). */
  paymentDueDay: number
  status: LeaseStatus
  /** Move-out date when the lease was ended or cancelled. */
  endedAt: string | null
  endReason: LeaseEndReason | null
  createdAt: string
  updatedAt: string
}
