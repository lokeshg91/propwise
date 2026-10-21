import { type LeaseStatus } from './lease'
import { type EmergencyContact, type MailingAddress, type TenantKind } from './tenant'

/** Lease terms chosen in the tenant form. */
export interface LeaseAssignmentInput {
  propertyId: string
  unitId: string
  startDate: string
  endDate: string
  monthlyRent: number
  securityDeposit: number
  paymentDueDay: number
  /** New leases start as active (moved in) or pending (future move-in). */
  status: Extract<LeaseStatus, 'active' | 'pending'>
}

export interface TenantInput {
  kind: TenantKind
  name: string
  email: string
  phone: string
  mailingAddress: MailingAddress
  emergencyContact: EmergencyContact | null
  notes: string
  /** Required when creating a tenant; optional for past tenants on edit. */
  lease: LeaseAssignmentInput | null
}
