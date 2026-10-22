import {
  type LeaseDisplayStatus,
  type LeaseEndReason,
  type TenantKind,
  type TenantStatus,
} from '@/types'

type BadgeTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'brand'

export const TENANT_STATUS_LABELS: Record<TenantStatus, string> = {
  active: 'Active',
  pending: 'Pending',
  past: 'Past',
}

export const TENANT_STATUS_TONES: Record<TenantStatus, BadgeTone> = {
  active: 'success',
  pending: 'info',
  past: 'neutral',
}

export const TENANT_KIND_LABELS: Record<TenantKind, string> = {
  individual: 'Individual',
  business: 'Business',
}

export const LEASE_STATUS_LABELS: Record<LeaseDisplayStatus, string> = {
  active: 'Active',
  expiring: 'Expiring soon',
  holdover: 'Holdover',
  pending: 'Pending move-in',
  'move-in-due': 'Move-in due',
  expired: 'Expired',
  terminated: 'Terminated',
}

export const LEASE_STATUS_TONES: Record<LeaseDisplayStatus, BadgeTone> = {
  active: 'success',
  expiring: 'warning',
  holdover: 'danger',
  pending: 'info',
  'move-in-due': 'warning',
  expired: 'neutral',
  terminated: 'neutral',
}

/** Order used by the lease status filter. */
export const LEASE_FILTER_ORDER: readonly LeaseDisplayStatus[] = [
  'active',
  'expiring',
  'holdover',
  'pending',
  'move-in-due',
  'expired',
  'terminated',
]

export const LEASE_END_REASON_LABELS: Record<LeaseEndReason, string> = {
  'moved-out': 'Moved out at end of term',
  'early-termination': 'Early termination',
  transfer: 'Transferred to another property',
  other: 'Other',
}

export const unitPrefixFor = (propertyType: 'residential' | 'commercial') =>
  propertyType === 'residential' ? 'Unit' : 'Suite'
