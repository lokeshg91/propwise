import { daysBetween, todayIso } from '@/data/domain/dates'
import { type Lease, type LeaseDisplayStatus, type TenantStatus } from '@/types'

/** Leases ending within this many days are flagged as expiring. */
export const EXPIRING_WINDOW_DAYS = 60

/** A lease that holds or reserves its unit: active (incl. holdover) or pending. */
export function isCurrentLease(lease: Lease): boolean {
  return lease.status === 'active' || lease.status === 'pending'
}

/**
 * How a lease looks today. Purely derived: an active lease past its end date
 * is a *holdover* and keeps its unit occupied until it is explicitly ended.
 */
export function getLeaseDisplayStatus(lease: Lease, today: string = todayIso()): LeaseDisplayStatus {
  switch (lease.status) {
    case 'pending':
      return lease.startDate <= today ? 'move-in-due' : 'pending'
    case 'active':
      if (lease.endDate < today) return 'holdover'
      return daysBetween(today, lease.endDate) <= EXPIRING_WINDOW_DAYS ? 'expiring' : 'active'
    case 'expired':
      return 'expired'
    case 'terminated':
      return 'terminated'
  }
}

/** Tenant status derived from all of their leases. */
export function getTenantStatus(leases: Lease[]): TenantStatus {
  if (leases.some((lease) => lease.status === 'active')) return 'active'
  if (leases.some((lease) => lease.status === 'pending')) return 'pending'
  return 'past'
}

/** The tenant's current lease (active first, then pending), or the most recent past one. */
export function getPrimaryLease(leases: Lease[]): Lease | undefined {
  return (
    leases.find((lease) => lease.status === 'active') ??
    leases.find((lease) => lease.status === 'pending') ??
    [...leases].sort((a, b) => (b.endedAt ?? b.endDate).localeCompare(a.endedAt ?? a.endDate))[0]
  )
}
