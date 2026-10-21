export const TENANT_KINDS = ['individual', 'business'] as const
export type TenantKind = (typeof TENANT_KINDS)[number]

/** Derived from the tenant's leases: active (incl. holdover), pending only, or past only. */
export const TENANT_STATUSES = ['active', 'pending', 'past'] as const
export type TenantStatus = (typeof TENANT_STATUSES)[number]

export interface MailingAddress {
  street: string
  city: string
  /** Two-letter US state code. */
  state: string
  postalCode: string
}

export interface EmergencyContact {
  name: string
  phone: string
  relationship: string
}

/** A person or business that leases (or has leased) a unit. */
export interface Tenant {
  id: string
  kind: TenantKind
  name: string
  email: string
  phone: string
  mailingAddress: MailingAddress
  emergencyContact: EmergencyContact | null
  notes?: string
  createdAt: string
  updatedAt: string
}

export const TENANT_EVENT_KINDS = [
  'tenant-created',
  'tenant-updated',
  'lease-created',
  'lease-updated',
  'lease-activated',
  'lease-moved',
  'lease-ended',
  'lease-cancelled',
] as const
export type TenantEventKind = (typeof TENANT_EVENT_KINDS)[number]

/** Change recorded when a tenant or their lease is edited in the app. */
export interface TenantEvent {
  id: string
  tenantId: string
  /** The lease the event is about, if any. */
  leaseId?: string
  kind: TenantEventKind
  title: string
  description: string
  /** ISO timestamp. */
  createdAt: string
}
